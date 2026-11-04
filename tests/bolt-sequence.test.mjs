import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBoltSequence, answerBolt } from '../src/bolt-sequence.js';
import { getSpellAtLevel } from '../src/spells.js';
import { derivativeOf, termKey } from '../src/monomial.js';
import { polynomialKey } from '../src/polynomial.js';
import { boltSequenceMathML } from '../src/math-ui.js';

function seeded(seed) { return () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296); }

test('all bolt ranks assemble exact derivatives from five fixed unique single-term runes',()=>{
  for(let level=1;level<=3;level++)for(let seed=0;seed<250;seed++){
    const sequence=generateBoltSequence(getSpellAtLevel('bolt',level).problem,seeded(seed));
    const q=sequence.question,choices=q.choices;
    assert.equal(choices.length,5);
    assert.equal(new Set(q.data.choiceTerms.map(termKey)).size,5);
    assert.ok(q.data.choiceTermPolys.every(poly=>poly.length===1));
    assert.equal(sequence.correctIndices.length,level);
    for(let i=0;i<level;i++){
      assert.equal(q.correct,sequence.correctIndices[i]);
      assert.equal(answerBolt(sequence,q.correct),i===level-1?'complete':'next');
      assert.strictEqual(q.choices,choices);
      assert.equal(sequence.selectedTerms.length,i+1);
    }
    assert.equal(sequence.complete,true);
    assert.equal(polynomialKey(sequence.selectedTerms),polynomialKey(q.data.inputTerms.map(t=>derivativeOf(t.num,t.power))));
    assert.equal(answerBolt(sequence,sequence.correctIndices[0]),'inactive');
  }
});

test('wrong first, middle or last rune irreversibly fails; out-of-order correct terms also fail',()=>{
  for(let position=0;position<3;position++){
    const sequence=generateBoltSequence(getSpellAtLevel('bolt',3).problem,seeded(position));
    for(let i=0;i<position;i++)assert.equal(answerBolt(sequence,sequence.correctIndices[i]),'next');
    assert.equal(answerBolt(sequence,(sequence.correctIndices[position]+1)%5),'failed');
    assert.equal(sequence.selectedTerms.length,position);
    assert.equal(sequence.failed,true);assert.equal(sequence.complete,false);
    assert.equal(answerBolt(sequence,sequence.correctIndices[position]),'inactive');
  }
  const sequence=generateBoltSequence(getSpellAtLevel('bolt',3).problem,seeded(42));
  assert.equal(answerBolt(sequence,sequence.correctIndices[1]),'failed');
});

test('constant terms disappear and progress follows the remaining derivative terms',()=>{
  for(const termCount of [2,3])for(let seed=0;seed<100;seed++){
    const sequence=generateBoltSequence({...getSpellAtLevel('bolt',3).problem,
      termCount,exponent:{min:0,max:termCount-1}},seeded(seed));
    assert.equal(sequence.question.data.inputTerms.length,termCount);
    assert.equal(sequence.correctIndices.length,termCount-1);
    assert.equal(sequence.question.choices.length,5);
    assert.match(boltSequenceMathML(sequence),new RegExp(`aria-valuemax="${termCount-1}"`));
    for(let i=0;i<termCount-1;i++){
      assert.equal(sequence.question.data.inputTerms[sequence.sourceIndices[i]].power,termCount-1-i);
      assert.equal(answerBolt(sequence,sequence.correctIndices[i]),i===termCount-2?'complete':'next');
    }
    assert.equal(polynomialKey(sequence.selectedTerms),polynomialKey(sequence.question.data.inputTerms.map(t=>derivativeOf(t.num,t.power))));
  }
});

test('constant functions finish with a single 0 rune and never create a negative exponent',()=>{
  assert.deepEqual(derivativeOf(5,0),{num:0,den:1,power:0});
  for(let seed=0;seed<50;seed++){
    const sequence=generateBoltSequence({...getSpellAtLevel('bolt',1).problem,
      exponent:{min:0,max:0}},seeded(seed));
    assert.equal(sequence.correctIndices.length,1);
    assert.equal(sequence.question.choices[sequence.question.correct],'0');
    assert.equal(sequence.question.data.choiceTerms.filter(t=>t.num===0).length,1);
    assert.equal(answerBolt(sequence,sequence.question.correct),'complete');
    assert.equal(polynomialKey(sequence.selectedTerms),'0');
  }
});

test('central MathML appends signed terms and advances visual charge without placeholder boxes',()=>{
  const sequence=generateBoltSequence({...getSpellAtLevel('bolt',3).problem,
    coefficient:{min:-5,max:-1}},seeded(7));
  const before=boltSequenceMathML(sequence);
  assert.doesNotMatch(before,/□|왼쪽 항부터|한 번 틀리면/);
  assert.match(before,/aria-valuenow="0"/);
  assert.match(before,/aria-valuemax="3"/);
  assert.match(before,/bolt-current-term/);
  answerBolt(sequence,sequence.question.correct);
  const after=boltSequenceMathML(sequence);
  assert.doesNotMatch(after,/□/);
  assert.match(after,/aria-valuenow="1"/);
  assert.match(after,/bolt-step is-filled/);
  assert.match(after,/<mo>−<\/mo>/);
  assert.notEqual(after,before);
});
