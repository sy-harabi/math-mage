import test from 'node:test';
import assert from 'node:assert/strict';
import { CONCEPTS, CONCEPT_TOKENS, conceptVariants, generateConceptSequence, answerConcept } from '../src/concept-questions.js';
import { getSpellAtLevel } from '../src/spells.js';
import { resolveAreaHits } from '../src/combat.js';
import { applyUpgrade, selectUpgradeChoices } from '../src/upgrades.js';

function seeded(seed) { return () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296); }

test('all twelve topics and every requested blank position retain exactly one blank',()=>{
  assert.equal(new Set(CONCEPTS.map(q=>q.name)).size,12);
  const variants=conceptVariants();
  for(const q of variants){
    assert.equal((q.html.match(/□/g)??[]).length,1,`${q.conceptId}/${q.slotId}`);
    assert.ok(q.allowed.includes(q.answerId));
    assert.ok(CONCEPT_TOKENS[q.answerId]);
  }
  const expected={
    continuity:['continuous','approach','limit','value'],
    intermediate:['closed','continuous','value','k','inside'],
    'average-rate':['name','numerator','denominator'],
    'derivative-point':['derivative','approach','shifted','original','denominator'],
    rolle:['closed','continuous','open','differentiable','endpoints','derivative','zero','inside'],
    'mean-value':['closed','continuous','open','differentiable','derivative','numerator','denominator'],
  };
  for(const [id,slots] of Object.entries(expected)){
    assert.deepEqual(variants.filter(q=>q.conceptId===id).map(q=>q.slotId).sort(),slots.sort());
  }
});

test('every initial blank generates Lv1/2/3 sequences with five fixed unique choices and distinct questions',()=>{
  const variants=conceptVariants();
  for(let first=0;first<variants.length;first++)for(let level=1;level<=3;level++){
    const random=seeded(first*100+level);let initial=true;
    const rng=()=>{if(initial){initial=false;return (first+.5)/variants.length;}return random();};
    const sequence=generateConceptSequence(getSpellAtLevel('fireball',level).problem,rng);
    assert.equal(sequence.questions.length,level);
    assert.equal(sequence.questions[0].slotId,variants[first].slotId);
    assert.equal(sequence.choices.length,5);
    assert.equal(new Set(sequence.choices).size,5);
    assert.equal(new Set(sequence.questions.map(q=>`${q.conceptId}/${q.slotId}`)).size,level);
    for(const q of sequence.questions){
      assert.strictEqual(q.choices,sequence.choices);
      assert.strictEqual(q.choiceHtml,sequence.questions[0].choiceHtml);
      assert.equal(q.choices[q.correct],q.answer);
      assert.equal(q.choices.filter(c=>c===q.answer).length,1);
      assert.ok(q.choices.every(choice=>q.allowed.some(id=>CONCEPT_TOKENS[id].text===choice)));
    }
  }
});

test('equivalent values, tautologies and stronger sufficient hypotheses cannot appear as wrong choices',()=>{
  const variants=conceptVariants();
  for(const [concept,slot,excluded] of [
    ['continuity','limit','f(a)'],['continuity','value','limf'],
    ['intermediate','continuous','미분 가능'],['intermediate','value','k'],
    ['extremum','extremum','극댓값'],['extremum','extremum','극솟값'],
    ['extremum','derivative','0'],['rolle','zero','f′(c)'],
    ['antiderivative','derivative','f(x)'],['definite-integral','derivative','f'],
  ])assert.ok(!variants.find(q=>q.conceptId===concept&&q.slotId===slot).allowed.includes(excluded));
});

test('one wrong answer on any question irreversibly fails the entire cast',()=>{
  for(let position=0;position<3;position++){
    const sequence=generateConceptSequence({questionCount:3},seeded(position));
    for(let i=0;i<position;i++)assert.equal(answerConcept(sequence,sequence.questions[i].correct),'next');
    const index=sequence.questions[position].correct;
    assert.equal(answerConcept(sequence,(index+1)%5),'failed');
    assert.equal(answerConcept(sequence,index),'inactive');
    assert.equal(sequence.failed,true);assert.equal(sequence.complete,false);
  }
});

test('all answers are required; the same option remains reusable on later questions',()=>{
  let repeated=false;
  for(let seed=0;seed<200;seed++){
    const sequence=generateConceptSequence({questionCount:3},seeded(seed));
    if(new Set(sequence.questions.map(q=>q.correct)).size<3)repeated=true;
    for(let i=0;i<3;i++)assert.equal(answerConcept(sequence,sequence.questions[i].correct),i===2?'complete':'next');
    assert.equal(sequence.complete,true);assert.equal(answerConcept(sequence,0),'inactive');
  }
  assert.ok(repeated,'reusing an answer must be possible');
});

test('fireball ranks keep radius 42 and scale damage 10/30/70, questions 1/2/3',()=>{
  for(let level=1;level<=3;level++){
    const config=getSpellAtLevel('fireball',level);
    assert.equal(config.radius,42);assert.equal(config.power,[10,30,70][level-1]);
    assert.equal(config.problem.questionCount,level);
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

test('fireball upgrades are offered, cap at Lv3, and retain passive upgrade choices',()=>{
  const p={levels:{bolt:1,heal:1,fireball:1},bonuses:{}};
  let offered=false;
  for(let seed=0;seed<20;seed++){
    const choices=selectUpgradeChoices(p,seeded(seed));
    assert.equal(choices.length,3);
    assert.ok(choices.some(q=>!['bolt','heal','fireball'].includes(q.id)));
    offered ||= choices.some(q=>q.id==='fireball');
  }
  assert.ok(offered);assert.ok(applyUpgrade(p,'fireball'));assert.ok(applyUpgrade(p,'fireball'));
  assert.equal(p.levels.fireball,3);assert.equal(applyUpgrade(p,'fireball'),false);
});
