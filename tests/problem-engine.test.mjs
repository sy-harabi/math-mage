import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestion } from '../src/problem-engine.js';
import { SPELLS, getSpellAtLevel } from '../src/spells.js';
import { term, termText, derivativeOf, integralOf } from '../src/monomial.js';
import { normalizePolynomial, polynomialKey, polynomialText } from '../src/polynomial.js';

function inspect(q, spec) {
  assert.equal(q.choices.length, spec.answerCount);
  assert.equal(new Set(q.choices).size, spec.answerCount);
  assert.equal(q.choices.filter(v=>v===q.answer).length,1);
  assert.equal(q.choices[q.correct],q.answer);
  const correctPoly=q.data.inputTerms.map(t=>spec.kind==='monomialDerivative'
    ? derivativeOf(t.num,t.power):integralOf(t.num,t.power));
  assert.equal(polynomialKey(q.data.answerTerms),polynomialKey(correctPoly));
  const uniqueExpressions=q.data.choiceTermPolys.map((ts,i)=>
    `${polynomialKey(ts)}:${q.data.choiceHasConstant[i]}`);
  assert.equal(new Set(uniqueExpressions).size,spec.answerCount);
  assert.equal(uniqueExpressions[q.correct],`${polynomialKey(correctPoly)}:${spec.kind==='monomialIntegral'}`);
  assert.ok(q.data.distractorCategories[q.correct]==='correct');
  assert.deepEqual(q.choices,q.data.choiceTermPolys.map((terms,i)=>
    polynomialText(terms)+(q.data.choiceHasConstant[i]?' + C':'')));
  assert.equal(q.choiceLines.length,spec.answerCount);
  assert.ok(q.display.length===2 || q.display.length===3);
}

test('미분, 적분 Lv1: 임의의 2,000문제 — 정답 및 고유 보기 5개',()=>{
  for(const id of ['bolt','heal']){
    const spec=SPELLS[id].problem;
    for(let i=0;i<2000;i++){
      const q=generateQuestion(spec);
      inspect(q,spec);
      assert.equal(q.data.inputTerms.length,1);
      const a=q.data.coefficient,n=q.data.exponent;
      assert.ok(a && a>=-5 && a<=5);
      assert.ok(n>=spec.exponent.min && n<=spec.exponent.max);
      if(id==='heal')assert.ok(q.answer.endsWith(' + C'));
    }
  }
});

test('번개 Lv2: 서로 다른 차수의 두 항을 정확히 미분하고 5개의 동치 아닌 보기를 낸다',()=>{
  const level2=getSpellAtLevel('bolt',2);
  assert.equal(level2.chainTargets,2);
  assert.equal(level2.problem.termCount,2);
  assert.equal(SPELLS.bolt.problem.termCount,1,'레벨2 조회가 레벨1 설정을 바꾸면 안 된다');
  for(let i=0;i<2000;i++){
    const q=generateQuestion(level2.problem);
    inspect(q,level2.problem);
    assert.equal(q.data.inputTerms.length,2);
    assert.equal(new Set(q.data.inputTerms.map(t=>t.power)).size,2);
    assert.equal(q.display.length,3);
    assert.ok(q.choiceLines.every(lines=>lines.length>=1 && lines.length<=2));
  }
});

test('설정된 모든 Lv1 계수·차수 조합의 유효성 검사',()=>{
  for(const spell of Object.values(SPELLS)){
    const base=spell.problem;
    for(let a=base.coefficient.min;a<=base.coefficient.max;a++){
      if(!a)continue;
      for(let n=base.exponent.min;n<=base.exponent.max;n++){
        const q=generateQuestion({...base,coefficient:{min:a,max:a},exponent:{min:n,max:n}});
        inspect(q,base);
        assert.equal(q.data.coefficient,a);
        assert.equal(q.data.exponent,n);
      }
    }
  }
});

test('오답 유형 선택 빈도는 공식 50%, 부호·C 20%, 계산 30%에 근접한다',()=>{
  const wanted={formula:.5,signConstant:.2,arithmetic:.3};
  for(const spec of [SPELLS.bolt.problem,SPELLS.heal.problem,getSpellAtLevel('bolt',2).problem]){
    const counters={formula:0,signConstant:0,arithmetic:0};
    const sample=4000;
    for(let i=0;i<sample;i++){
      const q=generateQuestion(spec);
      for(const label of q.data.distractorCategories){if(label!=='correct')counters[label]++;}
    }
    for(const category of Object.keys(wanted)) {
      assert.ok(Math.abs(counters[category]/(sample*4)-wanted[category])<.04,
        `${spec.kind}, ${spec.termCount}항, ${category} ratio = ${counters[category]/(sample*4)}`);
    }
  }
});

test('힐: + C 누락은 가끔 나오지만 고정된 보기 패턴은 아니다',()=>{
  let withMissing=0,withoutMissing=0;
  for(let i=0;i<1000;i++){
    const q=generateQuestion(SPELLS.heal.problem);
    const missing=q.choices.some((text,index)=>index!==q.correct&&!text.endsWith(' + C'));
    if(missing)withMissing++;else withoutMissing++;
    assert.ok(q.answer.endsWith(' + C'));
  }
  assert.ok(withMissing>50);
  assert.ok(withoutMissing>50);
});

test('기약분수·음수 계수·다항식 표기 검증',()=>{
  assert.deepEqual(integralOf(-5,3),{num:-5,den:4,power:4});
  assert.equal(termText(integralOf(-5,3)),'−(5/4)x⁴');
  assert.equal(termText(integralOf(3,1)),'(3/2)x²');
  assert.equal(polynomialText([term(-6,1,3),term(4,1,1)]),'−6x³ + 4x');
  assert.equal(polynomialText([term(6,2,3),term(-3,1,3)]),'0');
});

test('사칙연산과 수동 문제은행 기존 유형 유지',()=>{
  const arithmetic=generateQuestion({kind:'arithmetic',operator:'×',left:{min:2,max:3},right:{min:2,max:4},answerCount:5,distractor:{min:0,max:20,radius:5}},()=>.3);
  assert.equal(new Set(arithmetic.choices).size,5);
  const bank=generateQuestion({kind:'questionBank',answerCount:5,items:[{prompt:'x+3=7, x?',answer:4,distractors:[1,2,3,5,6]}]},()=>.4);
  assert.equal(bank.answer,'4');
});

test('설정 오류: 계수 0, 불가능한 항 수, 가중치 합계 오류',()=>{
  const base=SPELLS.bolt.problem;
  assert.throws(()=>generateQuestion({...base,coefficient:{min:0,max:0}}),/계수/);
  assert.throws(()=>generateQuestion({...base,termCount:10}),/설정/);
  assert.throws(()=>generateQuestion({...base,distractorWeights:{formula:1,signConstant:.2,arithmetic:.3}}),/합계/);
});
