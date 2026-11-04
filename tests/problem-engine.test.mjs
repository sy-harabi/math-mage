import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestion } from '../src/problem-engine.js';
import { SPELLS } from '../src/spells.js';
import { term, termKey, termText, derivativeOf, integralOf } from '../src/monomial.js';

const checkChoices = q => {
  assert.equal(q.choices.length, 5);
  assert.equal(new Set(q.choices).size, 5);
  assert.equal(q.choices.filter(v => v === q.answer).length, 1);
  assert.equal(q.choices[q.correct], q.answer);
};

for (const [id, spell] of Object.entries(SPELLS)) {
  test(`${id}: 임의의 1,000문제에서 정답 한 개·서로 다른 보기 5개`, () => {
    for (let i = 0; i < 1000; i++) {
      const q = generateQuestion(spell.problem);
      checkChoices(q);
      const { coefficient: a, exponent: n, answerTerm, choiceTerms } = q.data;
      assert.ok(a !== 0 && a >= -5 && a <= 5, `${id}: 계수 ${a}`);
      assert.ok(n >= spell.problem.exponent.min && n <= spell.problem.exponent.max);
      const expected = id === 'bolt' ? derivativeOf(a, n) : integralOf(a, n);
      assert.deepEqual(answerTerm, expected);
      assert.equal(termKey(choiceTerms[q.correct]), termKey(expected));
      assert.equal(new Set(choiceTerms.map(termKey)).size, 5);
      assert.deepEqual(q.choices, choiceTerms.map(termText));
      assert.equal(q.display.length, 2);
      assert.ok(q.prompt.includes(id === 'bolt' ? "f′(x)" : '+ C'));
    }
  });
}

test('양수와 음수 계수가 실제로 출제된다', () => {
  const generated = new Set();
  for (const spell of Object.values(SPELLS)) {
    generated.clear();
    for (let i = 0; i < 400; i++) generated.add(Math.sign(generateQuestion(spell.problem).data.coefficient));
    assert.ok(generated.has(-1));
    assert.ok(generated.has(1));
  }
});

test('가능한 모든 계수·차수 조합에서 오답이 중복되지 않고 정답이 옳다', () => {
  for (const spell of Object.values(SPELLS)) {
    const { coefficient, exponent } = spell.problem;
    const coefficients = Array.from({ length: coefficient.max-coefficient.min+1 },(_,i)=>coefficient.min+i).filter(a=>a!==0);
    const powers = exponent.max-exponent.min+1;
    for (let ci=0; ci<coefficients.length; ci++) {
      for (let ni=0; ni<powers; ni++) {
        let call=0;
        const rng = () => {
          call++;
          if (call === 1) return (ci+.5)/coefficients.length;
          if (call === 2) return (ni+.5)/powers;
          return (call * .1234567) % 1;
        };
        const q=generateQuestion(spell.problem,rng);
        checkChoices(q);
        assert.equal(q.data.coefficient,coefficients[ci]);
        assert.equal(q.data.exponent,exponent.min+ni);
        assert.equal(new Set(q.data.choiceTerms.map(termKey)).size,5);
      }
    }
  }
});

test('힐은 기약분수 계수와 정수 계수를 정확하게 표시한다', () => {
  assert.deepEqual(integralOf(-5, 3), { num:-5, den:4, power:4 });
  assert.equal(termText(integralOf(-5, 3)), '−(5/4)x⁴');
  assert.equal(termText(integralOf(4, 1)), '2x²');
  assert.equal(termText(integralOf(3, 1)), '(3/2)x²');
  assert.equal(termText(derivativeOf(-1, 2)), '−2x');
  assert.equal(termText(term(-1, 1, 1)), '−x');
  assert.equal(termText(term(0, 2, 5)), '0');
  assert.equal(termText(term(2, 2, 1)), 'x');
});

test('기존 사칙연산·문제은행 확장 기능은 계속 동작한다', () => {
  const arithmetic = generateQuestion({kind:'arithmetic',operator:'×',left:{min:2,max:3},right:{min:2,max:4},answerCount:5,distractor:{min:0,max:20,radius:5}},()=>.3);
  checkChoices(arithmetic);
  assert.ok(arithmetic.prompt.includes('×'));
  const bank = generateQuestion({kind:'questionBank',answerCount:5,items:[{prompt:'x + 3 = 7, x = ?',answer:4,distractors:[1,2,3,5,6]}]},()=>.4);
  checkChoices(bank);
  assert.equal(bank.answer, '4');
});

test('단항식 설정에서 0만 있는 계수 범위는 거부한다', () => {
  assert.throws(()=>generateQuestion({kind:'monomialIntegral',coefficient:{min:0,max:0},exponent:{min:1,max:3},answerCount:5}),/사용 가능한 계수/);
});
