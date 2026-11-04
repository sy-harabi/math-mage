import { term, termText, derivativeOf, integralOf } from './monomial.js';
import { normalizePolynomial, polynomialKey, polynomialText, polynomialChoiceLines } from './polynomial.js';

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
 * Every distractor is tagged formula / signConstant / arithmetic.
 * The weights are per WRONG OPTION, not fixed counts per question.
 * A fixed omitted-C option would force >=25% for four distractors,
 * contradicting the requested 20% category weight, so omission is probabilistic.
 */
const DEFAULT_DISTRACTOR_WEIGHTS = Object.freeze({ formula: 0.5, signConstant: 0.2, arithmetic: 0.3 });
const CATEGORIES = Object.keys(DEFAULT_DISTRACTOR_WEIGHTS);

function weightedCategory(pools, weights, rng, excluded) {
  const available = CATEGORIES.filter(k => pools[k].some(x => !excluded.has(x.key)) && weights[k] > 0);
  if (!available.length) throw new Error('중복되지 않는 오답 보기가 부족합니다.');
  const total = available.reduce((sum, k) => sum + weights[k], 0);
  let point = rng() * total;
  for (const k of available) {
    point -= weights[k];
    if (point < 0) return k;
  }
  return available[available.length - 1];
}

function polynomialQuestion(spec, rng, kind) {
  const derivative = kind === 'monomialDerivative';
  const coefRange = integerRange(spec.coefficient, 'coefficient');
  const powRange = integerRange(spec.exponent, 'exponent');
  if (powRange.min < (derivative ? 1 : 0)) throw new Error('허용되지 않는 차수입니다.');
  const coefficients = [];
  for (let a = coefRange.min; a <= coefRange.max; a++) {
    if (a !== 0) coefficients.push(a);
    if (coefficients.length > 2000) throw new Error('계수 범위가 너무 큽니다.');
  }
  const termCount = spec.termCount ?? 1;
  const powers = Array.from({length:powRange.max-powRange.min+1}, (_,i)=>powRange.min+i);
  if (!coefficients.length || powers.length > 100 || !Number.isInteger(termCount) ||
      termCount < 1 || termCount > powers.length || termCount > 3) {
    throw new Error('계수·차수·항 개수 설정이 유효하지 않습니다.');
  }
  const count = spec.answerCount ?? 5;
  if (!Number.isInteger(count) || count < 2 || count > 10) throw new Error('answerCount는 2~10 사이여야 합니다.');
  const weights = spec.distractorWeights ?? DEFAULT_DISTRACTOR_WEIGHTS;
  if (!CATEGORIES.every(k => Number.isFinite(weights[k]) && weights[k] >= 0) ||
      Math.abs(CATEGORIES.reduce((sum,k)=>sum+weights[k], 0)-1)>1e-8) {
    throw new Error('오답 유형 가중치의 합계는 1이어야 합니다.');
  }
  const input = [];
  for (let i=0;i<termCount;i++) {
    const n=powers.splice(pickIndex(powers.length,rng),1)[0];
    const a=coefficients[pickIndex(coefficients.length,rng)];
    input.push({a,n});
  }
  input.sort((a,b)=>b.n-a.n);
  const correctTerms = normalizePolynomial(input.map(({a,n}) => derivative ? derivativeOf(a,n) : integralOf(a,n)));
  const withConstant = !derivative;
  const keyOf = (terms, hasConstant) => `${polynomialKey(terms)}:${hasConstant}`;
  const answerKey=keyOf(correctTerms,withConstant);
  const pools=Object.fromEntries(CATEGORIES.map(k=>[k,[]]));
  const poolSeen=Object.fromEntries(CATEGORIES.map(k=>[k,new Set()]));
  const push = (category, terms, hasConstant = withConstant) => {
    const cleaned=normalizePolynomial(terms);
    if (!cleaned.length) return; // zero distractors provide no useful algebraic clue
    const key=keyOf(cleaned,hasConstant);
    if (key===answerKey || poolSeen[category].has(key)) return;
    poolSeen[category].add(key);
    pools[category].push({terms:cleaned,hasConstant,key,category});
  };
  const changeTerm = (index, replacement) => correctTerms.map((t,i)=>i===index?replacement:t);
  for (let j=0;j<input.length;j++) {
    const {a,n}=input[j];
    const correct=derivative?derivativeOf(a,n):integralOf(a,n);
    // Index j is stable because the original exponents were distinct and sorted.
    const wrongFormula = derivative ? [
      term(a,1,n-1),term(a*n,1,n),term(a+n,1,n-1),
      term(a*n,1,n+1),term(a,1,n),term(a*(n+1),1,n-1),
      term(a*n,1,Math.max(0,n-2)),term(a,1,n+1),
    ] : [
      term(a,1,n+1),term(a*(n+1),1,n+1),term(a,n+1,n),
      term(a,n+1,n+2),term(a,1,n),term(a,Math.max(1,n),n+1),
      term(a,n+2,n+1),term(a,n+3,n+1),
    ];
    for(const candidate of wrongFormula) push('formula',changeTerm(j,candidate));
    // Small changes to the CORRECT answer: multiplication/division slips.
    for(const delta of [-3,-2,-1,1,2,3]){
      push('arithmetic',changeTerm(j,term(correct.num+delta,correct.den,correct.power)));
    }
    if (correct.den > 1) for(const delta of [-2,-1,1,2]){
      const den=correct.den+delta;
      if(den>0) push('arithmetic',changeTerm(j,term(correct.num,den,correct.power)));
    }
    // Sign errors can affect one term, particularly in a two-term derivative.
    push('signConstant',changeTerm(j,term(-correct.num,correct.den,correct.power)));
    for(const candidate of wrongFormula.slice(0,4)) {
      push('signConstant',changeTerm(j,term(-candidate.num,candidate.den,candidate.power)));
    }
  }
  if (withConstant) {
    push('signConstant',correctTerms,false); // correct polynomial, but no + C
    // It can also be omitted from a numerically incorrect primitive.
    for(const x of pools.formula.slice(0,3)) push('signConstant',x.terms,false);
    for(const x of pools.arithmetic.slice(0,2)) push('signConstant',x.terms,false);
  }
  const selected=[], used=new Set([answerKey]);
  for(let i=0;i<count-1;i++){
    const category=weightedCategory(pools,weights,rng,used);
    const options=pools[category].filter(item=>!used.has(item.key));
    const picked=options[pickIndex(options.length,rng)];
    selected.push(picked);used.add(picked.key);
  }
  const correct=pickIndex(count,rng);
  const choicesWithMeaning=selected.slice();
  choicesWithMeaning.splice(correct,0,{terms:correctTerms,hasConstant:withConstant,key:answerKey,category:'correct'});
  const format=option=>polynomialText(option.terms)+(option.hasConstant?' + C':'');
  const originalTerms=input.map(({a,n})=>term(a,1,n));
  const expression=polynomialText(originalTerms);
  const display=derivative
    ? termCount===1 ? [`f(x) = ${expression}`,'f′(x) = ?']
      : termCount===2 ? ['f(x) =',expression,'f′(x) = ?']
      : ['f(x) =',polynomialText(originalTerms.slice(0,2)),
        polynomialChoiceLines(originalTerms)[2],'f′(x) = ?']
    : termCount===1 ? [`∫ ${expression} dx`,'= ?']
      : termCount===2 ? ['∫',`${expression} dx`,'= ?']
      : ['∫',polynomialText(originalTerms.slice(0,2)),
        `${polynomialChoiceLines(originalTerms)[2]} dx`,'= ?'];
  return {
    prompt: derivative?`f(x) = ${expression}, f′(x) = ?`:`∫ ${expression} dx = ?`,
    display,answer:format(choicesWithMeaning[correct]),
    choices:choicesWithMeaning.map(format),correct,
    choiceLines:choicesWithMeaning.map(x=>polynomialChoiceLines(x.terms,x.hasConstant)),
    data: {
      coefficient:input[0].a,exponent:input[0].n,inputTerms:originalTerms,
      answerTerm:correctTerms[0],answerTerms:correctTerms,
      choiceTerms:choicesWithMeaning.map(x=>x.terms[0]),
      choiceTermPolys:choicesWithMeaning.map(x=>x.terms),
      choiceHasConstant:choicesWithMeaning.map(x=>x.hasConstant),
      distractorCategories:choicesWithMeaning.map(x=>x.category),
    },
  };
}

function monomialDerivative(spec,rng){return polynomialQuestion(spec,rng,'monomialDerivative');}
function monomialIntegral(spec,rng){return polynomialQuestion(spec,rng,'monomialIntegral');}

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
