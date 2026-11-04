import test from 'node:test';
import assert from 'node:assert/strict';
import { term, termKey } from '../src/monomial.js';
import { generateIntegralSequence, answerIntegral } from '../src/integral-sequence.js';
import { integralSequenceMathML, integralChoiceMathML } from '../src/math-ui.js';
import { getSpellAtLevel } from '../src/spells.js';
import { resolveAreaHits } from '../src/combat.js';
import { applyUpgrade, selectUpgradeChoices } from '../src/upgrades.js';
const seeded=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);

test('6000 ranked indefinite integrals differentiate back to their source and refresh five unique runes at every step',()=>{
  for(let level=1;level<=3;level++)for(let seed=0;seed<2000;seed++){
    const seq=generateIntegralSequence(getSpellAtLevel('fireball',level).problem,seeded(seed));
    assert.equal(seq.question.data.inputTerms.length,level);
    assert.equal(seq.stages.length,level+1);
    for(let step=0;step<=level;step++){
      const q=seq.question;
      assert.equal(q.choices.length,5);assert.equal(new Set(q.choices).size,5);
      assert.equal(q.choices[q.correct],q.answer);
      if(step<level){
        const source=q.data.inputTerms[step],primitive=q.data.choiceTerms[q.correct];
        assert.equal(q.data.choiceKinds[q.correct],'term');
        assert.equal(primitive.power-1,source.power);
        assert.equal(primitive.num*primitive.power*source.den,source.num*primitive.den);
      }else{
        assert.equal(seq.complete,false,'all polynomial terms alone must NOT cast');
        assert.equal(seq.selectedConstant,false);
        assert.equal(q.data.choiceKinds[q.correct],'constant');
        assert.equal(q.answer,'+ C');
      }
      const oldChoices=q.choices;
      assert.equal(answerIntegral(seq,q.correct),step===level?'complete':'next');
      if(step<level){assert.notStrictEqual(q.choices,oldChoices);assert.notDeepEqual(q.choices,oldChoices);}
    }
    assert.equal(seq.selectedTerms.length,level);assert.equal(seq.selectedConstant,true);
    assert.equal(seq.complete,true);assert.equal(answerIntegral(seq,0),'inactive');
  }
});

test('constants integrate to ax, fractional primitives stay exact, and premature +C fails',()=>{
  const base=getSpellAtLevel('fireball',1).problem;
  const seq=generateIntegralSequence({...base,coefficient:{min:3,max:3},exponent:{min:0,max:0}},()=>.25);
  assert.deepEqual(seq.question.data.answerTerms,[term(3,1,1)]);
  const premature=seq.question.data.choiceKinds.indexOf('constant');
  assert.equal(answerIntegral(seq,premature),'failed');assert.equal(answerIntegral(seq,seq.question.correct),'inactive');
  const fraction=generateIntegralSequence({...base,coefficient:{min:1,max:1},exponent:{min:2,max:2}},()=>.25);
  assert.deepEqual(fraction.question.data.answerTerms,[term(1,3,3)]);
  assert.match(integralChoiceMathML(fraction.question,fraction.question.correct),/<mfrac>/);
  assert.equal(answerIntegral(fraction,fraction.question.correct),'next');
  assert.equal(answerIntegral(fraction,fraction.question.correct),'complete');
  assert.equal(fraction.selectedConstant,true);
});

test('a wrong first, middle or final +C selection permanently fails the entire cast',()=>{
  for(let position=0;position<4;position++){
    const seq=generateIntegralSequence(getSpellAtLevel('fireball',3).problem,seeded(position));
    for(let i=0;i<position;i++)assert.equal(answerIntegral(seq,seq.question.correct),'next');
    assert.equal(answerIntegral(seq,(seq.question.correct+1)%5),'failed');
    assert.equal(answerIntegral(seq,seq.question.correct),'inactive');
    assert.equal(seq.failed,true);assert.equal(seq.complete,false);
  }
});

test('MathML has no integration bounds or boxes; +C appears exactly once only after its own selection',()=>{
  const seq=generateIntegralSequence(getSpellAtLevel('fireball',3).problem,seeded(8));
  const before=integralSequenceMathML(seq);
  assert.match(before,/<mo>∫<\/mo>/);assert.doesNotMatch(before,/<msubsup>|□|<mi>C<\/mi>/);
  assert.match(before,/aria-valuemax="4"/);assert.match(before,/integral-current-term/);
  for(let i=0;i<3;i++){
    answerIntegral(seq,seq.question.correct);
    assert.doesNotMatch(integralSequenceMathML(seq),/<mi>C<\/mi>/);
  }
  const cMarkup=integralChoiceMathML(seq.question,seq.question.correct);
  assert.match(cMarkup,/<mo>\+<\/mo><mi>C<\/mi>/);assert.doesNotMatch(cMarkup,/<mn>0<\/mn>/);
  answerIntegral(seq,seq.question.correct);
  assert.equal((integralSequenceMathML(seq).match(/<mi>C<\/mi>/g)??[]).length,1);
  assert.match(integralSequenceMathML(seq),/aria-valuenow="4"/);
});

test('fireball retains radius 42, damage 10/30/70 and indefinite polynomial term counts 1/2/3',()=>{
  for(let level=1;level<=3;level++){
    const config=getSpellAtLevel('fireball',level);
    assert.equal(config.radius,42);assert.equal(config.power,[10,30,70][level-1]);
    assert.equal(config.problem.termCount,level);assert.equal(config.problem.kind,'monomialIntegral');
  }
});

test('area hits include intersecting hitboxes, exclude dead/outside, and deduplicate',()=>{
  const center={x:100,y:100};
  const middle={x:100,y:100,r:21,hp:100};
  const edge={x:163,y:100,r:21,hp:100};
  const outside={x:163.01,y:100,r:21,hp:100};
  const dead={x:100,y:100,r:21,hp:0};
  const hits=resolveAreaHits(center,[middle,edge,outside,dead,edge],42,70);
  assert.deepEqual(hits.map(h=>h.enemy),[middle,edge]);
  for(const {enemy,damage} of hits)enemy.hp-=damage;
  assert.equal(middle.hp,30);assert.equal(edge.hp,30);assert.equal(outside.hp,100);
  assert.deepEqual(resolveAreaHits({x:0,y:0},[middle],42,10),[]);
});

test('fireball upgrades cap at Lv3 and retain passive upgrade choices',()=>{
  const p={levels:{bolt:1,heal:1,fireball:1},bonuses:{}};let offered=false;
  for(let seed=0;seed<20;seed++){
    const choices=selectUpgradeChoices(p,seeded(seed));
    assert.equal(choices.length,3);assert.ok(choices.some(q=>!['bolt','heal','fireball'].includes(q.id)));
    offered ||= choices.some(q=>q.id==='fireball');
  }
  assert.ok(offered);assert.ok(applyUpgrade(p,'fireball'));assert.ok(applyUpgrade(p,'fireball'));
  assert.equal(p.levels.fireball,3);assert.equal(applyUpgrade(p,'fireball'),false);
});
