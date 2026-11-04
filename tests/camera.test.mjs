import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { centeredCamera } from '../src/camera.js';

const viewport={w:960,h:600};
const world={w:3000,h:2200};

test('world view remains player-centered and fixed during casting and targeting',()=>{
  const player={x:1500,y:1100};
  const idle=centeredCamera(player,viewport,world);
  const question=centeredCamera(player,viewport,world);
  const target=centeredCamera(player,viewport,world);
  assert.deepEqual(idle,{x:1020,y:800});
  assert.deepEqual(question,idle);
  assert.deepEqual(target,idle);
  assert.equal(player.x-idle.x,480);
  assert.equal(player.y-idle.y,300);
});

test('camera clamps on world edges without changing viewport scale',()=>{
  assert.deepEqual(centeredCamera({x:0,y:0},viewport,world),{x:0,y:0});
  assert.deepEqual(centeredCamera({x:2999,y:2199},viewport,world),{x:2040,y:1600});
  assert.deepEqual(centeredCamera({x:100,y:100},{w:1200,h:700},{w:800,h:500}),{x:0,y:0});
});

test('game camera does not depend on spell mode or move left for rituals',()=>{
  const game=readFileSync(new URL('../src/game.js',import.meta.url),'utf8');
  const body=game.match(/function cameraUpdate\(\)\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body, 'cameraUpdate function found');
  assert.match(body,/centeredCamera\(p/);
  assert.doesNotMatch(body,/mode\s*===?\s*['"]question/);
  assert.doesNotMatch(body,/W\s*\*\s*\.42/);
});

test('pentagram tracks the hero in world coordinates regardless of camera clamping',()=>{
  const source=readFileSync(new URL('../src/game.js',import.meta.url),'utf8');
  assert.match(source,/runeFrame\.style\.left=\(\(p\.x-camera\.x\)\/W\*100\)/);
  assert.match(source,/runeFrame\.style\.top=\(\(p\.y-camera\.y\)\/H\*100\)/);
  assert.match(source,/updateRunePosition\(\);draw\(\);updateUI\(\)/);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/id="rune-frame"/);
});
test('three-term MathML uses exactly 30 percent larger text',()=>{
  const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
  assert.match(css,/data-terms="3"\] \.math-problem math\{font-size:18\.2px\}/);
  assert.match(css,/data-terms="3"\] \.answer-formula math\{font-size:14\.3px\}/);
});
