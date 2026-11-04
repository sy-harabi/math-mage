import test from 'node:test';
import assert from 'node:assert/strict';
import {createLaserSegment,laserHitsPoint} from '../src/laser.js';

test('레이저는 조준 시 고정한 방향으로 820px 연장된다',()=>{
  const beam=createLaserSegment({x:100,y:100},{x:200,y:100},820);
  assert.deepEqual(beam,{x1:100,y1:100,x2:920,y2:100});
  assert.deepEqual(createLaserSegment({x:100,y:100},{x:100,y:200},120),{x1:100,y1:100,x2:100,y2:220});
});

test('레이저는 바닥 예고 폭(34px)과 마법사 반경(18px)에 따라 판정된다',()=>{
  const laser=createLaserSegment({x:0,y:0},{x:100,y:0},200);
  assert.equal(laserHitsPoint(laser,{x:100,y:0},34,18),true);
  assert.equal(laserHitsPoint(laser,{x:100,y:35},34,18),true);
  assert.equal(laserHitsPoint(laser,{x:100,y:36},34,18),false);
  assert.equal(laserHitsPoint(laser,{x:240,y:0},34,18),false);
  assert.equal(laserHitsPoint(laser,{x:-40,y:0},34,18),false);
});

test('영 거리 레이저와 잘못된 범위 입력도 안전하게 처리한다',()=>{
  assert.throws(()=>createLaserSegment({x:0,y:0},{x:1,y:1},0),/positive/);
  assert.equal(laserHitsPoint({x1:5,y1:5,x2:5,y2:5},{x:5,y:5},34,18),true);
});
