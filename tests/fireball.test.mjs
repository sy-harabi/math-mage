import test from 'node:test';
import assert from 'node:assert/strict';
import { term, termKey } from '../src/monomial.js';
import { generateDefiniteIntegralSequence, answerDefiniteIntegral, definiteIntegralOf, sumIntegralTerms } from '../src/definite-integral.js';
import { definiteIntegralSequenceMathML } from '../src/math-ui.js';
import { getSpellAtLevel } from '../src/spells.js';
import { generateQuestion } from '../src/problem-engine.js';
import { resolveAreaHits } from '../src/combat.js';
import { applyUpgrade, selectUpgradeChoices } from '../src/upgrades.js';
const seeded=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);

test('definite integrals handle constants, signs, fractions, symmetric intervals and cancellation exactly',()=>{
  assert.deepEqual(definiteIntegralOf(term(3,1,2),0,2),term(8,1,0));
  assert.deepEqual(definiteIntegralOf(term(-4,1,1),-1,1),term(0,1,0));
  assert.deepEqual(definiteIntegralOf(term(-3,1,0),-1,1),term(-6,1,0));
  assert.deepEqual(definiteIntegralOf(term(1,1,2),0,1),term(1,3,0));
  assert.deepEqual(definiteIntegralOf(term(3,2,1),0,2),term(3,1,0));
  assert.deepEqual(sumIntegralTerms([term(1,3,0),term(-1,3,0)]),term(0,1,0));
});

test('6000 ranked questions have correct integrals verified independently by Simpson quadrature',()=>{
  for(let level=1;level<=3;level++)for(let seed=0;seed<2000;seed++){
    const spec=getSpellAtLevel('fireball',level).problem;
    const seq=generateDefiniteIntegralSequence(spec,seeded(seed));
    const {data,choices}=seq.question;
    assert.equal(data.inputTerms.length,level);
    assert.equal(choices.length,5);assert.equal(new Set(choices).size,5);
    assert.equal(new Set(data.inputTerms.map(t=>t.power)).size,level);
    let total=0;
    data.inputTerms.forEach((t,i)=>{
      const f=x=>t.num/t.den*x**t.power,a=data.lower,b=data.upper;
      const expected=(b-a)/6*(f(a)+4*f((a+b)/2)+f(b));
      const answer=data.contributions[i];
      assert.ok(Math.abs(answer.num/answer.den-expected)<1e-9);
      assert.equal(answer.den,1,'default contributions must be integers');
      assert.equal(termKey(data.choiceTerms[seq.correctIndices[i]]),termKey(answer));
      total+=expected;
    });
    assert.ok(Math.abs(data.answerTerms[0].num/data.answerTerms[0].den-total)<1e-9);
    const generic=generateQuestion(spec,seeded(seed));
    assert.equal(generic.choices[generic.correct],generic.answer);
  }
});

test('constant terms and zero contributions still require a selection; duplicate answers reuse one rune',()=>{
  let reused=false,zero=false;
  for(let seed=0;seed<200;seed++){
    const seq=generateDefiniteIntegralSequence({...getSpellAtLevel('fireball',3).problem,intervals:[[-1,1]]},seeded(seed));
    assert.ok(seq.question.data.inputTerms.some(t=>t.power===0));
    reused ||= new Set(seq.correctIndices).size<3;
    zero ||= seq.question.data.contributions.some(t=>t.num===0);
    const choices=seq.question.choices.slice();
    for(let i=0;i<3;i++){
      assert.equal(answerDefiniteIntegral(seq,seq.correctIndices[i]),i===2?'complete':'next');
      assert.deepEqual(seq.question.choices,choices);
    }
    assert.equal(seq.selectedTerms.length,3);assert.equal(answerDefiniteIntegral(seq,0),'inactive');
  }
  assert.ok(reused);assert.ok(zero);
});

test('a wrong rune at any position permanently fails the entire integral',()=>{
  for(let position=0;position<3;position++){
    const seq=generateDefiniteIntegralSequence(getSpellAtLevel('fireball',3).problem,seeded(position));
    for(let i=0;i<position;i++)assert.equal(answerDefiniteIntegral(seq,seq.correctIndices[i]),'next');
    assert.equal(answerDefiniteIntegral(seq,(seq.correctIndices[position]+1)%5),'failed');
    assert.equal(answerDefiniteIntegral(seq,seq.correctIndices[position]),'inactive');
    assert.equal(seq.failed,true);assert.equal(seq.complete,false);
  }
});

test('integral MathML displays both bounds, highlighted source term, charge and partial sum without boxes or +C',()=>{
  const seq=generateDefiniteIntegralSequence({...getSpellAtLevel('fireball',3).problem,intervals:[[-1,1]]},seeded(8));
  const before=definiteIntegralSequenceMathML(seq);
  assert.match(before,/<msubsup><mo>∫<\/mo><mn>-1<\/mn><mn>1<\/mn>/);
  assert.match(before,/aria-valuenow="0"/);assert.match(before,/aria-valuemax="3"/);assert.doesNotMatch(before,/□/);assert.match(before,/integral-current-term/);
  answerDefiniteIntegral(seq,seq.correctIndices[0]);
  const after=definiteIntegralSequenceMathML(seq);
  assert.match(after,/aria-valuenow="1"/);assert.doesNotMatch(after,/□|왼쪽|실패/);
  assert.doesNotMatch(after,/<mi>C<\/mi>/);
});

test('fireball ranks retain radius 42 and damage 10/30/70; polynomial has 1/2/3 terms',()=>{
  for(let level=1;level<=3;level++){
    const config=getSpellAtLevel('fireball',level);
    assert.equal(config.radius,42);assert.equal(config.power,[10,30,70][level-1]);
    assert.equal(config.problem.termCount,level);assert.equal(config.problem.kind,'definiteIntegral');
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
