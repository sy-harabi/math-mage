import { term, termKey, termText, derivativeOf, integralOf } from './monomial.js';

/**
 * 스킬·그래픽과 무관한 문제 생성 모듈.
 * 모든 유형은 { prompt: string, answer: string, choices: string[], correct: number }
 * 를 반환하며, 정답은 정확히 한 번만 포함되어야 합니다.
 */
function pickIndex(length, rng) {
  return Math.min(length - 1, Math.floor(rng() * length));
}

function integerRange(range, name) {
  if (!range || !Number.isInteger(range.min) || !Number.isInteger(range.max) || range.min > range.max) {
    throw new Error(`${name}: 정수 범위 { min, max }가 필요합니다.`);
  }
  return range;
}

function operate(op, a, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷': return b !== 0 && a % b === 0 ? a / b : null;
    default: throw new Error(`지원하지 않는 연산자: ${op}`);
  }
}

function arithmetic(spec, rng) {
  const left = integerRange(spec.left, 'left');
  const right = integerRange(spec.right, 'right');
  const d = integerRange(spec.distractor, 'distractor');
  const count = spec.answerCount ?? 5;
  if (!Number.isInteger(count) || count < 2) throw new Error('answerCount는 2 이상이어야 합니다.');
  const total = (left.max - left.min + 1) * (right.max - right.min + 1);
  if (total > 200000) throw new Error('피연산자 범위가 너무 큽니다.');

  const pairs = [];
  for (let a = left.min; a <= left.max; a++) {
    for (let b = right.min; b <= right.max; b++) {
      const answer = operate(spec.operator, a, b);
      if (answer === null || (spec.requireNonNegativeResult && answer < 0)) continue;
      if (spec.result && (answer < spec.result.min || answer > spec.result.max)) continue;
      pairs.push({ a, b, answer });
    }
  }
  if (!pairs.length) throw new Error('조건에 맞는 문제가 없습니다.');
  const { a, b, answer } = pairs[pickIndex(pairs.length, rng)];
  const radius = spec.distractor.radius ?? Infinity;
  const pool = [];
  for (let value = d.min; value <= d.max; value++) {
    if (value !== answer) pool.push(value);
  }
  if (pool.length < count - 1) throw new Error('오답 후보가 부족합니다. distractor 범위를 넓히세요.');
  // 먼저 정답 근처에서 뽑고, 모자라면 전체 후보에서 보충합니다.
  const near = pool.filter(value => Math.abs(value - answer) <= radius);
  const picked = [];
  const draw = candidates => {
    while (picked.length < count - 1 && candidates.length) {
      const [value] = candidates.splice(pickIndex(candidates.length, rng), 1);
      picked.push(value);
    }
  };
  draw(near);
  if (picked.length < count - 1) draw(pool.filter(value => !picked.includes(value)));
  const correct = pickIndex(count, rng);
  const choices = picked.map(String);
  choices.splice(correct, 0, String(answer));
  return { prompt: `${a} ${spec.operator} ${b} = ?`, answer: String(answer), choices, correct };
}

/** 자유롭게 작성한 문제 묶음 — 나중에 분수·문자식도 설정만 바꿔 사용 가능. */
function questionBank(spec, rng) {
  if (!Array.isArray(spec.items) || spec.items.length === 0) throw new Error('questionBank: items가 필요합니다.');
  const item = spec.items[pickIndex(spec.items.length, rng)];
  const count = spec.answerCount ?? 5;
  const answer = String(item.answer);
  const wrong = [...new Set((item.distractors ?? []).map(String))].filter(v => v !== answer);
  if (wrong.length < count - 1) throw new Error('questionBank: 오답 후보가 부족합니다.');
  const chosen = [];
  while (chosen.length < count - 1) chosen.push(...wrong.splice(pickIndex(wrong.length, rng), 1));
  const correct = pickIndex(count, rng);
  const choices = chosen;
  choices.splice(correct, 0, answer);
  return { prompt: String(item.prompt), answer, choices, correct };
}

/**
 * 단항식 미분·부정적분. 수식은 구조화된 분자·분모·차수로 비교하므로
 * 서로 다르게 보이는 동치식이나 중복 보기를 만들지 않는다.
 */
function monomialQuestion(spec, rng, kind) {
  const coefficient = integerRange(spec.coefficient, 'coefficient');
  const exponent = integerRange(spec.exponent, 'exponent');
  if (exponent.min < (kind === 'monomialDerivative' ? 1 : 0)) {
    throw new Error('이 문제 유형에 허용되지 않는 차수입니다.');
  }
  const allowedCoefficients = [];
  for (let a = coefficient.min; a <= coefficient.max; a++) {
    if (a !== 0) allowedCoefficients.push(a);
    if (allowedCoefficients.length > 2000) throw new Error('계수 범위가 너무 큽니다.');
  }
  if (!allowedCoefficients.length || exponent.max - exponent.min > 100) {
    throw new Error('사용 가능한 계수·차수 범위가 필요합니다.');
  }
  const a = allowedCoefficients[pickIndex(allowedCoefficients.length, rng)];
  const n = exponent.min + pickIndex(exponent.max - exponent.min + 1, rng);
  const count = spec.answerCount ?? 5;
  if (!Number.isInteger(count) || count < 2) throw new Error('answerCount는 2 이상이어야 합니다.');

  const isDerivative = kind === 'monomialDerivative';
  const correctTerm = isDerivative ? derivativeOf(a, n) : integralOf(a, n);
  // 문제별 대표적인 실수를 이용한 오답 후보. 정답과 동치인 식은 제외한다.
  const wrongTerms = isDerivative ? [
    term(a, 1, n - 1),             // 계수에 차수를 곱하지 않음
    term(a * n, 1, n),             // 지수를 줄이지 않음
    term(a + n, 1, n - 1),         // 계수와 차수를 더함
    term(a * n, 1, n + 1),         // 지수를 증가시킴
    term(a * n, 1, n >= 2 ? n - 2 : 0),
    term(a, 1, n),                 // 원래 단항식을 그대로 둠
    term(a * (n + 1), 1, n - 1),
    term(a * n + (a < 0 ? -1 : 1), 1, n - 1),
    term(-a * n, 1, n - 1),        // 부호 반대
    term(a * n, 1, n + 2),
  ] : [
    term(a, 1, n + 1),            // 계수를 나누지 않음
    term(a * (n + 1), 1, n + 1),  // 계수를 곱함
    term(a, n + 1, n),            // 지수를 증가시키지 않음
    term(a, n + 1, n + 2),        // 지수를 2 증가시킴
    term(a * n, 1, Math.max(0, n - 1)),  // 미분과 혼동
    term(a, 1, n),                // 원래 단항식 그대로
    term(a, Math.max(1, n), n + 1), // n+1 대신 n으로 나눔
    term(-a, n + 1, n + 1),       // 부호 반대
    term(a, n + 2, n + 1),        // n+2로 나눔
    term(a, n + 3, n + 1),
  ];
  const seen = new Set([termKey(correctTerm)]);
  const pool = wrongTerms.filter(candidate => {
    const key = termKey(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (pool.length < count - 1) {
    throw new Error('오답 후보가 부족합니다. 문제 범위를 조정하세요.');
  }
  const selected = [];
  while (selected.length < count - 1) {
    selected.push(...pool.splice(pickIndex(pool.length, rng), 1));
  }
  const correct = pickIndex(count, rng);
  const choiceTerms = [...selected];
  choiceTerms.splice(correct, 0, correctTerm);
  const prompt = isDerivative
    ? `f(x) = ${termText(term(a, 1, n))}, f′(x) = ?`
    : `∫ ${termText(term(a, 1, n))} dx = ? + C`;
  const display = isDerivative
    ? [`f(x) = ${termText(term(a, 1, n))}`, 'f′(x) = ?']
    : [`∫ ${termText(term(a, 1, n))} dx`, '= ? + C'];
  return {
    prompt,
    display,
    answer: termText(correctTerm),
    choices: choiceTerms.map(termText),
    correct,
    // 테스트에서 실제 계수·차수를 직접 검증할 수 있도록 원본 식도 반환.
    data: { coefficient: a, exponent: n, answerTerm: correctTerm, choiceTerms },
  };
}

function monomialDerivative(spec, rng) {
  return monomialQuestion(spec, rng, 'monomialDerivative');
}

function monomialIntegral(spec, rng) {
  return monomialQuestion(spec, rng, 'monomialIntegral');
}

/** 새로운 문제 유형은 여기에 생성 함수를 등록하면 됩니다. */
export const PROBLEM_GENERATORS = Object.freeze({ arithmetic, questionBank, monomialDerivative, monomialIntegral });

export function generateQuestion(spec, rng = Math.random) {
  const generator = PROBLEM_GENERATORS[spec?.kind];
  if (!generator) throw new Error(`지원하지 않는 문제 유형: ${spec?.kind}`);
  const q = generator(spec, rng);
  if (q.choices.length !== (spec.answerCount ?? 5) ||
      q.choices.filter(c => c === q.answer).length !== 1 ||
      q.choices[q.correct] !== q.answer ||
      new Set(q.choices).size !== q.choices.length) {
    throw new Error('문제 생성 검증 실패: 선택지 또는 정답이 올바르지 않습니다.');
  }
  return q;
}
