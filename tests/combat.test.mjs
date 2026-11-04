import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveChainTargets } from '../src/combat.js';

test('번개 Lv1은 한 개체만 선택',()=>{
  const a={x:0,y:0,hp:10},b={x:40,y:0,hp:10};
  assert.deepEqual(resolveChainTargets(a,[a,b],1,260),[a]);
});

test('번개 Lv2는 클릭한 적을 포함해 가까운 3개체까지만 연쇄',()=>{
  const a={x:0,y:0,hp:20},near={x:20,y:20,hp:20},far={x:90,y:0,hp:20};
  const extra={x:150,y:0,hp:20};
  const config=getSpellAtLevel('bolt',2);
  assert.deepEqual(resolveChainTargets(a,[a,far,near,extra],config.chainTargets,config.chainRange),[a,near,far]);
});

test('연쇄 범위 밖의 적·죽은 적은 제외하고 중복 타격하지 않는다',()=>{
  const a={x:0,y:0,hp:20},outside={x:300,y:0,hp:20},dead={x:10,y:10,hp:0};
  assert.deepEqual(resolveChainTargets(a,[a,outside,dead],2,260),[a]);
  assert.deepEqual(resolveChainTargets(a,[a,dead,dead],2,260),[a]);
});


test('번개 Lv3은 첫 대상을 포함해 5개체를 순차적으로 연쇄한다',()=>{
  const a={x:0,y:0,hp:20},b={x:100,y:0,hp:20},c={x:300,y:0,hp:20},out={x:850,y:0,hp:20};
  const d={x:500,y:0,hp:20},e={x:700,y:0,hp:20};
  const config=getSpellAtLevel('bolt',3);
  assert.deepEqual(resolveChainTargets(a,[a,c,b,out,e,d],config.chainTargets,config.chainRange),[a,b,c,d,e]);
});

import { resolveChainHits, healingGained } from '../src/combat.js';
import { getSpellAtLevel } from '../src/spells.js';

test('번개 1/2/3레벨은 1/3/5마리에게 레벨별 20/30/40 피해를 준다',()=>{
  const expected=[[20],[30,30,30],[40,40,40,40,40]];
  for(let level=1;level<=3;level++) {
    const config=getSpellAtLevel('bolt',level);
    const enemies=Array.from({length:6},(_,i)=>({x:i*80,y:0,hp:100}));
    const hits=resolveChainHits(enemies[0],enemies,config.damageByJump,config.chainRange);
    assert.deepEqual(config.damageByJump,expected[level-1]);
    assert.equal(config.chainTargets,expected[level-1].length);
    assert.deepEqual(hits.map(hit=>hit.damage),expected[level-1]);
    assert.deepEqual(hits.map(hit=>hit.enemy),enemies.slice(0,config.chainTargets));
    for (const {enemy,damage} of hits) enemy.hp=Math.max(0,enemy.hp-damage);
    assert.deepEqual(enemies.map(enemy=>enemy.hp), enemies.map((_,index)=>100-(expected[level-1][index]??0)));
    assert.equal(config.problem.termCount,level);
  }
});

test('연쇄 거리 밖인 적은 해당 타격 슬롯의 피해를 받지 않는다',()=>{
  const first={x:0,y:0,hp:100},outside={x:700,y:0,hp:100};
  const config=getSpellAtLevel('bolt',3);
  const hits=resolveChainHits(first,[first,outside],config.damageByJump,config.chainRange);
  assert.equal(hits.length,1);
  assert.equal(hits[0].damage,40);
});

test('Lv3 번개는 적이 부족하거나 같은 위치에 있어도 살아 있는 적마다 한 번만 타격한다',()=>{
  const first={x:0,y:0,hp:10},second={x:0,y:0,hp:100},dead={x:0,y:0,hp:0};
  const config=getSpellAtLevel('bolt',3);
  const hits=resolveChainHits(first,[first,second,second,dead],config.damageByJump,config.chainRange);
  assert.deepEqual(hits.map(hit=>hit.enemy),[first,second]);
  assert.deepEqual(hits.map(hit=>hit.damage),[40,40]);
});

test('힐은 20/50/80 회복하고 최대 HP를 넘기지 않는다',()=>{
  const expected=[20,50,80];
  for(let level=1;level<=3;level++){
    const heal=getSpellAtLevel('heal',level);
    assert.equal(heal.power,expected[level-1]);
    assert.equal(heal.problem.termCount,level);
    assert.equal(healingGained(20,100,heal.power),expected[level-1]);
    assert.equal(healingGained(99,100,heal.power),1);
    assert.equal(healingGained(100,100,heal.power),0);
  }
});
