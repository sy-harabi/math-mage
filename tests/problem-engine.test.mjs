import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestion } from '../src/problem-engine.js';
import { SPELLS } from '../src/spells.js';

for (const [id, spell] of Object.entries(SPELLS)) {
  test(`${id}: 1000개의 문제가 정답 1개·고유 선택지 5개를 갖는다`, () => {
    for (let i = 0; i < 1000; i++) {
      const q = generateQuestion(spell.problem);
      assert.equal(q.choices.length, 5);
      assert.equal(new Set(q.choices).size, 5);
      assert.equal(q.choices.filter(v => v === q.answer).length, 1);
      assert.equal(q.choices[q.correct], q.answer);
      const m = q.prompt.match(/^(\d+) ([+\-×÷]) (\d+) = \?$/);
      assert.ok(m, `문제 형식: ${q.prompt}`);
      const a = Number(m[1]), op = m[2], b = Number(m[3]);
      assert.ok(a >= 0 && a <= 9 && b >= 0 && b <= 9);
      assert.equal(Number(q.answer), op === '+' ? a+b : a-b);
      assert.ok(Number(q.answer) >= 0);
    }
  });
}

test('새로운 연산(곱셈)을 기존 게임 코드 변경 없이 추가할 수 있다', () => {
  const spec = { kind:'arithmetic', operator:'×',left:{min:2,max:3},right:{min:2,max:4},answerCount:5,distractor:{min:0,max:20,radius:5} };
  const q = generateQuestion(spec, () => .3);
  assert.ok(q.prompt.includes('×'));
  assert.ok([4,6,8,9,12].includes(Number(q.answer)));
});

test('오답 후보가 부족하면 명시적인 오류를 반환한다', () => {
  assert.throws(() => generateQuestion({kind:'arithmetic',operator:'+',left:{min:1,max:1},right:{min:1,max:1},answerCount:5,distractor:{min:0,max:2,radius:1}}), /오답 후보가 부족/);
});


test('문제은행으로 원하는 유형의 문제를 추가할 수 있다', () => {
  const spec = { kind: 'questionBank', answerCount: 5, items: [
    { prompt: 'x + 3 = 7, x = ?', answer: 4, distractors: [1,2,3,5,6] },
  ] };
  const q = generateQuestion(spec, () => 0.4);
  assert.equal(q.prompt, 'x + 3 = 7, x = ?');
  assert.equal(q.choices[q.correct], '4');
  assert.equal(new Set(q.choices).size, 5);
});
