import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveChainTargets } from '../src/combat.js';

test('번개 Lv1은 한 개체만 선택',()=>{
  const a={x:0,y:0,hp:10},b={x:40,y:0,hp:10};
  assert.deepEqual(resolveChainTargets(a,[a,b],1,260),[a]);
});

test('번개 Lv2는 클릭한 적을 포함해 가까운 2개체까지만 연쇄',()=>{
  const a={x:0,y:0,hp:20},near={x:20,y:20,hp:20},far={x:90,y:0,hp:20};
  assert.deepEqual(resolveChainTargets(a,[a,far,near],2,260),[a,near]);
});

test('연쇄 범위 밖의 적·죽은 적은 제외하고 중복 타격하지 않는다',()=>{
  const a={x:0,y:0,hp:20},outside={x:300,y:0,hp:20},dead={x:10,y:10,hp:0};
  assert.deepEqual(resolveChainTargets(a,[a,outside,dead],2,260),[a]);
  assert.deepEqual(resolveChainTargets(a,[a,dead,dead],2,260),[a]);
});


test('번개 Lv3은 첫 대상을 포함해 3개체를 순차적으로 연쇄한다',()=>{
  const a={x:0,y:0,hp:20},b={x:100,y:0,hp:20},c={x:300,y:0,hp:20},out={x:850,y:0,hp:20};
  assert.deepEqual(resolveChainTargets(a,[a,c,b,out],3,260),[a,b,c]);
});

import { resolveChainHits, healingGained } from '../src/combat.js';
import { getSpellAtLevel } from '../src/spells.js';

test('번개 1/2/3레벨은 타격 순서별로 20 / 30·20 / 40·30·20 피해',()=>{
  const expected=[[20],[30,20],[40,30,20]];
  for(let level=1;level<=3;level++) {
    const config=getSpellAtLevel('bolt',level);
    const a={x:0,y:0,hp:100},b={x:80,y:0,hp:100},c={x:160,y:0,hp:100};
    const hits=resolveChainHits(a,[a,b,c],config.damageByJump,config.chainRange);
    assert.deepEqual(config.damageByJump,expected[level-1]);
    assert.equal(config.chainTargets,expected[level-1].length);
    assert.deepEqual(hits.map(hit=>hit.damage),expected[level-1]);
    assert.deepEqual(hits.map(hit=>hit.enemy),[a,b,c].slice(0,level));
    for (const {enemy,damage} of hits) enemy.hp=Math.max(0,enemy.hp-damage);
    assert.deepEqual([a.hp,b.hp,c.hp], [a,b,c].map((_,index)=>100-(expected[level-1][index]??0)));
  }
});

test('연쇄 거리 밖인 적은 해당 타격 슬롯의 피해를 받지 않는다',()=>{
  const first={x:0,y:0,hp:100},outside={x:700,y:0,hp:100};
  const hits=resolveChainHits(first,[first,outside],[40,30,20],260);
  assert.equal(hits.length,1);
  assert.equal(hits[0].damage,40);
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
