import test from 'node:test';
import assert from 'node:assert/strict';
import { pickEnemyAt } from '../src/targeting.js';

test('hover and click pick the nearest living center within existing click margin',()=>{
  const a={x:100,y:100,r:21,hp:40}, b={x:125,y:100,r:16,hp:25};
  assert.equal(pickEnemyAt({x:105,y:100},[a,b]),a);
  assert.equal(pickEnemyAt({x:123,y:100},[a,b]),b);
  assert.equal(pickEnemyAt({x:139,y:100},[a]),a);
  assert.equal(pickEnemyAt({x:141,y:100},[a]),null);
  b.hp=0;
  assert.equal(pickEnemyAt({x:123,y:100},[a,b]),a);
});

test('empty space, pointer leave and no enemies have no selected target',()=>{
  const enemies=[{x:100,y:100,r:21,hp:40}];
  assert.equal(pickEnemyAt(null,enemies),null);
  assert.equal(pickEnemyAt({x:500,y:500},enemies),null);
  assert.equal(pickEnemyAt({x:100,y:100},[]),null);
});

test('equal-distance overlap picks one stable target',()=>{
  const a={x:100,y:100,r:21,hp:40}, b={...a};
  assert.equal(pickEnemyAt({x:100,y:100},[a,b]),a);
});
