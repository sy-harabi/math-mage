import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgression, xpForLevel, addXp, xpToNext } from '../src/progression.js';
import { createStage, addStageTime, addStageKill, bossShouldSpawn, stageIsComplete } from '../src/stage-director.js';
import { ENEMY_TYPES, createEnemy } from '../src/enemy-types.js';
import { stageSpawnConfig, randomEnemyType, chooseSpawnPosition } from '../src/spawn-director.js';
import { selectUpgradeChoices, applyUpgrade, cooldownMultiplier, movementMultiplier } from '../src/upgrades.js';
import { SPELLS, getSpellAtLevel } from '../src/spells.js';
import { generateQuestion } from '../src/problem-engine.js';

function mockPlayer(){return {levels:{bolt:1,heal:1},maxHp:100,hp:80,
  bonuses:{swiftness:0,vitality:0,focus:0}};}

test('XP thresholds 24, 52, 100, 168, 256 and carried XP',()=>{
  assert.deepEqual(Array.from({length:6},(_,i)=>xpForLevel(i+1)),[0,24,52,100,168,256]);
  const xp=createProgression();
  assert.equal(addXp(xp,23),0);assert.equal(xp.level,1);
  assert.equal(addXp(xp,1),1);assert.equal(xp.pendingUpgrades,1);
  assert.equal(addXp(xp,80),2);assert.equal(xp.level,4);
  assert.equal(xp.pendingUpgrades,3);
  assert.deepEqual(xpToNext(xp),{current:4,required:68});
});

test('stage gauge: 0.6% per second; kill bonus independent from XP',()=>{
  const stage=createStage(1);
  addStageTime(stage,50);assert.equal(stage.progress,30);
  addStageKill(stage,{type:'basic',stageProgress:6});assert.equal(stage.progress,36);
  assert.equal(stage.kills,1);
  addStageTime(stage,107);assert.equal(stage.progress,100);
  assert.ok(stageIsComplete(stage));
});

test('boss: spawns at 70%, cannot complete until slain; no cap on normal kills',()=>{
  const stage=createStage(5);
  addStageTime(stage,110);assert.equal(stage.progress,66);
  assert.equal(bossShouldSpawn(stage),false);
  addStageKill(stage,{type:'fast',stageProgress:7});
  assert.equal(bossShouldSpawn(stage),true);
  stage.bossSpawned=true;
  addStageTime(stage,200);
  assert.equal(stage.progress,99);assert.equal(stageIsComplete(stage),false);
  for(let i=0;i<100;i++)addStageKill(stage,{type:'basic',stageProgress:6});
  assert.equal(stage.progress,99);assert.equal(stage.kills,101);
  addStageKill(stage,{type:'boss',stageProgress:30});
  assert.equal(stage.progress,100);assert.equal(stageIsComplete(stage),true);
});

test('enemy types: HP, XP, speeds, attack, and stage scaling',()=>{
  assert.deepEqual(['basic','fast','ranged','boss'].map(t=>ENEMY_TYPES[t].xp),[6,8,10,50]);
  assert.deepEqual(['basic','fast','ranged','boss'].map(t=>ENEMY_TYPES[t].hp),[40,25,30,260]);
  assert.deepEqual(['basic','fast','ranged','boss'].map(t=>ENEMY_TYPES[t].stageProgress),[6,7,8,30]);
  const e=createEnemy('fast',10,20,()=>.5,1);
  assert.equal(e.hp,25);assert.equal(e.speed,135);assert.equal(e.damage,8);
  const e6=createEnemy('fast',10,20,()=>.5,6);
  assert.ok(e6.hp>e.hp);
});

test('spawn intervals and weighted monster selection',()=>{
  assert.deepEqual([1,2,3,4,5].map(s=>stageSpawnConfig(s).interval),[10,8,7,6,12]);
  assert.equal(randomEnemyType(stageSpawnConfig(1),()=>.9),'basic');
  assert.equal(randomEnemyType(stageSpawnConfig(2),()=>.71),'fast');
  assert.equal(randomEnemyType(stageSpawnConfig(3),()=>.9),'ranged');
  assert.ok(stageSpawnConfig(15).interval>0);
});

test('spawn points are generally outside the camera, never on top of player',()=>{
  const world={w:3000,h:2200},view={w:960,h:600};
  const hero={x:1500,y:1100},camera={x:1020,y:800};
  for(let i=0;i<100;i++){
    const pos=chooseSpawnPosition(hero,camera,world,view);
    assert.ok(Math.hypot(pos.x-hero.x,pos.y-hero.y)>280);
    assert.ok(pos.x<camera.x||pos.x>camera.x+view.w||pos.y<camera.y||pos.y>camera.y+view.h);
  }
});

test('XP level choices contain skills when available and exclude shield',()=>{
  const p=mockPlayer();
  const choices=selectUpgradeChoices(p,()=>.5);
  assert.equal(choices.length,3);
  assert.ok(choices.some(x=>x.id==='bolt'));
  assert.ok(choices.some(x=>x.id==='heal'));
  assert.ok(!choices.some(x=>/shield/i.test(x.id)));
  assert.ok(applyUpgrade(p,'bolt'));
  assert.equal(p.levels.bolt,2);
  assert.equal(getSpellAtLevel('bolt',2).problem.termCount,2);
  const question=generateQuestion(getSpellAtLevel('bolt',2).problem);
  assert.equal(question.data.inputTerms.length,2);
  assert.ok(applyUpgrade(p,'heal'));
  assert.equal(getSpellAtLevel('heal',p.levels.heal).problem.termCount,2);
  assert.ok(applyUpgrade(p,'bolt'));
  assert.equal(p.levels.bolt,3);
  assert.ok(!applyUpgrade(p,'bolt'));
  assert.equal(p.levels.bolt,3);
});

test('passive bonuses are cumulative and capped',()=>{
  const p=mockPlayer();
  assert.ok(applyUpgrade(p,'vitality'));assert.equal(p.maxHp,115);assert.equal(p.hp,95);
  assert.ok(applyUpgrade(p,'swiftness'));assert.equal(movementMultiplier(p),1.08);
  assert.ok(applyUpgrade(p,'focus'));assert.ok(Math.abs(cooldownMultiplier(p)-.93)<1e-12);
  for(let i=1;i<5;i++)applyUpgrade(p,'focus');
  assert.ok(Math.abs(cooldownMultiplier(p)-.65)<1e-12);
  assert.ok(!applyUpgrade(p,'focus'));
});
