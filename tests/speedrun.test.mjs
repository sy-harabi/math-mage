import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunTimer, advanceRunTimer, finishRunTimer, formatRunTime } from '../src/speedrun.js';
import {polynomialMathML,problemMathML} from '../src/math-ui.js';
import {term} from '../src/monomial.js';
import {getSpellAtLevel} from '../src/spells.js';
import {generateQuestion} from '../src/problem-engine.js';

test('speedrun uses real seconds, pauses when inactive and remains frozen at victory',()=>{
  const timer=createRunTimer();
  advanceRunTimer(timer, 20.15);advanceRunTimer(timer, 4.4, false);
  advanceRunTimer(timer, 40.08);
  assert.equal(formatRunTime(timer.elapsedSeconds),'01:00.23');
  finishRunTimer(timer);advanceRunTimer(timer,99);
  assert.equal(formatRunTime(timer.elapsedSeconds),'01:00.23');
  assert.throws(()=>advanceRunTimer(timer,-1));
});

test('native MathML keeps real fraction markup and polynomial signs without canvas wrap',()=>{
  const markup=polynomialMathML([term(-5,3,3),term(4,1,1)],true);
  assert.match(markup,/<math/);
  assert.match(markup,/<mfrac><mn>5<\/mn><mn>3<\/mn><\/mfrac>/);
  assert.match(markup,/<mo>−<\/mo>/);
  assert.match(markup,/<mi>C<\/mi>/);
  const question=generateQuestion(getSpellAtLevel('bolt',3).problem);
  assert.equal(question.data.inputTerms.length,3);
  assert.match(problemMathML(question,'bolt'),/f/);
});

test('boss has wider telegraphed slam and longer, faster dash than the prior build',async()=>{
  const {ENEMY_TYPES}=await import('../src/enemy-types.js');
  const boss=ENEMY_TYPES.boss;
  assert.ok(boss.speed>102);
  assert.ok(boss.slamRadius>130);
  assert.ok(boss.dashSpeed*boss.dashDuration>470*.7);
  assert.ok(boss.dashWindup>=.75,'warn before the faster dash');
});

test('displayed page contains no stage number or progress bar; Math HUD and victory panel exist', async()=>{
  const fs=await import('node:fs/promises');
  const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(!html.includes('id="stage-number"'));
  assert.ok(!html.includes('id="stage-meter"'));
  assert.ok(html.includes('id="victory-time"'));
  assert.ok(html.includes('id="math-cast-hud"'));
});
