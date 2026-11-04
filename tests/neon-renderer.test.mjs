import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnemy, ENEMY_TYPES } from '../src/enemy-types.js';
import { createLaserSegment } from '../src/laser.js';
import { drawNeonArena, drawNeonMage, drawNeonSlime, drawLaserWarning, drawNeonLaser, drawRockWarning } from '../src/neon-renderer.js';
import { PLAYER_HIT_RADIUS } from '../src/rock-slime.js';

function recordingContext(){
  const calls=[],strokes=[];let points=[],depth=0;
  const target={calls,strokes,lineWidth:1,
    save(){depth++;},restore(){depth--;assert.ok(depth>=0);},
    beginPath(){points=[];},moveTo(x,y){points.push([x,y]);},lineTo(x,y){points.push([x,y]);},
    stroke(){strokes.push({width:this.lineWidth,points:structuredClone(points)});},
  };
  return new Proxy(target,{get:(o,k)=>k==='depth'?depth:k in o?o[k]:(...args)=>{
    for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),`${String(k)} is finite`);
    calls.push({method:k,args});
  }});
}

test('laser warning footprint matches real hit geometry, including diagonal and vertical aims',()=>{
  const spec=ENEMY_TYPES.ranged;
  for(const aim of [{x:500,y:300},{x:100,y:600},{x:-100,y:-200}]){
    const e={...createEnemy('ranged',100,100,()=>.5),windup:.4,aim};
    const before=structuredClone(e),ctx=recordingContext();
    drawLaserWarning(ctx,e,spec);
    assert.deepEqual(e,before,'drawing never changes locked aim or attack state');
    const beam=createLaserSegment(e,aim,spec.laserRange);
    assert.deepEqual(ctx.strokes[0],{width:spec.laserWidth,points:[[beam.x1,beam.y1],[beam.x2,beam.y2]]});
    for(const rail of ctx.strokes.slice(1,3)){
      assert.ok(Math.abs(Math.hypot(rail.points[0][0]-e.x,rail.points[0][1]-e.y)-spec.laserWidth/2)<1e-9);
      assert.ok(Math.abs(Math.hypot(rail.points[1][0]-rail.points[0][0],rail.points[1][1]-rail.points[0][1])-spec.laserRange)<1e-9);
    }
    assert.equal(ctx.depth,0);
  }
});

test('laser slime lens tracks the locked aim during charge rather than the moving player',()=>{
  const e={...createEnemy('ranged',100,100,()=>.5),windup:.5,aim:{x:100,y:500}};
  const ctx=recordingContext();drawNeonSlime(ctx,e,{x:800,y:100});
  assert.ok(ctx.calls.some(c=>c.method==='rotate'&&c.args[0]===Math.PI/2));
  assert.equal(ctx.depth,0);
  const idle=recordingContext();drawLaserWarning(idle,{...e,windup:0},ENEMY_TYPES.ranged);
  assert.equal(idle.strokes.length,0);
});

test('every neon sprite and effect renders without changing game state or leaking canvas saves',()=>{
  const ctx=recordingContext(),p={x:480,y:300,face:0,inv:0};
  const before=structuredClone(p);
  drawNeonArena(ctx,{x:1000,y:800},960,600);
  for(const type of Object.keys(ENEMY_TYPES)){
    const e=createEnemy(type,300,300,()=>.5),snapshot=structuredClone(e);
    drawNeonSlime(ctx,e,p);assert.deepEqual(e,snapshot);
  }
  drawNeonMage(ctx,p,1000);assert.deepEqual(p,before);
  const laser={...createLaserSegment(p,{x:800,y:400},820),width:34};
  drawNeonLaser(ctx,laser);
  assert.equal(ctx.strokes.at(-2).width,34,'visible beam includes the full damage width');
  assert.equal(ctx.depth,0);
});

test('rock warning stays at locked landing point and shows the full hit boundary',()=>{
  const e={...createEnemy('rock',100,100,()=>.5),action:'windupJump',actionTimer:.35,aim:{x:350,y:300}};
  for(const action of ['windupJump','jump']){
    e.action=action;const before=structuredClone(e),ctx=recordingContext();
    drawRockWarning(ctx,e);
    const arcs=ctx.calls.filter(c=>c.method==='arc');
    assert.deepEqual(arcs[0].args.slice(0,3),[350,300,ENEMY_TYPES.rock.jumpRadius+PLAYER_HIT_RADIUS]);
    assert.deepEqual(e,before);assert.equal(ctx.depth,0);
  }
  const ctx=recordingContext();drawRockWarning(ctx,{...e,action:'recoverJump'});
  assert.equal(ctx.calls.length,0);
});
