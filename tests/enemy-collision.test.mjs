import test from 'node:test';
import assert from 'node:assert/strict';
import { separateEnemies } from '../src/enemy-collision.js';
import { resolveChainTargets } from '../src/combat.js';

const world = {w:3000,h:2200};
const enemy = (x,y,type='basic',r=21) => ({x,y,type,r,hp:40});
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const settle = (enemies,frames=120,dt=1/60) => {
  for(let i=0;i<frames;i++)separateEnemies(enemies,dt,world);
};

test('overlapping monsters separate gradually, retaining slight visual overlap',()=>{
  const enemies=[enemy(500,500),enemy(510,500)];
  separateEnemies(enemies,1/60,world);
  assert.ok(distance(...enemies)>10 && distance(...enemies)<20);
  settle(enemies);
  assert.ok(Math.abs(distance(...enemies)-35.7)<.01);
  assert.ok(Math.abs(enemies[0].x+enemies[1].x-1010)<1e-9);
  assert.equal(resolveChainTargets(enemies[0],enemies,2,260).length,2);
});

test('matching spawn centers separate deterministically without NaN',()=>{
  const a=[enemy(500,500),enemy(500,500)];
  const b=structuredClone(a);
  settle(a);settle(b);
  assert.deepEqual(a,b);
  assert.ok(distance(...a)>35);
});

test('a moving rear enemy pushes the front enemy instead of queueing',()=>{
  const enemies=[enemy(500,500),enemy(465,500)];
  for(let i=0;i<60;i++){
    enemies[1].x+=100/60;
    separateEnemies(enemies,1/60,world);
  }
  assert.ok(enemies[0].x>535);
  assert.ok(enemies[1].x<enemies[0].x);
});

test('normal enemies yield to boss without moving its telegraph or dash position',()=>{
  for(const action of ['chase','windupSlam','windupDash','dash']){
    const boss={...enemy(500,500,'boss',45),action,aim:{x:650,y:500}};
    const crowd=[boss,enemy(510,500)];
    settle(crowd);
    assert.deepEqual(boss,{...enemy(500,500,'boss',45),action,aim:{x:650,y:500}});
    assert.ok(distance(...crowd)>56);
  }
});

test('non-overlapping enemies and paused world remain unchanged',()=>{
  const enemies=[enemy(500,500),enemy(700,500)];
  const original=structuredClone(enemies);
  separateEnemies(enemies,1/60,world);
  assert.deepEqual(enemies,original);
  enemies[1].x=500;
  const paused=structuredClone(enemies);
  separateEnemies(enemies,0,world);
  assert.deepEqual(enemies,paused);
});

test('crowds crossing spatial cells separate and stay inside map boundaries',()=>{
  const crowd=Array.from({length:48},(_,i)=>enemy(22+(i%8)*4,22+Math.floor(i/8)*4));
  settle(crowd,180);
  for(const e of crowd){
    assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.y));
    assert.ok(e.x>=e.r && e.x<=world.w-e.r && e.y>=e.r && e.y<=world.h-e.r);
  }
  assert.ok(Math.max(...crowd.map(e=>e.x))>100);
  assert.ok(Math.max(...crowd.map(e=>e.y))>100);
});

test('separation converges across frame rates and follows world slowdown',()=>{
  const low=[enemy(500,500),enemy(510,500)],high=structuredClone(low),slow=structuredClone(low);
  separateEnemies(high,1/60,world);separateEnemies(slow,.4/60,world);
  assert.ok(distance(...slow)<distance(...high));
  settle(low,60,1/30);settle(high,240,1/120);
  assert.ok(Math.abs(distance(...low)-distance(...high))<.01);
});
