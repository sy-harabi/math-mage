import { SPELLS, getSpellAtLevel } from './spells.js';
import { generateQuestion } from './problem-engine.js';
import { resolveChainTargets } from './combat.js';

(()=>{'use strict';
const C=document.getElementById('game'),ctx=C.getContext('2d');
const W=C.width,H=C.height, WORLD_W=3000,WORLD_H=2200,TWO=Math.PI*2;
const camera={x:0,y:0};
function cameraUpdate(){camera.x=Math.max(0,Math.min(WORLD_W-W,p.x-W/2));camera.y=Math.max(0,Math.min(WORLD_H-H,p.y-H/2))} 
const dom={kills:document.getElementById('kills'),bolt:document.getElementById('bolt'),heal:document.getElementById('heal'),boltFill:document.getElementById('bolt-fill'),healFill:document.getElementById('heal-fill'),boltState:document.getElementById('bolt-state'),healState:document.getElementById('heal-state'),cancel:document.getElementById('cancel'),restart:document.getElementById('restart'),toast:document.getElementById('toast'),slow:document.getElementById('slow'),status:document.getElementById('status')};
const spells=SPELLS;
const FAIL_SLOW_SECONDS=1.5, FAIL_SPEED_MULT=.5;
const pent=Array.from({length:5},(_,i)=>({x:Math.sin(i*2*Math.PI/5)*158,y:-Math.cos(i*2*Math.PI/5)*158}));
let p,enemies,particles,bolts,kills,mode,spell,question,target,spawnTimer,last,toastUntil,gameOver,activeCastConfig;
const keys=new Set();let touchTarget=null;
const manualMoveKeys=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright']);
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
function say(str,seconds=2){dom.toast.textContent=str;toastUntil=performance.now()+seconds*1000}
function reset(){const selectedLevel=p?.levels?.bolt ?? 1;p={x:WORLD_W/2,y:WORLD_H/2,hp:100,inv:0,failSlow:0,cd:{bolt:0,heal:0},levels:{bolt:selectedLevel,heal:1},face:0};enemies=[];particles=[];bolts=[];kills=0;mode='idle';spell=null;activeCastConfig=null;question=null;target=null;spawnTimer=2;gameOver=false;touchTarget=null;cameraUpdate();for(let i=0;i<2;i++)spawn();say('1 번개 · 2 힐 · WASD 이동',4);updateUI()}
function spawn(){if(enemies.length>=3)return;let x,y;for(let t=0;t<20;t++){const angle=Math.random()*TWO,dist=rnd(330,490);x=Math.max(30,Math.min(WORLD_W-30,p.x+Math.cos(angle)*dist));y=Math.max(30,Math.min(WORLD_H-30,p.y+Math.sin(angle)*dist));if(Math.hypot(x-p.x,y-p.y)>260)break}enemies.push({x,y,hp:40,max:40,r:21,attack:0,speed:rnd(54,79),wiggle:Math.random()*6})}
function begin(which){if(gameOver)return;if(mode!=='idle'){say('먼저 현재 마법을 완료하거나 취소하세요.');return}if(p.cd[which]>0){say(`쿨타임 ${p.cd[which].toFixed(1)}초 남음`);return}spell=which;activeCastConfig=getSpellAtLevel(which,p.levels[which]);question=generateQuestion(activeCastConfig.problem);mode='question';say(which==='bolt'?'도함수를 구하세요.':'부정적분을 구하세요.',2)}
function endCast(){if(spell)p.cd[spell]=spells[spell].cooldownSeconds;mode='idle';spell=null;activeCastConfig=null;question=null;target=null}
function cancel(){if(mode==='idle')return;say('마법 취소');endCast()}
function sparkle(x,y,color,count=16){for(let i=0;i<count;i++){let a=Math.random()*TWO,s=rnd(50,240);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.4,max:.75,color})}}
function selectAnswer(i){if(mode!=='question')return;if(i!==question.correct){sparkle(p.x,p.y,'#ff6988',12);p.failSlow=FAIL_SLOW_SECONDS;say(`오답! 정답 ${question.answer} · 1.5초 이동 감속`,2.5);endCast();return}if(spell==='heal'){const gained=Math.min(spells.heal.power,100-p.hp);p.hp+=gained;sparkle(p.x,p.y,'#80f3ab',24);say(`정답! HP +${gained}`);endCast()}else{mode='target';say('정답! 번개를 맞힐 적을 클릭하세요.',3)}}
function castEnemy(e){
  if(mode!=='target')return;
  const bolt=activeCastConfig; // Freeze level at the start of this cast.
  const victims=resolveChainTargets(e,enemies,bolt.chainTargets,bolt.chainRange);
  let from={x:p.x,y:p.y};
  for(const victim of victims){
    victim.hp=Math.max(0,victim.hp-bolt.power);
    bolts.push({sx:from.x,sy:from.y,ex:victim.x,ey:victim.y,ttl:.23});
    sparkle(victim.x,victim.y,'#ffe17c',14);from=victim;
  }
  for(const victim of victims){if(victim.hp<=0){enemies=enemies.filter(v=>v!==victim);kills++;}}
  say(`번개 적중! ${victims.length}개체 공격 · ${victims.filter(v=>v.hp<=0).length}마리 처치`);
  endCast();
}
function point(ev){let r=C.getBoundingClientRect();return {x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height}}
function worldPoint(pt){return {x:pt.x+camera.x,y:pt.y+camera.y}}
function magicCenter(){const sx=p.x-camera.x,sy=p.y-camera.y;return {x:Math.max(210,Math.min(W-210,sx)),y:Math.max(195,Math.min(H-215,sy-35))}}
C.addEventListener('pointerdown',ev=>{ev.preventDefault();if(gameOver)return;const t=point(ev);if(mode==='question'){const m=magicCenter();for(let i=0;i<5;i++){if(Math.abs(t.x-m.x-pent[i].x)<85 && Math.abs(t.y-m.y-pent[i].y)<42){selectAnswer(i);return}}return}if(mode==='target'){const wp=worldPoint(t);const hit=enemies.filter(e=>Math.hypot(wp.x-e.x,wp.y-e.y)<e.r+20).sort((a,b)=>Math.hypot(wp.x-a.x,wp.y-a.y)-Math.hypot(wp.x-b.x,wp.y-b.y))[0];if(hit)castEnemy(hit);else say('적을 클릭하세요.');return}touchTarget=[...manualMoveKeys].some(k=>keys.has(k))?null:worldPoint(t)});
C.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','1','2','escape'].includes(k))e.preventDefault();keys.add(k);if(manualMoveKeys.has(k))touchTarget=null;if(e.repeat)return;if(k==='1')begin('bolt');if(k==='2')begin('heal');if(k==='escape')cancel();if(k==='r'&&gameOver)reset()});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
// Test-level selector is always available, including during an active cast.
// The current cast uses activeCastConfig; the selected level takes effect next cast.
for(const button of document.querySelectorAll('[data-bolt-level]')) {
  button.addEventListener('click',()=>{
    const level=Number(button.dataset.boltLevel);
    if(!Number.isInteger(level) || level<1 || level>3)return;
    p.levels.bolt=level;
    say(`번개 Lv${level} 선택${mode!=='idle'?' · 다음 시전부터 적용':''}`,3);
    updateUI();
  });
}
for(const name of ['bolt','heal','cancel','restart'])dom[name].addEventListener('click',()=>({bolt:()=>begin('bolt'),heal:()=>begin('heal'),cancel, restart:reset})[name]());
const directions={up:'arrowup',down:'arrowdown',left:'arrowleft',right:'arrowright'};
for(let b of document.querySelectorAll('[data-dir]')){const k=directions[b.dataset.dir];b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(k);touchTarget=null});for(let n of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(n,()=>keys.delete(k))}
function step(dt){if(gameOver)return;const slow=mode!=='idle'?.75:1,wd=dt*slow;p.inv=Math.max(0,p.inv-wd);p.failSlow=Math.max(0,p.failSlow-dt);for(let k of ['bolt','heal'])p.cd[k]=Math.max(0,p.cd[k]-dt);
let dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));let dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));if(!dx&&!dy&&touchTarget){let tx=touchTarget.x-p.x,ty=touchTarget.y-p.y,dist=Math.hypot(tx,ty);if(dist>9){dx=tx/dist;dy=ty/dist}else touchTarget=null}if(dx||dy){let m=Math.hypot(dx,dy);const speed=220*(p.failSlow>0?FAIL_SPEED_MULT:1);p.x=Math.max(25,Math.min(WORLD_W-25,p.x+dx/m*speed*wd));p.y=Math.max(25,Math.min(WORLD_H-25,p.y+dy/m*speed*wd));p.face=Math.atan2(dy,dx)}
for(let e of enemies){e.wiggle+=wd*3;let vx=p.x-e.x,vy=p.y-e.y,dist=Math.hypot(vx,vy)||1;e.attack=Math.max(0,e.attack-wd);if(dist>37){e.x+=vx/dist*e.speed*wd;e.y+=vy/dist*e.speed*wd}else if(e.attack<=0&&p.inv<=0){p.hp=Math.max(0,p.hp-12);p.inv=.65;e.attack=1.3;sparkle(p.x,p.y,'#ff8a8a',9);say('피격! HP -12',1.2);if(p.hp<=0){gameOver=true;mode='idle';say('게임 오버 · 다시 시작 버튼을 누르세요.',10000)}}}
spawnTimer-=wd;if(spawnTimer<=0){spawnTimer=4;if(enemies.length<3)spawn()}
cameraUpdate();for(let x of particles){x.x+=x.vx*dt;x.y+=x.vy*dt;x.life-=dt}particles=particles.filter(x=>x.life>0);for(let b of bolts)b.ttl-=dt;bolts=bolts.filter(x=>x.ttl>0)}
function circle(x,y,r,fill,stroke,width=2){ctx.beginPath();ctx.arc(x,y,r,0,TWO);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}}
function label(str,x,y,size=20,color='#fff',weight='700'){ctx.fillStyle=color;ctx.font=`${weight} ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(str,x,y)}
function fittedLabel(str,x,y,maxWidth,size=20,color='#fff',weight='700'){
  ctx.save();ctx.font=`${weight} ${size}px system-ui,sans-serif`;
  const measured=ctx.measureText(String(str)).width;
  const adjusted=Math.max(10,Math.min(size,size*maxWidth/Math.max(1,measured)));
  label(String(str),x,y,adjusted,color,weight);ctx.restore();
}
function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#13243b';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#1e3652';ctx.lineWidth=1;for(let x=Math.floor(camera.x/48)*48;x<camera.x+W;x+=48){ctx.beginPath();ctx.moveTo(x-camera.x,0);ctx.lineTo(x-camera.x,H);ctx.stroke()}for(let y=Math.floor(camera.y/48)*48;y<camera.y+H;y+=48){ctx.beginPath();ctx.moveTo(0,y-camera.y);ctx.lineTo(W,y-camera.y);ctx.stroke()}
ctx.save();ctx.translate(-camera.x,-camera.y);
if(touchTarget){circle(touchTarget.x,touchTarget.y,9,null,'#729cbd',1)}
for(let e of enemies){ctx.save();ctx.translate(e.x,e.y);ctx.scale(1+Math.sin(e.wiggle)*.045,1-Math.sin(e.wiggle)*.04);circle(0,0,e.r,'#d65f76','#ffc0cd',2);circle(-7,-4,3,'#241c32');circle(7,-4,3,'#241c32');ctx.restore();ctx.fillStyle='#482733';ctx.fillRect(e.x-23,e.y-35,46,5);ctx.fillStyle='#ed8192';ctx.fillRect(e.x-23,e.y-35,46*e.hp/e.max,5)}
ctx.save();ctx.translate(p.x,p.y);if(p.inv>0&&Math.floor(performance.now()/90)%2===0)ctx.globalAlpha=.45;circle(0,0,22,'#4b92e3','#b4d9ff',3);ctx.rotate(p.face);ctx.fillStyle='#d7ecff';ctx.beginPath();ctx.moveTo(27,0);ctx.lineTo(12,-9);ctx.lineTo(12,9);ctx.closePath();ctx.fill();ctx.restore();
// Numeric-free, health-proportional green bar immediately above the wizard.
const hpWidth=54,hpHeight=8,hpX=p.x-hpWidth/2,hpY=p.y-41;
ctx.fillStyle='#09241d';ctx.fillRect(hpX-2,hpY-2,hpWidth+4,hpHeight+4);
ctx.fillStyle='#35584c';ctx.fillRect(hpX,hpY,hpWidth,hpHeight);
ctx.fillStyle=p.hp>25?'#53df90':'#82cf6c';ctx.fillRect(hpX,hpY,hpWidth*Math.max(0,p.hp)/100,hpHeight);
ctx.strokeStyle='#b5f5ce';ctx.lineWidth=1;ctx.strokeRect(hpX-.5,hpY-.5,hpWidth+1,hpHeight+1);
// Small bolt icon above/right of the hero means lightning is available now.
if(!gameOver && mode==='idle' && p.cd.bolt<=0){
  const ix=p.x+38,iy=p.y-57;
  circle(ix,iy,15,'#1b2c42','#eacb70',1.8);
  ctx.save();ctx.translate(ix,iy);ctx.fillStyle='#ffdf72';ctx.shadowColor='#ffdb67';ctx.shadowBlur=7;
  ctx.beginPath();ctx.moveTo(2,-11);ctx.lineTo(-7,1);ctx.lineTo(-1,1);ctx.lineTo(-4,11);ctx.lineTo(9,-3);ctx.lineTo(2,-3);ctx.closePath();ctx.fill();ctx.restore();
}
for(let b of bolts){ctx.save();ctx.globalAlpha=Math.min(1,b.ttl/.16);ctx.strokeStyle='#ffe67e';ctx.lineWidth=6;ctx.shadowColor='#ffef9c';ctx.shadowBlur=15;ctx.beginPath();ctx.moveTo(b.sx,b.sy);for(let i=1;i<7;i++){const f=i/7;ctx.lineTo(b.sx+(b.ex-b.sx)*f+Math.sin(i*29)*10,b.sy+(b.ey-b.sy)*f+Math.cos(i*13)*10)}ctx.lineTo(b.ex,b.ey);ctx.stroke();ctx.restore()}
for(let x of particles){ctx.globalAlpha=Math.max(0,Math.min(1,x.life/x.max));circle(x.x,x.y,3,x.color)}ctx.globalAlpha=1;
ctx.restore();
if(p.failSlow>0){ctx.save();ctx.fillStyle='#f5a2b9';ctx.font='700 15px system-ui';ctx.textAlign='center';ctx.fillText(`이동 감속 ${p.failSlow.toFixed(1)}초`,W/2,60);ctx.restore()}
if(mode==='question'){
  const m=magicCenter(),pts=pent.map(v=>({x:m.x+v.x,y:m.y+v.y}));
  ctx.fillStyle='#07162ce8';ctx.strokeStyle=spell==='heal'?'#7ef7b5':'#80bdff';ctx.lineWidth=3;
  ctx.beginPath();pts.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();pts.forEach((v,i)=>i?ctx.lineTo(m.x+(v.x-m.x)*.74,m.y+(v.y-m.y)*.74):ctx.moveTo(m.x+(v.x-m.x)*.74,m.y+(v.y-m.y)*.74));ctx.closePath();ctx.lineWidth=1;ctx.stroke();
  const lines=question.display ?? [question.prompt];
  if(lines.length===4){
    fittedLabel(lines[0],m.x,m.y-63,138,19);
    fittedLabel(lines[1],m.x,m.y-37,146,21);
    fittedLabel(lines[2],m.x,m.y-10,146,21);
    fittedLabel(lines[3],m.x,m.y+27,140,26);
  }else if(lines.length===3){
    fittedLabel(lines[0],m.x,m.y-46,140,19);
    fittedLabel(lines[1],m.x,m.y-10,146,22);
    fittedLabel(lines[2],m.x,m.y+27,140,26);
  }else if(lines.length===2){
    fittedLabel(lines[0],m.x,m.y-23,232,29);
    fittedLabel(lines[1],m.x,m.y+17,220,30);
  }else fittedLabel(lines[0],m.x,m.y-4,230,30);
  label(spell==='heal'?'부정적분 · +C 포함':`도함수 · Lv${activeCastConfig?.problem.termCount ?? 1}`,m.x,m.y+63,15,'#a7c8e5','500');
  // 분수·지수를 읽기 쉽도록 정답 버튼을 원 대신 넓은 타원형으로 표시한다.
  pts.forEach((v,i)=>{
    ctx.beginPath();const choiceLines=question.choiceLines?.[i] ?? [String(question.choices[i])];
    ctx.ellipse(v.x,v.y,82,choiceLines.length===3?41:32,0,0,TWO);
    ctx.fillStyle='#234971';ctx.fill();ctx.strokeStyle='#b3d9ff';ctx.lineWidth=2.5;ctx.stroke();
    if(choiceLines.length>1){
      const lineHeight=19,offset=-(choiceLines.length-1)*lineHeight/2;
      choiceLines.forEach((line,j)=>fittedLabel(line,v.x,v.y+offset+j*lineHeight,145,20));
    }else fittedLabel(choiceLines[0],v.x,v.y,128,25);
  });
  label('정답을 클릭하세요',m.x,m.y+208,15,'#d5e6ff');
}
if(mode==='target'){ctx.fillStyle='#0a1832aa';ctx.fillRect(0,0,W,43);label('번개 대기 중 — 공격할 적을 클릭하세요',W/2,23,19,'#ffedb3');enemies.forEach(e=>circle(e.x-camera.x,e.y-camera.y,e.r+8,null,'#ffe388',3))}
if(gameOver){ctx.fillStyle='#05101bcb';ctx.fillRect(0,0,W,H);label('GAME OVER',W/2,H/2-25,48,'#fff');label(`적 ${kills}마리 처치 · 다시 시작을 누르세요`,W/2,H/2+35,20,'#c6d8ef')}
}
function updateUI(){for(const btn of document.querySelectorAll('[data-bolt-level]')){const selected=Number(btn.dataset.boltLevel)===p.levels.bolt;btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(selected));}dom.kills.textContent=kills;dom.slow.style.display=mode!=='idle'?'block':'none';for(const k of ['bolt','heal']){const ready=p.cd[k]<=0;const fill=100*Math.max(0,Math.min(1,1-p.cd[k]/spells[k].cooldownSeconds));dom[k].disabled=gameOver||mode!=='idle'||!ready;dom[k].classList.toggle('active',spell===k);dom[k].classList.toggle('ready',ready);dom[k+'Fill'].style.width=fill+'%';dom[k+'State'].textContent=`Lv${p.levels[k]} · `+(ready?'준비':p.cd[k].toFixed(1)+'초');dom[k].setAttribute('aria-label',`${k==='bolt'?'번개':'힐'} 마법, ${ready?'준비 완료':p.cd[k].toFixed(1)+'초 남음'}`)}dom.cancel.disabled=mode==='idle'||gameOver;dom.status.textContent=mode==='question'?'마법진: 정답 선택':mode==='target'?'적을 클릭해 발사':gameOver?'게임 오버':`번개 Lv${p.levels.bolt} · ${p.levels.bolt}항 미분 · 최대 ${p.levels.bolt}대상`;if(performance.now()>toastUntil&&dom.toast.textContent!=='')dom.toast.textContent=''}
function loop(ts){if(!last)last=ts;const dt=Math.min(.05,(ts-last)/1000);last=ts;step(dt);draw();updateUI();requestAnimationFrame(loop)}reset();requestAnimationFrame(loop);
})();
