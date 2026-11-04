import { SPELLS, getSpellAtLevel } from './spells.js';
import { generateQuestion } from './problem-engine.js';
import { resolveChainHits, healingGained } from './combat.js';
import { ENEMY_TYPES, createEnemy } from './enemy-types.js';
import { stageSpawnConfig, randomEnemyType, chooseSpawnPosition } from './spawn-director.js';
import { createStage, addStageTime, addStageKill, bossShouldSpawn, stageIsComplete } from './stage-director.js';
import { createProgression, addXp, xpToNext } from './progression.js';
import { selectUpgradeChoices, applyUpgrade, movementMultiplier, cooldownMultiplier, questionTimeMultiplier } from './upgrades.js';
import { createLaserSegment, laserHitsPoint } from './laser.js';

(() => {
'use strict';
const C = document.getElementById('game'), ctx = C.getContext('2d');
const W = C.width, H = C.height, WORLD_W = 3000, WORLD_H = 2200, TWO = Math.PI * 2;
const PENT = Array.from({length: 5}, (_, i) => ({x: Math.sin(i * TWO / 5) * 158, y: -Math.cos(i * TWO / 5) * 158}));
const MOVE_KEYS = new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright']);
const FAIL_SLOW_SECONDS = 1.5, FAIL_SPEED_MULT = .5;
const DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';
const dom = {
  kills: document.getElementById('kills'), enemyCount: document.getElementById('enemies-count'),
  stageNumber: document.getElementById('stage-number'), stageFill: document.getElementById('stage-progress-fill'),
  stageText: document.getElementById('stage-progress-text'), characterLevel: document.getElementById('character-level'),
  xpLabel: document.getElementById('xp-label'), xpFill: document.getElementById('xp-progress-fill'),
  bolt: document.getElementById('bolt'), heal: document.getElementById('heal'),
  boltFill: document.getElementById('bolt-fill'), healFill: document.getElementById('heal-fill'),
  boltState: document.getElementById('bolt-state'), healState: document.getElementById('heal-state'),
  cancel: document.getElementById('cancel'), restart: document.getElementById('restart'),
  toast: document.getElementById('toast'), slow: document.getElementById('slow'),
  status: document.getElementById('status'), upgradeOverlay: document.getElementById('upgrade-overlay'),
  upgradeHeading: document.getElementById('upgrade-heading'), upgradeOptions: document.getElementById('upgrade-options'),
  transitionOverlay: document.getElementById('transition-overlay'), transitionHeading: document.getElementById('transition-heading'),
};
const camera = {x: 0, y: 0};
const keys = new Set();
let p, enemies, particles, bolts, lasers, kills, mode, spell, question, activeCastConfig;
let stage, progression, spawnTimer, transitionTimer, currentChoices, gameOver, last = 0;
let toastUntil = 0, touchTarget = null, nextEnemyId = 1;
const rnd = (a,b) => Math.floor(Math.random() * (b-a+1)) + a;
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi,v));
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

function cameraUpdate() {
  camera.x = clamp(p.x-W/2,0,WORLD_W-W);
  camera.y = clamp(p.y-H/2,0,WORLD_H-H);
}
function say(message, seconds=2.5) {
  dom.toast.textContent = message;
  toastUntil = performance.now() + seconds*1000;
}
function newPlayer() {
  return {x:WORLD_W/2,y:WORLD_H/2,hp:100,maxHp:100,inv:0,failSlow:0,
    cd:{bolt:0,heal:0}, levels:{bolt:1,heal:1}, bonuses:{swiftness:0,vitality:0,focus:0,timeWarp:0},face:0};
}
function reset() {
  p = newPlayer(); progression = createProgression(); enemies=[]; particles=[]; bolts=[]; lasers=[];
  kills=0; mode='idle'; spell=null; question=null; activeCastConfig=null; touchTarget=null;
  currentChoices=[]; transitionTimer=0;gameOver=false; nextEnemyId=1;
  dom.upgradeOverlay.hidden=true;dom.transitionOverlay.hidden=true;
  cameraUpdate(); startStage(1);
  say('1 번개 · 2 힐 · 몬스터 처치로 XP 획득',3); updateUI();
}
function startStage(number) {
  stage = createStage(number);
  spawnTimer = stageSpawnConfig(stage.number).interval;
  enemies=[]; lasers=[];bolts=[];touchTarget=null;
  cameraUpdate();
  for(let i=0;i<2;i++) spawnEnemy(randomEnemyType(stageSpawnConfig(number)));
  dom.transitionOverlay.hidden=true;
  say(`${number} 스테이지 시작 · 적을 처치하면 게이지와 XP를 획득합니다`,3);
}
function spawnEnemy(type, x, y) {
  const pos = (Number.isFinite(x) && Number.isFinite(y)) ? {x,y} : chooseSpawnPosition(
    p, camera, {w:WORLD_W,h:WORLD_H},{w:W,h:H});
  const e = createEnemy(type,pos.x,pos.y,Math.random,stage.number);
  e.id=nextEnemyId++;
  enemies.push(e);
  return e;
}
function begin(which) {
  if(gameOver || mode!=='idle') return;
  if(p.cd[which]>0) {say(`쿨타임 ${p.cd[which].toFixed(1)}초 남음`);return;}
  spell=which;activeCastConfig=getSpellAtLevel(which,p.levels[which]);
  question=generateQuestion(activeCastConfig.problem);mode='question';
  say(which==='bolt'?'도함수를 구하세요.':'부정적분을 구하세요.',2);
}
function endCast() {
  if(spell)p.cd[spell]=SPELLS[spell].cooldownSeconds*cooldownMultiplier(p);
  mode='idle';spell=null;question=null;activeCastConfig=null;
  checkMilestones();
}
function cancel() {if(mode!=='question'&&mode!=='target')return;say('마법 취소');endCast();}
function sparkle(x,y,color,count=16) {
  for(let i=0;i<count;i++){const a=Math.random()*TWO,s=rnd(50,240);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.4,max:.75,color});}
}
function selectAnswer(index) {
  if(mode!=='question')return;
  if(index!==question.correct){
    sparkle(p.x,p.y,'#ff6988',12);p.failSlow=FAIL_SLOW_SECONDS;
    say(`오답! 정답 ${question.answer} · 1.5초 이동 감속`,3);endCast();return;
  }
  if(spell==='heal') {
    const gained=healingGained(p.hp,p.maxHp,activeCastConfig.power);
    p.hp+=gained;sparkle(p.x,p.y,'#80f3ab',24);say(`정답! HP +${gained}`);endCast();
  } else {mode='target';say('정답! 번개를 맞힐 적을 클릭하세요.',3);}
}
function killedEnemy(e) {
  if(!enemies.includes(e))return;
  enemies=enemies.filter(item=>item!==e);
  kills++;
  addStageKill(stage,e);
  addXp(progression,e.xp);
}
function castEnemy(primary) {
  if(mode!=='target')return;
  const hits=resolveChainHits(primary,enemies,activeCastConfig.damageByJump,activeCastConfig.chainRange);
  let from={x:p.x,y:p.y};
  for(const {enemy,damage} of hits){
    enemy.hp=Math.max(0,enemy.hp-damage);
    bolts.push({sx:from.x,sy:from.y,ex:enemy.x,ey:enemy.y,ttl:.28});
    sparkle(enemy.x,enemy.y,'#ffe17c',14);from=enemy;
  }
  const defeated=hits.filter(({enemy})=>enemy.hp<=0);
  defeated.forEach(({enemy})=>killedEnemy(enemy));
  say(`번개 ${hits.length}개체 타격 · ${defeated.length}마리 처치 · +${defeated.reduce((n,{enemy})=>n+enemy.xp,0)} XP`);
  endCast();
}
function openUpgrade() {
  currentChoices=selectUpgradeChoices(p);
  if(!currentChoices.length){progression.pendingUpgrades=0;return;}
  mode='upgrade';touchTarget=null;keys.clear();
  dom.upgradeHeading.textContent=`캐릭터 Lv${progression.level} · 강화 선택`;
  dom.upgradeOptions.replaceChildren();
  for(const option of currentChoices){
    const btn=document.createElement('button');btn.type='button';btn.className='upgrade-option';
    const strong=document.createElement('strong');strong.textContent=option.title;
    const small=document.createElement('small');
    const next=option.id==='bolt'?` → Lv${p.levels.bolt+1}`:option.id==='heal'?` → Lv${p.levels.heal+1}`:'';
    small.textContent=option.description+next;
    btn.append(strong,small);btn.addEventListener('click',()=>selectUpgrade(option.id));
    dom.upgradeOptions.append(btn);
  }
  dom.upgradeOverlay.hidden=false;
}
function selectUpgrade(id) {
  if(mode!=='upgrade'||!currentChoices.some(option=>option.id===id))return;
  if(!applyUpgrade(p,id))return;
  progression.pendingUpgrades=Math.max(0,progression.pendingUpgrades-1);
  dom.upgradeOverlay.hidden=true;mode='idle';currentChoices=[];
  say('강화 완료 · 다음 전투를 준비하세요',2);
  checkMilestones();
}
function startTransition() {
  mode='transition';transitionTimer=2;touchTarget=null;keys.clear();
  dom.transitionHeading.textContent=`스테이지 ${stage.number} 완료!`;
  dom.transitionOverlay.hidden=false;
}
function checkMilestones() {
  if(gameOver||mode!=='idle')return;
  if(progression.pendingUpgrades>0){openUpgrade();return;}
  if(stageIsComplete(stage))startTransition();
}
function hurtPlayer(amount, message) {
  if(gameOver||p.inv>0||mode==='upgrade'||mode==='transition')return false;
  p.hp=Math.max(0,p.hp-amount);p.inv=.65;
  sparkle(p.x,p.y,'#ff8a8a',9);say(`${message} · HP -${amount}`,1.5);
  if(p.hp<=0){gameOver=true;mode='idle';say('게임 오버 · 다시 시작을 누르세요',10000);}
  return true;
}
function handleMelee(e,wd) {
  const d=distance(e,p),contact=e.r+16;
  if(d>contact){
    const ratio=wd*e.speed/d;
    e.x+=ratio*(p.x-e.x);e.y+=ratio*(p.y-e.y);
  } else if(e.attack<=0){
    hurtPlayer(e.damage,e.type==='fast'?'빠른 슬라임 피격':'슬라임 피격');
    e.attack=ENEMY_TYPES[e.type].attackInterval;
  }
}
function handleRanged(e,wd) {
  const spec=ENEMY_TYPES.ranged;
  if(e.windup>0){
    e.windup-=wd;
    if(e.windup<=0){
      const segment=createLaserSegment(e,e.aim,spec.laserRange);
      lasers.push({...segment,ttl:spec.laserDuration,width:spec.laserWidth,damage:e.damage,hit:false});
      e.aim=null;e.shootTimer=spec.attackInterval;
    }
    return;
  }
  const d=distance(e,p)||1;
  const direction=d<spec.preferredMin?-1:d>spec.preferredMax?1:0;
  e.x+=(p.x-e.x)/d*e.speed*wd*direction;
  e.y+=(p.y-e.y)/d*e.speed*wd*direction;
  e.shootTimer-=wd;
  if(e.shootTimer<=0){
    e.aim={x:p.x,y:p.y};e.windup=spec.windup;
  }
}
function handleBoss(e,wd) {
  const spec=ENEMY_TYPES.boss;
  if(e.action==='windupSlam'){
    e.actionTimer-=wd;
    if(e.actionTimer<=0){
      if(Math.hypot(p.x-e.aim.x,p.y-e.aim.y)<130+18)hurtPlayer(spec.slamDamage,'보스 내려찍기');
      sparkle(e.aim.x,e.aim.y,'#ffa16b',36);
      e.action='chase';e.attack=e.hp<e.max/2?3.7:4.5;
    }
    return;
  }
  if(e.action==='windupDash'){
    e.actionTimer-=wd;
    if(e.actionTimer<=0){
      const vx=e.aim.x-e.x,vy=e.aim.y-e.y,dist=Math.hypot(vx,vy)||1;
      e.dashX=vx/dist;e.dashY=vy/dist;e.action='dash';e.actionTimer=.7;e.dashHit=false;
    }
    return;
  }
  if(e.action==='dash'){
    e.x=clamp(e.x+e.dashX*470*wd,30,WORLD_W-30);
    e.y=clamp(e.y+e.dashY*470*wd,30,WORLD_H-30);
    if(!e.dashHit&&distance(e,p)<e.r+21){hurtPlayer(spec.dashDamage,'보스 돌진');e.dashHit=true;}
    e.actionTimer-=wd;
    if(e.actionTimer<=0){e.action='chase';e.attack=e.hp<e.max/2?3.7:4.5;}
    return;
  }
  const d=distance(e,p)||1;
  if(d>125){e.x+=(p.x-e.x)/d*e.speed*wd;e.y+=(p.y-e.y)/d*e.speed*wd;}
  if(e.attack<=0){
    // The boss cannot slam a remote player while it is still off-screen.
    if(d>420){e.attack=.7;return;}
    e.aim={x:p.x,y:p.y};
    const useDash=d>205||e.actionCount%2===1;
    e.actionCount++;
    e.action=useDash?'windupDash':'windupSlam';
    e.actionTimer=useDash?.9:1.2;
  }
}
function moveEnemies(wd) {
  for(const e of enemies.slice()){
    e.wiggle+=wd*3;
    e.attack=Math.max(0,e.attack-wd);
    if(e.type==='ranged')handleRanged(e,wd);
    else if(e.type==='boss')handleBoss(e,wd);
    else handleMelee(e,wd);
  }
}
function moveLasers(wd) {
  for(const laser of lasers){
    if(!laser.hit&&laserHitsPoint(laser,p,laser.width,18)){
      hurtPlayer(laser.damage,'원거리 레이저 피격');laser.hit=true;
    }
    laser.ttl-=wd;
  }
  lasers=lasers.filter(laser=>laser.ttl>0);
}
function moveHero(wd) {
  let dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
  let dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
  if(!dx&&!dy&&touchTarget){
    const tx=touchTarget.x-p.x,ty=touchTarget.y-p.y,dist=Math.hypot(tx,ty);
    if(dist>9){dx=tx/dist;dy=ty/dist;}else touchTarget=null;
  }
  if(dx||dy){
    const length=Math.hypot(dx,dy);
    const speed=220*movementMultiplier(p)*(p.failSlow>0?FAIL_SPEED_MULT:1);
    p.x=clamp(p.x+dx/length*speed*wd,25,WORLD_W-25);
    p.y=clamp(p.y+dy/length*speed*wd,25,WORLD_H-25);
    p.face=Math.atan2(dy,dx);
  }
}
function tick(dt) {
  if(gameOver)return;
  if(mode==='upgrade')return;
  if(mode==='transition'){
    transitionTimer-=dt;
    if(transitionTimer<=0){mode='idle';startStage(stage.number+1);checkMilestones();}
    return;
  }
  const wd=dt*(mode==='question'?questionTimeMultiplier(p):1);
  p.inv=Math.max(0,p.inv-wd);
  p.failSlow=Math.max(0,p.failSlow-dt);
  for(const key of ['bolt','heal'])p.cd[key]=Math.max(0,p.cd[key]-dt);
  moveHero(wd);cameraUpdate();
  moveEnemies(wd);moveLasers(wd);
  if(gameOver)return;
  addStageTime(stage,wd);
  if(bossShouldSpawn(stage)){
    stage.bossSpawned=true;spawnEnemy('boss');say('슬라임 군주 등장! 보스를 처치하세요',4);
  }
  if(!stageIsComplete(stage)){
    spawnTimer-=wd;
    const interval=stageSpawnConfig(stage.number).interval;
    while(spawnTimer<=0){
      spawnTimer+=interval;
      spawnEnemy(randomEnemyType(stageSpawnConfig(stage.number)));
    }
  }
  for(const v of particles){v.x+=v.vx*dt;v.y+=v.vy*dt;v.life-=dt;}
  particles=particles.filter(v=>v.life>0);
  for(const b of bolts)b.ttl-=dt;
  bolts=bolts.filter(v=>v.ttl>0);
  checkMilestones();
}
function point(ev){const r=C.getBoundingClientRect();return {x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height};}
function worldPoint(pt){return {x:pt.x+camera.x,y:pt.y+camera.y};}
function magicCenter(){const sx=p.x-camera.x,sy=p.y-camera.y;return {x:clamp(sx,210,W-210),y:clamp(sy-35,195,H-215)};}
C.addEventListener('pointerdown',ev=>{
  ev.preventDefault();if(gameOver||mode==='upgrade'||mode==='transition')return;
  const t=point(ev);
  if(mode==='question'){
    const m=magicCenter();
    for(let i=0;i<5;i++){
      if(Math.abs(t.x-m.x-PENT[i].x)<85&&Math.abs(t.y-m.y-PENT[i].y)<42){selectAnswer(i);return;}
    }
    return;
  }
  if(mode==='target'){
    const wp=worldPoint(t);
    const hit=enemies.filter(e=>distance(wp,e)<e.r+20).sort((a,b)=>distance(wp,a)-distance(wp,b))[0];
    if(hit)castEnemy(hit);else say('적을 클릭하세요.');
    return;
  }
  touchTarget=[...MOVE_KEYS].some(key=>keys.has(key))?null:worldPoint(t);
});
C.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',ev=>{
  const key=ev.key.toLowerCase();
  if(MOVE_KEYS.has(key)||key==='1'||key==='2'||key==='escape')ev.preventDefault();
  if(mode==='upgrade'||mode==='transition'||gameOver){if(key==='r'&&gameOver)reset();return;}
  keys.add(key);if(MOVE_KEYS.has(key))touchTarget=null;
  if(ev.repeat)return;
  if(key==='1')begin('bolt');if(key==='2')begin('heal');
  if(key==='escape')cancel();if(key==='r'&&gameOver)reset();
});
window.addEventListener('keyup',ev=>keys.delete(ev.key.toLowerCase()));
window.addEventListener('blur',()=>keys.clear());
for(const name of ['bolt','heal','cancel','restart']){
  dom[name].addEventListener('click',()=>({bolt:()=>begin('bolt'),heal:()=>begin('heal'),cancel,restart:reset})[name]());
}
const directions={up:'arrowup',down:'arrowdown',left:'arrowleft',right:'arrowright'};
for(const b of document.querySelectorAll('[data-dir]')){
  const key=directions[b.dataset.dir];
  b.addEventListener('pointerdown',e=>{
    e.preventDefault();if(mode==='upgrade'||mode==='transition')return;
    b.setPointerCapture(e.pointerId);keys.add(key);touchTarget=null;
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>keys.delete(key));
}
// Debug selectors do not appear in normal gameplay; all upgrades normally require XP.
if(DEBUG){
  document.querySelectorAll('.debug-level-picker').forEach(el=>el.hidden=false);
  for(const which of ['bolt','heal']){
    for(const button of document.querySelectorAll(`[data-${which}-level]`)){
      button.addEventListener('click',()=>{
        p.levels[which]=Number(button.dataset[which+'Level']);
        say(`테스트: ${which==='bolt'?'번개':'힐'} Lv${p.levels[which]}`,2);updateUI();
      });
    }
  }
}
function circle(x,y,r,fill,stroke,width=2){
  ctx.beginPath();ctx.arc(x,y,r,0,TWO);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function label(str,x,y,size=20,color='#fff',weight='700'){
  ctx.fillStyle=color;ctx.font=`${weight} ${size}px system-ui,sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(str,x,y);
}
function fittedLabel(str,x,y,maxWidth,size=20,color='#fff',weight='700'){
  ctx.save();ctx.font=`${weight} ${size}px system-ui,sans-serif`;
  const measured=ctx.measureText(String(str)).width;
  const adjusted=Math.max(10,Math.min(size,size*maxWidth/Math.max(1,measured)));
  label(String(str),x,y,adjusted,color,weight);ctx.restore();
}
function drawEnemy(e){
  const cfg=ENEMY_TYPES[e.type];
  ctx.save();ctx.translate(e.x,e.y);
  ctx.scale(1+Math.sin(e.wiggle)*.045,1-Math.sin(e.wiggle)*.04);
  circle(0,0,e.r,cfg.fill,cfg.border,e.type==='boss'?4:2);
  circle(-e.r*.35,-4,e.type==='boss'?6:3,'#241c32');
  circle(e.r*.35,-4,e.type==='boss'?6:3,'#241c32');
  if(e.type==='boss'){
    ctx.fillStyle='#ffdc69';ctx.beginPath();ctx.moveTo(-20,-e.r+4);
    ctx.lineTo(-10,-e.r-16);ctx.lineTo(0,-e.r-3);ctx.lineTo(12,-e.r-20);
    ctx.lineTo(22,-e.r+4);ctx.closePath();ctx.fill();
  }
  ctx.restore();
  const barW=e.r*2+6, y=e.y-e.r-16;
  ctx.fillStyle='#482733';ctx.fillRect(e.x-barW/2,y,barW,6);
  ctx.fillStyle=cfg.border;ctx.fillRect(e.x-barW/2,y,barW*e.hp/e.max,6);
  if(e.type==='ranged'&&e.windup>0&&e.aim){
    const spec=ENEMY_TYPES.ranged;
    const beam=createLaserSegment(e,e.aim,spec.laserRange);
    ctx.save();ctx.strokeStyle='#ee73c9';ctx.globalAlpha=.22;ctx.lineWidth=spec.laserWidth;
    ctx.beginPath();ctx.moveTo(beam.x1,beam.y1);ctx.lineTo(beam.x2,beam.y2);ctx.stroke();
    ctx.globalAlpha=1;ctx.setLineDash([8,5]);ctx.strokeStyle='#ffc6eb';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(beam.x1,beam.y1);ctx.lineTo(beam.x2,beam.y2);ctx.stroke();ctx.restore();
  }
  if(e.type==='boss'&&e.action==='windupSlam'&&e.aim){
    ctx.fillStyle='#ff695135';ctx.strokeStyle='#ff856a';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(e.aim.x,e.aim.y,130,0,TWO);ctx.fill();ctx.stroke();
  }
  if(e.type==='boss'&&e.action==='windupDash'&&e.aim){
    const dx=e.aim.x-e.x,dy=e.aim.y-e.y,len=Math.hypot(dx,dy)||1;
    ctx.strokeStyle='#ff9074';ctx.lineWidth=48;ctx.globalAlpha=.24;
    ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+dx/len*300,e.y+dy/len*300);ctx.stroke();ctx.globalAlpha=1;
  }
}
function draw(){
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#13243b';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#1e3652';ctx.lineWidth=1;
  for(let x=Math.floor(camera.x/48)*48;x<camera.x+W;x+=48){ctx.beginPath();ctx.moveTo(x-camera.x,0);ctx.lineTo(x-camera.x,H);ctx.stroke();}
  for(let y=Math.floor(camera.y/48)*48;y<camera.y+H;y+=48){ctx.beginPath();ctx.moveTo(0,y-camera.y);ctx.lineTo(W,y-camera.y);ctx.stroke();}
  ctx.save();ctx.translate(-camera.x,-camera.y);
  if(touchTarget)circle(touchTarget.x,touchTarget.y,9,null,'#729cbd',1);
  enemies.forEach(drawEnemy);
  for(const laser of lasers){
    ctx.save();ctx.strokeStyle='#fb65ce';ctx.shadowColor='#ff96e4';ctx.shadowBlur=22;
    ctx.lineWidth=laser.width;ctx.globalAlpha=.72;
    ctx.beginPath();ctx.moveTo(laser.x1,laser.y1);ctx.lineTo(laser.x2,laser.y2);ctx.stroke();
    ctx.globalAlpha=1;ctx.strokeStyle='#fff0fa';ctx.lineWidth=7;ctx.stroke();ctx.restore();
  }
  ctx.save();ctx.translate(p.x,p.y);
  if(p.inv>0&&Math.floor(performance.now()/90)%2===0)ctx.globalAlpha=.45;
  circle(0,0,22,'#4b92e3','#b4d9ff',3);ctx.rotate(p.face);
  ctx.fillStyle='#d7ecff';ctx.beginPath();ctx.moveTo(27,0);ctx.lineTo(12,-9);ctx.lineTo(12,9);ctx.closePath();ctx.fill();ctx.restore();
  const hpW=54,hpY=p.y-41;
  ctx.fillStyle='#09241d';ctx.fillRect(p.x-hpW/2-2,hpY-2,hpW+4,12);
  ctx.fillStyle='#35584c';ctx.fillRect(p.x-hpW/2,hpY,hpW,8);
  ctx.fillStyle='#53df90';ctx.fillRect(p.x-hpW/2,hpY,hpW*p.hp/p.maxHp,8);
  ctx.strokeStyle='#b5f5ce';ctx.lineWidth=1;ctx.strokeRect(p.x-hpW/2-.5,hpY-.5,hpW+1,9);
  if(!gameOver&&mode==='idle'&&p.cd.bolt<=0){
    circle(p.x+38,p.y-57,15,'#1b2c42','#eacb70',1.8);
    label('ϟ',p.x+38,p.y-57,26,'#ffe17c');
  }
  for(const b of bolts){
    ctx.save();ctx.globalAlpha=Math.min(1,b.ttl/.16);ctx.strokeStyle='#ffe67e';
    ctx.lineWidth=6;ctx.shadowColor='#ffef9c';ctx.shadowBlur=15;
    ctx.beginPath();ctx.moveTo(b.sx,b.sy);
    for(let i=1;i<7;i++){
      const f=i/7;ctx.lineTo(b.sx+(b.ex-b.sx)*f+Math.sin(i*29)*10,
        b.sy+(b.ey-b.sy)*f+Math.cos(i*13)*10);
    }
    ctx.lineTo(b.ex,b.ey);ctx.stroke();ctx.restore();
  }
  for(const v of particles){ctx.globalAlpha=Math.max(0,Math.min(1,v.life/v.max));circle(v.x,v.y,3,v.color);}
  ctx.globalAlpha=1;ctx.restore();
  if(p.failSlow>0){label(`이동 감속 ${p.failSlow.toFixed(1)}초`,W/2,60,16,'#f5a2b9');}
  if(mode==='question'){
    const m=magicCenter(),pts=PENT.map(v=>({x:m.x+v.x,y:m.y+v.y}));
    ctx.fillStyle='#07162ce8';ctx.strokeStyle=spell==='heal'?'#7ef7b5':'#80bdff';ctx.lineWidth=3;
    ctx.beginPath();pts.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();pts.forEach((v,i)=>i?ctx.lineTo(m.x+(v.x-m.x)*.74,m.y+(v.y-m.y)*.74):ctx.moveTo(m.x+(v.x-m.x)*.74,m.y+(v.y-m.y)*.74));ctx.closePath();ctx.lineWidth=1;ctx.stroke();
    const lines=question.display??[question.prompt];
    if(lines.length===4){
      fittedLabel(lines[0],m.x,m.y-70,240,24);
      fittedLabel(lines[1],m.x,m.y-41,250,23);
      fittedLabel(lines[2],m.x,m.y-12,240,23);
      fittedLabel(lines[3],m.x,m.y+24,220,26);
    }
    else if(lines.length===3){fittedLabel(lines[0],m.x,m.y-49,240,23);fittedLabel(lines[1],m.x,m.y-19,260,26);fittedLabel(lines[2],m.x,m.y+18,230,29);}
    else if(lines.length===2){fittedLabel(lines[0],m.x,m.y-23,232,29);fittedLabel(lines[1],m.x,m.y+17,220,30);}
    else fittedLabel(lines[0],m.x,m.y-4,230,30);
    label(spell==='heal'?'부정적분 · +C 포함':'도함수',m.x,m.y+63,15,'#a7c8e5','500');
    pts.forEach((v,i)=>{
      ctx.beginPath();ctx.ellipse(v.x,v.y,80,38,0,0,TWO);ctx.fillStyle='#234971';ctx.fill();ctx.strokeStyle='#b3d9ff';ctx.lineWidth=2.5;ctx.stroke();
      const choiceLines=question.choiceLines?.[i]??[String(question.choices[i])];
      if(choiceLines.length>1)choiceLines.forEach((line,j)=>fittedLabel(line,v.x,v.y-(choiceLines.length-1)*10+j*20,148,20));
      else fittedLabel(choiceLines[0],v.x,v.y,148,25);
    });
    label('정답을 클릭하세요',m.x,m.y+208,15,'#d5e6ff');
  }
  if(mode==='target'){
    ctx.fillStyle='#0a1832aa';ctx.fillRect(0,0,W,43);
    label('번개 대기 중 — 공격할 적을 클릭하세요',W/2,23,19,'#ffedb3');
    enemies.forEach(e=>circle(e.x-camera.x,e.y-camera.y,e.r+8,null,'#ffe388',3));
  }
  if(gameOver){
    ctx.fillStyle='#05101bcb';ctx.fillRect(0,0,W,H);
    label('GAME OVER',W/2,H/2-25,48);
    label(`스테이지 ${stage.number} · Lv${progression.level} · ${kills}마리 처치`,W/2,H/2+35,20,'#c6d8ef');
    label('다시 시작 버튼이나 R 키를 누르세요',W/2,H/2+72,17,'#c6d8ef');
  }
}
function updateUI(){
  dom.kills.textContent=kills;
  dom.enemyCount.textContent=enemies.length;
  dom.stageNumber.textContent=stage.number;
  dom.stageFill.style.width=Math.min(100,stage.progress)+'%';
  dom.stageText.textContent=`스테이지 ${stage.number} · ${Math.floor(stage.progress)}%${stage.number%5===0&&stage.bossSpawned&&!stage.bossDefeated?' · 보스 격파 필요':''}`;
  const xp=xpToNext(progression);
  dom.characterLevel.textContent=progression.level;
  dom.xpLabel.textContent=`${xp.current}/${xp.required}`;
  dom.xpFill.style.width=Math.min(100,xp.current/xp.required*100)+'%';
  const qSpeed=questionTimeMultiplier(p);
  dom.slow.style.display=mode==='question'&&qSpeed<1?'block':'none';
  dom.slow.textContent=`풀이 중 세계 속도 ×${qSpeed.toFixed(2)}`;
  for(const k of ['bolt','heal']){
    const ready=p.cd[k]<=0,cdTotal=SPELLS[k].cooldownSeconds*cooldownMultiplier(p);
    const fill=100*clamp(1-p.cd[k]/cdTotal,0,1);
    dom[k].disabled=gameOver||mode!=='idle'||!ready;
    dom[k].classList.toggle('active',spell===k);dom[k].classList.toggle('ready',ready);
    dom[k+'Fill'].style.width=fill+'%';
    dom[k+'State'].textContent=`Lv${p.levels[k]} · `+(ready?'준비':p.cd[k].toFixed(1)+'초');
  }
  dom.cancel.disabled=gameOver||(mode!=='question'&&mode!=='target');
  dom.status.textContent=mode==='upgrade'?'레벨업 · 강화 하나 선택':mode==='transition'?'다음 스테이지 준비 중':
    mode==='question'?'마법진: 정답 선택':mode==='target'?'적을 클릭해 발사':gameOver?'게임 오버':
    `번개 Lv${p.levels.bolt} / 힐 Lv${p.levels.heal}`;
  if(DEBUG){for(const which of ['bolt','heal']){
    for(const button of document.querySelectorAll(`[data-${which}-level]`)){
      const chosen=p.levels[which]===Number(button.dataset[which+'Level']);
      button.classList.toggle('selected',chosen);button.setAttribute('aria-pressed',String(chosen));
    }
  }}
  if(performance.now()>toastUntil&&dom.toast.textContent)dom.toast.textContent='';
}
function loop(ts){
  if(!last)last=ts;
  const dt=Math.min(.05,(ts-last)/1000);last=ts;
  tick(dt);draw();updateUI();requestAnimationFrame(loop);
}
reset();requestAnimationFrame(loop);
})();
