import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const game=readFileSync(new URL('../src/game.js',import.meta.url),'utf8');
const stageStart=html.indexOf('<div id="stage">');
const stageEnd=html.indexOf('<!-- /#stage: touch controls overlay the actual game area -->');

test('every gameplay HUD element lives inside the battlefield',()=>{
  assert.ok(stageStart>=0 && stageEnd>stageStart);
  for(const id of ['game','health-meter','run-time','character-level','shield-count',
     'kills','enemies-count','xp-label','xp-meter','buttons','touch-joystick','joystick-thumb',
     'math-cast-hud','intro-overlay','upgrade-overlay','death-overlay','victory-overlay',
     'status','cancel','restart','debug-display-panel','stage-picker']){
    const index=html.indexOf('id="'+id+'"');
    assert.ok(index>stageStart && index<stageEnd, '#'+id+' is outside #stage');
  }
});

test('landscape and portrait mobile stages use the full browser viewport',()=>{
  assert.match(css,/html\.mobile-layout #stage\{inset:0;width:100%;height:100%\}/);
  assert.match(css,/html\.mobile-layout #stage canvas\{width:100%;height:100%;aspect-ratio:auto\}/);
  assert.match(css,/html\.mobile-layout #buttons\{z-index:5;top:auto;bottom:/);
  assert.match(css,/html\.mobile-layout \.touch-joystick\{position:absolute/);
  assert.doesNotMatch(html, /id="mobile-rotate-notice"/);
});

test('tap-to-move destination and marker are completely removed',()=>{
  assert.doesNotMatch(game,/touchTarget|manualMoveActive/);
  assert.doesNotMatch(game,/else\s+touchTarget/);
  assert.match(game,/if\(hit\)castEnemy\(hit\)/);
  assert.match(game,/if\(spell==='fireball'\)\{castFireball\(wp\);return;\}/);
});

test('touch movement, multiple pointers, and answer clicks remain available',()=>{
  const controls=readFileSync(new URL('../src/mobile-controls.js',import.meta.url),'utf8');
  assert.match(controls,/activePointer=ev\.pointerId/);
  assert.match(controls,/base\.setPointerCapture\(ev\.pointerId\)/);
  assert.match(game,/joystickInput\.x/);
  assert.match(game,/button\.addEventListener\('click',\(\)=>selectAnswer\(index\)\)/);
});
