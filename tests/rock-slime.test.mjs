import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnemy, ENEMY_TYPES } from '../src/enemy-types.js';
import { updateRockSlime, PLAYER_HIT_RADIUS } from '../src/rock-slime.js';
import { stageSpawnConfig, randomEnemyType } from '../src/spawn-director.js';
import { separateEnemies } from '../src/enemy-collision.js';
import { pickEnemyAt } from '../src/targeting.js';

const world={w:3000,h:2200};
const rock=(stage=5)=>createEnemy('rock',500,500,()=>.5,stage);
const step=(e,p,dt=.05)=>updateRockSlime(e,p,dt,world);
function prepare(e,p){e.jumpCooldown=0;assert.equal(step(e,p),null);assert.equal(e.action,'windupJump');}
function launch(e,p){for(let i=0;i<14;i++)step(e,p);assert.equal(e.action,'jump');}
function land(e,p){let event;for(let i=0;i<30&&e.action==='jump';i++)event=step(e,p);assert.equal(event.type,'landing');return event;}

test('rock is introduced only in stage 5, with a 2-second late-game spawn interval',()=>{
  for(let stage=1;stage<5;stage++)assert.equal(stageSpawnConfig(stage).weights.rock,undefined);
  for(const [stage,weights] of [[5,[.25,.35,.25,.15]],[6,[.2,.3,.25,.25]],[7,[.2,.3,.3,.2]]]){
    const config=stageSpawnConfig(stage);
    assert.equal(config.interval,2);
    assert.deepEqual(Object.values(config.weights),weights);
    assert.equal(randomEnemyType(config,()=>.999),'rock');
    assert.equal(Object.values(config.weights).reduce((a,b)=>a+b),1);
  }
});

test('rock stats retain tier scaling and boss walks at 160 without changing its dash',()=>{
  assert.equal(rock().hp,60);assert.equal(rock(6).hp,68);assert.equal(rock(7).hp,68);
  assert.equal(rock().speed,115);assert.equal(rock().damage,20);assert.equal(rock().jumpDamage,24);
  assert.equal(rock(7).jumpDamage,26);assert.equal(ENEMY_TYPES.boss.speed,160);
  assert.equal(ENEMY_TYPES.boss.dashSpeed,900);
});

test('warning locks the capped landing point; flight travels at 700 and hits only once on landing',()=>{
  const e=rock(),p={x:1000,y:500};prepare(e,p);
  assert.deepEqual(e.aim,{x:920,y:500});
  p.y=800;launch(e,p);
  assert.deepEqual(e.aim,{x:920,y:500});assert.equal(e.jumpDuration,.6);
  const x=e.x;assert.equal(step(e,p),null);
  assert.ok(Math.abs(e.x-x-35)<1e-9);assert.ok(e.jumpHeight>0);
  const event=land(e,p);assert.equal(event.hit,false);assert.equal(e.jumpHeight,0);
  assert.deepEqual([e.x,e.y],[920,500]);assert.equal(e.jumpCooldown,4);
  for(let i=0;i<12;i++)assert.equal(step(e,{x:e.x,y:e.y}),null);
  assert.equal(e.action,'chase');
});

test('landing damage matches the warning boundary including player radius',()=>{
  for(const [offset,hit] of [[0,true],[65+PLAYER_HIT_RADIUS,true],[65+PLAYER_HIT_RADIUS+.01,false]]){
    const e=rock(7),p={x:800,y:500};prepare(e,p);launch(e,p);
    p.x+=offset;
    const event=land(e,p);assert.equal(event.hit,hit);assert.equal(event.damage,26);
  }
});

test('cooldown starts at landing, includes recovery, and waits the full 4 seconds',()=>{
  const e=rock(),p={x:800,y:500};prepare(e,p);launch(e,p);land(e,p);
  const start={x:e.x,y:e.y};p.x=1200;
  for(let i=0;i<12;i++)step(e,p);
  assert.deepEqual({x:e.x,y:e.y},start);assert.equal(e.action,'chase');
  for(let i=0;i<67;i++){p.x=e.x+300;step(e,p);assert.equal(e.action,'chase');}
  assert.ok(e.jumpCooldown>0);
  step(e,p);assert.equal(e.action,'windupJump');
});

test('spawn cooldown prevents an instant jump; near/far targets use normal pursuit or melee',()=>{
  const e=rock();step(e,{x:800,y:500});assert.equal(e.action,'chase');assert.equal(e.x,505.75);
  for(const x of [600,1100]){
    const e=rock();e.jumpCooldown=0;step(e,{x,y:500});assert.equal(e.action,'chase');
  }
  const contact=rock();contact.jumpCooldown=0;
  assert.deepEqual(step(contact,{x:500,y:500}),{type:'melee',damage:20});
  assert.equal(contact.attack,1.5);
});

test('jumping bypasses crowd collisions while warning and recovery remain anchored',()=>{
  for(const action of ['windupJump','jump','recoverJump']){
    const e=rock();e.action=action;
    const basic=createEnemy('basic',500,500,()=>.5);
    separateEnemies([e,basic],.05,world);
    assert.deepEqual([e.x,e.y],[500,500]);
    if(action==='jump')assert.deepEqual([basic.x,basic.y],[500,500]);
  }
});

test('locked jumps stay in the world and airborne sprite can still be selected',()=>{
  const e=createEnemy('rock',100,100,()=>.5,5),p={x:0,y:300};prepare(e,p);
  assert.equal(e.aim.x,e.r);assert.equal(e.aim.y,300);
  launch(e,p);step(e,p,.15);
  assert.ok(e.jumpHeight>80);
  assert.equal(pickEnemyAt({x:e.x,y:e.y-e.jumpHeight},[e],0),e);
  assert.equal(pickEnemyAt({x:e.x,y:e.y},[e],0),null);
  land(e,p);assert.ok(e.x>=e.r&&e.y>=e.r);
});
