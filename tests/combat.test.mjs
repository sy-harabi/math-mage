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
