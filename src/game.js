import { SPELLS, getSpellAtLevel } from './spells.js?v=1.5.1';
import { generateQuestion } from './problem-engine.js?v=1.5.1';
import { resolveChainHits, healingGained, resolveAreaHits } from './combat.js?v=1.4.1';
import { ENEMY_TYPES, createEnemy } from './enemy-types.js?v=1.2';
import { stageSpawnConfig, randomEnemyType, chooseSpawnPosition } from './spawn-director.js?v=spawn-balance-1';
import { createStage, addStageTime, addStageKill, bossShouldSpawn, stageIsComplete } from './stage-director.js';
import { createProgression, addXp, xpToNext } from './progression.js';
import { selectUpgradeChoices, applyUpgrade, movementMultiplier, cooldownMultiplier, worldTimeMultiplier } from './upgrades.js?v=1.5.1';
import { createRunTimer, advanceRunTimer, finishRunTimer, formatRunTime } from './speedrun.js';
import { polynomialMathML, problemMathML, boltSequenceMathML, integralSequenceMathML, integralChoiceMathML } from './math-ui.js?v=1.5.1';
import { createLaserSegment, laserHitsPoint } from './laser.js';
import { guardUpgradeButton } from './upgrade-input.js';
import { centeredCamera } from './camera.js';
import { separateEnemies } from './enemy-collision.js';
import { pickEnemyAt } from './targeting.js';
import { generateIntegralSequence, answerIntegral } from './integral-sequence.js?v=1.5.1';
import { generateBoltSequence, answerBolt } from './bolt-sequence.js?v=1.5.1';

(() => {
'use strict';
const C = document.getElementById('game'), ctx = C.getContext('2d');
const W = C.width, H = C.height, WORLD_W = 3000, WORLD_H = 2200, TWO = Math.PI * 2;
const MOVE_KEYS = new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright']);
const FAIL_SLOW_SECONDS = 1.5, FAIL_SPEED_MULT = .5;
const DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';
const dom = {
  kills: document.getElementById('kills'), enemyCount: document.getElementById('enemies-count'),
  runTime: document.getElementById('run-time'), characterLevel: document.getElementById('character-level'),
  xpLabel: document.getElementById('xp-label'), xpFill: document.getElementById('xp-progress-fill'),
  bolt: document.getElementById('bolt'), heal: document.getElementById('heal'), fireball: document.getElementById('fireball'),
  fireballFill: document.getElementById('fireball-fill'), fireballState: document.getElementById('fireball-state'),
  mathTitle: document.getElementById('math-title'),
  boltFill: document.getElementById('bolt-fill'), healFill: document.getElementById('heal-fill'),
  boltState: document.getElementById('bolt-state'), healState: document.getElementById('heal-state'),
  cancel: document.getElementById('cancel'), restart: document.getElementById('restart'),
  toast: document.getElementById('toast'), slow: document.getElementById('slow'),
  status: document.getElementById('status'), upgradeOverlay: document.getElementById('upgrade-overlay'),
  upgradeHeading: document.getElementById('upgrade-heading'), upgradeOptions: document.getElementById('upgrade-options'),
  victoryOverlay: document.getElementById('victory-overlay'), victoryTime: document.getElementById('victory-time'),
  victoryStats: document.getElementById('victory-stats'), victoryRestart:document.getElementById('victory-restart'),
  mathHud: document.getElementById('math-cast-hud'), runeFrame: document.getElementById('rune-frame'),
  mathProblem: document.getElementById('math-problem'), mathAnswers: document.getElementById('math-answers'),
};
const camera = {x: 0, y: 0};
const keys = new Set();
let p, enemies, particles, bolts, lasers, kills, mode, spell, question, activeCastConfig, integralSequence, boltSequence, explosions;
let stage, progression, runTimer, spawnTimer, currentChoices, gameOver, last = 0;
let toastUntil = 0, touchTarget = null, nextEnemyId = 1;
let pointer = null;
const rnd = (a,b) => Math.floor(Math.random() * (b-a+1)) + a;
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi,v));
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

function cameraUpdate() {
  // Keep world framing fixed regardless of whether the ritual is visible.
  const next=centeredCamera(p,{w:W,h:H},{w:WORLD_W,h:WORLD_H});
  camera.x=next.x;camera.y=next.y;
}
/** Center the pentagram on the moving hero in screen coordinates. */
function updateRunePosition() {
  if(mode!=='question')return;
  dom.runeFrame.style.left=((p.x-camera.x)/W*100)+'%';
  dom.runeFrame.style.top=((p.y-camera.y)/H*100)+'%';
}
function say(message, seconds=2.5) {
  dom.toast.textContent = message;
  toastUntil = performance.now() + seconds*1000;
}
function newPlayer() {
  return {x:WORLD_W/2,y:WORLD_H/2,hp:100,maxHp:100,inv:0,failSlow:0,
    cd:{bolt:0,heal:0,fireball:0}, levels:{bolt:1,heal:1,fireball:1}, bonuses:{swiftness:0,vitality:0,focus:0,timeWarp:0},face:0};
}
function reset() {
  p = newPlayer(); progression = createProgression(); runTimer=createRunTimer(); enemies=[]; particles=[]; bolts=[]; lasers=[]; explosions=[]; integralSequence=null;
  kills=0; mode='idle'; spell=null; question=null; activeCastConfig=null; boltSequence=null; touchTarget=null;
  currentChoices=[];gameOver=false; nextEnemyId=1;
  pointer=null;
  dom.upgradeOverlay.hidden=true;dom.victoryOverlay.hidden=true;dom.mathHud.hidden=true;
  cameraUpdate(); startRun();
  say('',0); updateUI();
}
function startRun() {
  // Internal phases control enemy spawns, but are never displayed or paused.
  stage=createStage(1);
  spawnTimer=stageSpawnConfig(1).interval;
  for(let i=0;i<2;i++) spawnEnemy('basic');
}
function updateHiddenPhase() {
  while(stage.number<5&&stageIsComplete(stage)) {
    stage=createStage(stage.number+1);
    spawnTimer=Math.min(spawnTimer,stageSpawnConfig(stage.number).interval);
    // Preserve living enemies, projectiles, and the player's position.
  }
  if(bossShouldSpawn(stage)) {
    stage.bossSpawned=true;
    spawnEnemy('boss');
    say('슬라임 군주 등장! 처치하면 기록이 확정됩니다',4);
  }
}
function completeRun() {
  if(mode==='victory')return;
  finishRunTimer(runTimer);
  mode='victory';spell=null;question=null;activeCastConfig=null;
  touchTarget=null;keys.clear();dom.mathHud.hidden=true;
  dom.victoryTime.textContent=formatRunTime(runTimer.elapsedSeconds);
  dom.victoryStats.textContent=`처치 ${kills}마리 · 캐릭터 Lv${progression.level}`;
  dom.victoryOverlay.hidden=false;
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
  integralSequence=which==='fireball'?generateIntegralSequence(activeCastConfig.problem):null;
  boltSequence=which==='bolt'?generateBoltSequence(activeCastConfig.problem):null;
  question=boltSequence?boltSequence.question:integralSequence?integralSequence.question:generateQuestion(activeCastConfig.problem);mode='question';
  displayMathQuestion();
  say(which==='fireball'?'':which==='bolt'?'':'부정적분을 구하세요.',2);
}
function displayMathQuestion(keepChoices=false) {
  const integral=spell==='fireball';
  dom.mathTitle.textContent=integral?'':
    boltSequence?'':'주문 완성';
  dom.mathProblem.innerHTML=integral?integralSequenceMathML(integralSequence):boltSequence?boltSequenceMathML(boltSequence):problemMathML(question,spell);
  dom.mathHud.dataset.terms=String(question.data.inputTerms.length);
  dom.mathHud.dataset.spell=spell;
  if(!keepChoices){
    dom.mathAnswers.replaceChildren();
    question.choices.forEach((choice,index)=>{
      const button=document.createElement('button');
      button.type='button';button.className='math-choice';
      button.setAttribute('aria-label',`${index+1}번: ${question.choices[index]}`);
      const key=document.createElement('span');key.className='answer-key';key.textContent=String(index+1);
      const formula=document.createElement('span');formula.className='answer-formula';
      formula.innerHTML=integral?integralChoiceMathML(question,index):polynomialMathML(question.data.choiceTermPolys[index],question.data.choiceHasConstant[index]);
      button.append(key,formula);
      button.addEventListener('click',()=>selectAnswer(index));
      dom.mathAnswers.append(button);
    });
  }
  dom.mathHud.hidden=false;
  updateRunePosition();
}
function endCast() {
  dom.mathHud.hidden=true;
  if(spell)p.cd[spell]=SPELLS[spell].cooldownSeconds*cooldownMultiplier(p);
  mode='idle';spell=null;question=null;activeCastConfig=null;integralSequence=null;boltSequence=null;
  checkMilestones();
}
function cancel() {if(mode!=='question'&&mode!=='target')return;say('마법 취소');endCast();}
function sparkle(x,y,color,count=16) {
  for(let i=0;i<count;i++){const a=Math.random()*TWO,s=rnd(50,240);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.4,max:.75,color});}
}
function selectAnswer(index) {
  if(mode!=='question')return;
  if(boltSequence){
    const result=answerBolt(boltSequence,index);
    if(result==='next'){displayMathQuestion(true);return;}
    if(result==='inactive')return;
  }
  if(integralSequence){
    const result=answerIntegral(integralSequence,index);
    if(result==='next'){
      displayMathQuestion();return;
    }
    if(result==='inactive')return;
  }
  dom.mathHud.hidden=true;
  if(index!==question.correct){
    sparkle(p.x,p.y,'#ff6988',12);p.failSlow=FAIL_SLOW_SECONDS;
    say(`오답! 정답 ${question.answer} · 1.5초 이동 감속`,3);endCast();return;
  }
  if(spell==='heal') {
    const gained=healingGained(p.hp,p.maxHp,activeCastConfig.power);
    p.hp+=gained;sparkle(p.x,p.y,'#80f3ab',24);say(`정답! HP +${gained}`);endCast();
  } else {mode='target';say(spell==='fireball'?'주문 완성! 폭발시킬 위치를 클릭하세요.':'정답! 번개를 맞힐 적을 클릭하세요.',3);}
}
function killedEnemy(e) {
  if(!enemies.includes(e))return;
  enemies=enemies.filter(item=>item!==e);
  kills++;
  addStageKill(stage,e);
  addXp(progression,e.xp);
  if(e.type==='boss')completeRun();
  else updateHiddenPhase();
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
  // Resolve other defeated monsters first, then the boss for accurate final stats.
  defeated.filter(({enemy})=>enemy.type!=='boss').forEach(({enemy})=>killedEnemy(enemy));
  defeated.filter(({enemy})=>enemy.type==='boss').forEach(({enemy})=>killedEnemy(enemy));
  if(mode==='victory')return;
  say(`번개 ${hits.length}개체 타격 · ${defeated.length}마리 처치 · +${defeated.reduce((n,{enemy})=>n+enemy.xp,0)} XP`);
  endCast();
}
function castFireball(target) {
  if(mode!=='target'||spell!=='fireball')return;
  const hits=resolveAreaHits(target,enemies,activeCastConfig.radius,activeCastConfig.power);
  for(const {enemy,damage} of hits)enemy.hp=Math.max(0,enemy.hp-damage);
  explosions.push({...target,r:activeCastConfig.radius,ttl:.4});
  sparkle(target.x,target.y,'#ff9e46',28);
  const defeated=hits.filter(({enemy})=>enemy.hp<=0);
  defeated.filter(({enemy})=>enemy.type!=='boss').forEach(({enemy})=>killedEnemy(enemy));
  defeated.filter(({enemy})=>enemy.type==='boss').forEach(({enemy})=>killedEnemy(enemy));
  if(mode==='victory')return;
  say(`파이어볼 ${hits.length}개체 타격 · ${defeated.length}마리 처치`);
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
    const next=['bolt','heal','fireball'].includes(option.id)?` → Lv${p.levels[option.id]+1}`:'';
    small.textContent=option.description+next;
    btn.append(strong,small);
    guardUpgradeButton(btn,()=>selectUpgrade(option.id));
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
function checkMilestones() {
  if(gameOver||mode!=='idle')return;
  if(progression.pendingUpgrades>0){openUpgrade();return;}
  updateHiddenPhase();
}
function hurtPlayer(amount, message) {
  if(gameOver||p.inv>0||mode==='upgrade'||mode==='victory')return false;
  p.hp=Math.max(0,p.hp-amount);p.inv=.65;
  sparkle(p.x,p.y,'#ff8a8a',9);say(`${message} · HP -${amount}`,1.5);
  if(p.hp<=0){gameOver=true;finishRunTimer(runTimer);mode='idle';dom.mathHud.hidden=true;say('게임 오버 · 다시 시작을 누르세요',10000);}
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
      if(Math.hypot(p.x-e.aim.x,p.y-e.aim.y)<spec.slamRadius+18)hurtPlayer(spec.slamDamage,'보스 내려찍기');
      sparkle(e.aim.x,e.aim.y,'#ffa16b',36);
      e.action='chase';e.attack=e.hp<e.max/2?spec.enragedAttackInterval:spec.attackInterval;
    }
    return;
  }
  if(e.action==='windupDash'){
    e.actionTimer-=wd;
    if(e.actionTimer<=0){
      const vx=e.aim.x-e.x,vy=e.aim.y-e.y,dist=Math.hypot(vx,vy)||1;
      e.dashX=vx/dist;e.dashY=vy/dist;e.action='dash';e.actionTimer=spec.dashDuration;e.dashHit=false;
    }
    return;
  }
  if(e.action==='dash'){
    e.x=clamp(e.x+e.dashX*spec.dashSpeed*wd,30,WORLD_W-30);
    e.y=clamp(e.y+e.dashY*spec.dashSpeed*wd,30,WORLD_H-30);
    if(!e.dashHit&&distance(e,p)<e.r+21){hurtPlayer(spec.dashDamage,'보스 돌진');e.dashHit=true;}
    e.actionTimer-=wd;
    if(e.actionTimer<=0){e.action='chase';e.attack=e.hp<e.max/2?spec.enragedAttackInterval:spec.attackInterval;}
    return;
  }
  const d=distance(e,p)||1;
  if(d>spec.slamRadius*.85){e.x+=(p.x-e.x)/d*e.speed*wd;e.y+=(p.y-e.y)/d*e.speed*wd;}
  if(e.attack<=0){
    // The boss cannot slam a remote player while it is still off-screen.
    if(d>550){e.attack=.7;return;}
    e.aim={x:p.x,y:p.y};
    const useDash=d>spec.slamRadius+35||e.actionCount%2===1;
    e.actionCount++;
    e.action=useDash?'windupDash':'windupSlam';
    e.actionTimer=useDash?spec.dashWindup:spec.slamWindup;
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
  separateEnemies(enemies,wd,{w:WORLD_W,h:WORLD_H});
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
  if(gameOver||mode==='victory'||mode==='upgrade')return;
  const wd=dt*worldTimeMultiplier(mode,p);
  p.inv=Math.max(0,p.inv-wd);
  p.failSlow=Math.max(0,p.failSlow-dt);
  for(const key of ['bolt','heal','fireball'])p.cd[key]=Math.max(0,p.cd[key]-dt);
  moveHero(wd);cameraUpdate();
  moveEnemies(wd);moveLasers(wd);
  if(gameOver)return;
  if(mode==='victory')return;
  for(const explosion of explosions)explosion.ttl-=wd;
  explosions=explosions.filter(item=>item.ttl>0);
  if(gameOver)return;
  addStageTime(stage,wd);
  updateHiddenPhase();
  if(mode!=='victory'){
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
C.addEventListener('pointermove',ev=>{pointer=point(ev);});
C.addEventListener('pointerleave',()=>{pointer=null;});
C.addEventListener('pointerdown',ev=>{
  ev.preventDefault();if(gameOver||mode==='upgrade'||mode==='victory')return;
  const t=point(ev);
  pointer=t;
  if(mode==='target'){
    const wp=worldPoint(t);
    if(spell==='fireball'){castFireball(wp);return;}
    const hit=pickEnemyAt(wp,enemies);
    if(hit)castEnemy(hit);else touchTarget=[...MOVE_KEYS].some(key=>keys.has(key))?null:wp;
    return;
  }
  touchTarget=[...MOVE_KEYS].some(key=>keys.has(key))?null:worldPoint(t);
});
C.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',ev=>{
  const key=ev.key.toLowerCase();
  if(MOVE_KEYS.has(key)||/^[1-5]$/.test(key)||key==='escape')ev.preventDefault();
  if(mode==='upgrade'||mode==='victory'||gameOver){if(key==='r'&&(gameOver||mode==='victory'))reset();return;}
  keys.add(key);if(MOVE_KEYS.has(key))touchTarget=null;
  if(ev.repeat)return;
  if(mode==='question'&&/^[1-5]$/.test(key)){selectAnswer(Number(key)-1);return;}
  if(key==='1')begin('bolt');if(key==='2')begin('heal');if(key==='3')begin('fireball');
  if(key==='escape')cancel();if(key==='r'&&gameOver)reset();
});
window.addEventListener('keyup',ev=>keys.delete(ev.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();pointer=null;});
document.addEventListener('visibilitychange',()=>{last=0;keys.clear();});
dom.victoryRestart.addEventListener('click',reset);
for(const name of ['bolt','heal','fireball','cancel','restart']){
  dom[name].addEventListener('click',()=>({bolt:()=>begin('bolt'),heal:()=>begin('heal'),fireball:()=>begin('fireball'),cancel,restart:reset})[name]());
}
// Debug selectors do not appear in normal gameplay; all upgrades normally require XP.
if(DEBUG){
  document.querySelectorAll('.debug-level-picker').forEach(el=>el.hidden=false);
  for(const which of ['bolt','heal','fireball']){
    for(const button of document.querySelectorAll(`[data-${which}-level]`)){
      button.addEventListener('click',()=>{
        p.levels[which]=Number(button.dataset[which+'Level']);
        say(`테스트: ${SPELLS[which].name} Lv${p.levels[which]}`,2);updateUI();
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
function drawEnemy(e,selected=false){
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
  if(selected){
    ctx.strokeStyle='#fff0a8';ctx.lineWidth=2;
    ctx.strokeRect(e.x-barW/2-2,y-2,barW+4,10);
    label(`${e.hp}/${e.max}`,e.x,y-13,14,'#fff0a8');
  }
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
    ctx.beginPath();ctx.arc(e.aim.x,e.aim.y,cfg.slamRadius,0,TWO);ctx.fill();ctx.stroke();
  }
  if(e.type==='boss'&&e.action==='windupDash'&&e.aim){
    const dx=e.aim.x-e.x,dy=e.aim.y-e.y,len=Math.hypot(dx,dy)||1;
    ctx.strokeStyle='#ff9074';ctx.lineWidth=2*(e.r+21);ctx.globalAlpha=.24;
    ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+dx/len*cfg.dashSpeed*cfg.dashDuration,e.y+dy/len*cfg.dashSpeed*cfg.dashDuration);ctx.stroke();ctx.globalAlpha=1;
  }
}
function draw(){
  const selected=mode==='target'&&spell==='bolt'&&!gameOver&&pointer?pickEnemyAt(worldPoint(pointer),enemies):null;
  C.style.cursor=mode==='target'&&!gameOver?(selected?'pointer':'crosshair'):'';
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#13243b';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#1e3652';ctx.lineWidth=1;
  for(let x=Math.floor(camera.x/48)*48;x<camera.x+W;x+=48){ctx.beginPath();ctx.moveTo(x-camera.x,0);ctx.lineTo(x-camera.x,H);ctx.stroke();}
  for(let y=Math.floor(camera.y/48)*48;y<camera.y+H;y+=48){ctx.beginPath();ctx.moveTo(0,y-camera.y);ctx.lineTo(W,y-camera.y);ctx.stroke();}
  ctx.save();ctx.translate(-camera.x,-camera.y);
  if(touchTarget)circle(touchTarget.x,touchTarget.y,9,null,'#729cbd',1);
  const fireballCenter=mode==='target'&&spell==='fireball'?(pointer?worldPoint(pointer):p):null;
  const fireballTargets=new Set(fireballCenter?resolveAreaHits(fireballCenter,enemies,activeCastConfig.radius,activeCastConfig.power).map(hit=>hit.enemy):[]);
  enemies.forEach(e=>drawEnemy(e,e===selected||fireballTargets.has(e)));
  if(fireballCenter){
    circle(fireballCenter.x,fireballCenter.y,activeCastConfig.radius,'#ff8d343f','#ffc18e',2);
    circle(fireballCenter.x,fireballCenter.y,3,'#ffe4b1');
  }
  for(const blast of explosions){
    ctx.save();ctx.globalAlpha=blast.ttl/.4;
    circle(blast.x,blast.y,blast.r,'#ff8d3480','#ffe1a0',3);ctx.restore();
  }
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
  if(mode==='target'){
    ctx.fillStyle='#0a1832aa';ctx.fillRect(0,0,W,43);
    label(spell==='fireball'?'파이어볼 대기 중 — 폭발시킬 위치를 클릭하세요':'번개 대기 중 — 공격할 적을 클릭하세요',W/2,23,19,'#ffedb3');
    if(selected)circle(selected.x-camera.x,selected.y-camera.y,selected.r+8,null,'#ffe388',3);
  }
  if(gameOver){
    ctx.fillStyle='#05101bcb';ctx.fillRect(0,0,W,H);
    label('GAME OVER',W/2,H/2-25,48);
    label(`생존 ${formatRunTime(runTimer.elapsedSeconds)} · Lv${progression.level} · ${kills}마리 처치`,W/2,H/2+35,20,'#c6d8ef');
    label('다시 시작 버튼이나 R 키를 누르세요',W/2,H/2+72,17,'#c6d8ef');
  }
}
function updateUI(){
  dom.kills.textContent=kills;
  dom.enemyCount.textContent=enemies.length;
  dom.runTime.textContent=formatRunTime(runTimer.elapsedSeconds);
  const xp=xpToNext(progression);
  dom.characterLevel.textContent=progression.level;
  dom.xpLabel.textContent=`${xp.current}/${xp.required}`;
  dom.xpFill.style.width=Math.min(100,xp.current/xp.required*100)+'%';
  const qSpeed=worldTimeMultiplier(mode,p);
  const showWarp=mode==='question'&&qSpeed<1;
  dom.slow.style.display=showWarp?'block':'none';
  dom.slow.textContent=showWarp?`풀이 중 세계 속도 ×${qSpeed.toFixed(2)}`:'';
  for(const k of ['bolt','heal','fireball']){
    const ready=p.cd[k]<=0,cdTotal=SPELLS[k].cooldownSeconds*cooldownMultiplier(p);
    const fill=100*clamp(1-p.cd[k]/cdTotal,0,1);
    dom[k].disabled=gameOver||mode!=='idle'||!ready;
    dom[k].classList.toggle('active',spell===k);dom[k].classList.toggle('ready',ready);
    dom[k+'Fill'].style.width=fill+'%';
    dom[k+'State'].textContent=`Lv${p.levels[k]} · `+(ready?'준비':p.cd[k].toFixed(1)+'초');
  }
  dom.cancel.disabled=gameOver||(mode!=='question'&&mode!=='target');
  dom.status.textContent=mode==='upgrade'?'레벨업 · 강화 하나 선택':mode==='victory'?'보스 격파 · 기록 완료':
    mode==='question'?(['bolt','fireball'].includes(spell)?'':'마법진: 정답 선택'):mode==='target'?(spell==='fireball'?'폭발 위치를 클릭':'적을 클릭해 발사'):gameOver?'게임 오버':
    `번개 Lv${p.levels.bolt} / 힐 Lv${p.levels.heal} / 파이어볼 Lv${p.levels.fireball}`;
  if(DEBUG){for(const which of ['bolt','heal','fireball']){
    for(const button of document.querySelectorAll(`[data-${which}-level]`)){
      const chosen=p.levels[which]===Number(button.dataset[which+'Level']);
      button.classList.toggle('selected',chosen);button.setAttribute('aria-pressed',String(chosen));
    }
  }}
  if(performance.now()>toastUntil&&dom.toast.textContent)dom.toast.textContent='';
}
function loop(ts){
  if(!last)last=ts;
  const rawDt=Math.max(0,(ts-last)/1000);last=ts;
  if(!document.hidden){
    advanceRunTimer(runTimer,rawDt,!gameOver&&mode!=='upgrade'&&mode!=='victory');
    tick(Math.min(.05,rawDt));updateRunePosition();draw();updateUI();
  }
  requestAnimationFrame(loop);
}
reset();requestAnimationFrame(loop);
})();
