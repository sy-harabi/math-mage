// Each template is a complete statement. Only one named slot is hidden per question.
// MathML stays native to the browser, just like the existing calculation spells.
const mi = s => `<mi>${s}</mi>`;
const mo = s => `<mo>${s}</mo>`;
const fn = (name, arg, prime = false) => `${mi(name)}${prime ? mo('′') : ''}${mo('(')}${arg}${mo(')')}`;
const f = arg => fn('f', mi(arg));
const fp = arg => fn('f', mi(arg), true);
const frac = (a, b) => `<mfrac><mrow>${a}</mrow><mrow>${b}</mrow></mfrac>`;
const limit = (variable, to, body) => `<munder><mo>lim</mo><mrow>${mi(variable)}${mo('→')}${to}</mrow></munder>${body}`;
const math = body => `<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>${body}</mrow></math>`;
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const tokens = {};
function token(id, text, body = null) { tokens[id] = { text, html: body === null ? esc(text) : math(body) }; }
for (const word of ['연속','미분 가능','불연속','미분 불가능','정의되지 않음','발산','평균변화율','미분계수','함숫값','극값','극댓값','극솟값','증가','감소','일정']) token(word, word);
for (const v of ['a','b','x','h','k','C']) token(v, v, mi(v));
for (const n of ['0','1','−1','2']) token(n, n, `<mn>${n}</mn>`);
for (const op of ['>','<','=','≥','≤','+','−','×','÷']) token(op, op, mo(esc(op)));
for (const v of ['a','b','c','x']) {
  token(`f(${v})`, `f(${v})`, f(v));
  token(`f′(${v})`, `f′(${v})`, fp(v));
  token(`F(${v})`, `F(${v})`, fn('F', mi(v)));
}
token('F′', 'F′', mi('F') + mo('′'));
token('F', 'F', mi('F'));
token('f', 'f', mi('f'));
token('f′', 'f′', mi('f') + mo('′'));
token('F′(x)', 'F′(x)', fn('F', mi('x'), true));
token('f(a+h)', 'f(a+h)', fn('f', `${mi('a')}${mo('+')}${mi('h')}`));
token('f(x+h)', 'f(x+h)', fn('f', `${mi('x')}${mo('+')}${mi('h')}`));
token('f(a)=f(b)', 'f(a) = f(b)', `${f('a')}${mo('=')}${f('b')}`);
token('f(a)=−f(b)', 'f(a) = −f(b)', `${f('a')}${mo('=')}${mo('−')}${f('b')}`);
token('f(a)=0', 'f(a) = 0', `${f('a')}${mo('=')}<mn>0</mn>`);
token('f(b)=0', 'f(b) = 0', `${f('b')}${mo('=')}<mn>0</mn>`);
token('f(a)f(b)=0', 'f(a)f(b) = 0', `${f('a')}${f('b')}${mo('=')}<mn>0</mn>`);
token('limf', 'lim(x→a) f(x)', limit('x', mi('a'), f('x')));
for (const [id, left, right] of [['[a,b]','[',']'],['(a,b)','(',')'],['[a,b)','[',')'],['(a,b]','(',']']]) {
  token(id, id, `${mo(left)}${mi('a')}${mo(',')}${mi('b')}${mo(right)}`);
}
token('{a,b}', '{a,b}', `${mo('{')}${mi('a')}${mo(',')}${mi('b')}${mo('}')}`);
token('df', 'f(b) − f(a)', `${f('b')}${mo('−')}${f('a')}`);
token('sumf', 'f(b) + f(a)', `${f('b')}${mo('+')}${f('a')}`);
token('revf', 'f(a) − f(b)', `${f('a')}${mo('−')}${f('b')}`);
token('dx', 'b − a', `${mi('b')}${mo('−')}${mi('a')}`);
token('sumx', 'b + a', `${mi('b')}${mo('+')}${mi('a')}`);
token('revx', 'a − b', `${mi('a')}${mo('−')}${mi('b')}`);
export const CONCEPT_TOKENS = Object.freeze(tokens);

// A slot's allowed list consists of its answer and reviewed, non-equivalent wrong
// answers. Intersect these lists before sharing choices across several questions.
const VALUES = ['f(a)','f(b)','f(c)','f(x)','f′(a)','f′(c)','f′(x)','F(x)','F′(x)','F(a)','F(b)','f(a+h)','f(x+h)','k','h','0'];
const INTERVALS = ['[a,b]','(a,b)','[a,b)','(a,b]','{a,b}'];
const NUMBERS = ['0','1','−1','2','a','b','x','h'];
const CONDITIONS = ['연속','미분 가능','불연속','미분 불가능','정의되지 않음','발산'];
const RATES = ['평균변화율','미분계수','함숫값','극값','극댓값','극솟값'];
const DIFFERENCES = ['df','sumf','revf','dx','sumx','revx'];
const slot = (id, answer, pool = VALUES) => ({ id, answer, allowed: pool });
const S = (id, answer, pool) => slot(id, answer, pool);
const E = mo('=');
const A = mi('a'), B = mi('b'), X = mi('x'), H = mi('h');
const line = (...parts) => parts;
// Strings are trusted, authored HTML. Token objects are potential blank positions.
export const CONCEPTS = [
  { id:'continuity', name:'한 점에서의 연속', lines:[
    line('함수 ', math(mi('f')), '가 ', math(A), '에서 ', S('continuous','연속',CONDITIONS), '일'),
    line('필요충분조건은'),
    line(S('limit','limf',['limf','f′(a)','f′(x)','F′(x)','F(x)']), math(E), S('value','f(a)'), '이다.'),
  ], extraSlots: [S('approach','a',['a','b','h','x','0','1'])] },
  { id:'intermediate', name:'중간값 정리', lines:[
    line(math(mi('f')), '가 닫힌구간 ', S('closed','[a,b]',INTERVALS), '에서 ', S('continuous','연속',CONDITIONS), '이고'),
    line(math(`${f('a')}${mo('&lt;')}${mi('k')}${mo('&lt;')}${f('b')}`), '이면'),
    line('열린구간 ', S('inside','(a,b)',INTERVALS), '에'),
    line(S('value','f(c)'), math(E), S('k','k'), '인 ', math(mi('c')), '가 존재한다.'),
  ] },
  { id:'average-rate', name:'평균변화율', lines:[
    line(math(X), '가 ', math(A), '에서 ', math(B), '까지 변할 때'),
    line(S('name','평균변화율',RATES), '은'),
    line({ fraction: [S('numerator','df',DIFFERENCES), S('denominator','dx',DIFFERENCES)] }, '이다.'),
  ] },
  { id:'derivative-point', name:'미분계수의 정의', lines:[
    line(S('derivative','f′(a)'), math(E)),
    line({ limit: ['h', S('approach','0',NUMBERS)], fraction: [
      [S('shifted','f(a+h)'), math(mo('−')), S('original','f(a)')], S('denominator','h',NUMBERS)] }),
  ] },
  { id:'derivative-function', name:'도함수의 정의', lines:[
    line(S('derivative','f′(x)'), math(E)),
    line({ limit: ['h', S('approach','0',NUMBERS)], fraction: [
      [S('shifted','f(x+h)'), math(mo('−')), S('original','f(x)')], S('denominator','h',NUMBERS)] }),
  ] },
  { id:'differentiable-continuous', name:'미분 가능성과 연속', lines:[
    line(math(mi('f')), '가 ', math(A), '에서'),
    line(S('differentiable','미분 가능',CONDITIONS), '하면'),
    line(math(A), '에서 ', S('continuous','연속',CONDITIONS), '이다.'),
  ] },
  { id:'rolle', name:'롤의 정리', lines:[
    line('닫힌구간 ', S('closed','[a,b]',INTERVALS), '에서 ', S('continuous','연속',CONDITIONS), ','),
    line('열린구간 ', S('open','(a,b)',INTERVALS), '에서 ', S('differentiable','미분 가능',CONDITIONS), '하고'),
    line(S('endpoints','f(a)=f(b)',['f(a)=f(b)','f(a)=−f(b)','f(a)=0','f(b)=0','f(a)f(b)=0']), '이면'),
    line(S('derivative','f′(c)'), math(E), S('zero','0',NUMBERS), '인 ', math(mi('c')), '가 존재한다.'),
    line('(열린구간 ', S('inside','(a,b)',INTERVALS), '에서)'),
  ] },
  { id:'mean-value', name:'평균값 정리', lines:[
    line('닫힌구간 ', S('closed','[a,b]',INTERVALS), '에서 ', S('continuous','연속',CONDITIONS), ','),
    line('열린구간 ', S('open','(a,b)',INTERVALS), '에서 ', S('differentiable','미분 가능',CONDITIONS), '하면'),
    line(S('derivative','f′(c)'), math(E), { fraction: [S('numerator','df',DIFFERENCES), S('denominator','dx',DIFFERENCES)] }),
    line('인 ', math(`${mi('c')}${mo('∈')}${mo('(')}${A}${mo(',')}${B}${mo(')')}`), '가 존재한다.'),
  ] },
  { id:'extremum', name:'극값에서의 미분계수', lines:[
    line('열린 구간의 점 ', math(A), '에서'),
    line(S('differentiable','미분 가능',CONDITIONS), '한 함수가 ', S('extremum','극값',RATES), '을 가지면'),
    line(S('derivative','f′(a)'), math(E), S('zero','0',NUMBERS), '이다.'),
  ] },
  ...[['increasing','증가','>'],['decreasing','감소','<']].map(([id, direction, sign]) => ({
    id, name:'도함수의 부호와 증가·감소', lines:[
      line('구간의 모든 ', math(X), '에서'),
      line(S('derivative','f′(x)'), S('sign',sign,['>','<','=','≥','≤']), math('<mn>0</mn>'), '이면'),
      line(math(mi('f')), '는 그 구간에서 ', S('direction',direction,['증가','감소','일정','불연속','정의되지 않음']), '한다.'),
    ],
  })),
  { id:'antiderivative', name:'부정적분의 의미', lines:[
    line('구간에서 ', S('derivative','F′(x)'), math(E), S('function','f(x)'), '이면'),
    line(math(`${mo('∫')}${f('x')}${mi('d')}${X}${E}`), S('primitive','F(x)'), math(mo('+')), S('constant','C',['C','x','h','k','0']), '.'),
    line('( ', math(mi('C')), '는 적분상수 )'),
  ] },
  { id:'definite-integral', name:'정적분의 계산', lines:[
    line(math(mi('f')), '가 ', math(`${mo('[')}${A}${mo(',')}${B}${mo(']')}`), '에서 연속이고'),
    line(S('derivative','F′',['F′','F','f','f′','0']), math(`${E}${mi('f')}`), '이면'),
    line(math(`<msubsup>${mo('∫')}${A}${B}</msubsup>${f('x')}${mi('d')}${X}${E}`),
      S('upper','F(b)'), S('subtract','−',['−','+','×','÷','=']), S('lower','F(a)'), '.'),
  ] },
];

function slotsIn(part) {
  if (Array.isArray(part)) return part.flatMap(slotsIn);
  if (typeof part !== 'object') return [];
  if (part.answer) return [part];
  return [...slotsIn(part.fraction ?? []), ...slotsIn(part.limit?.[1] ?? [])];
}
function renderPart(part, hidden, concept, plain = false) {
  if (Array.isArray(part)) return part.map(p => renderPart(p,hidden,concept,plain)).join('');
  if (typeof part === 'string') return plain ? part.replace(/<[^>]*>/g,'') : part;
  if (part.answer) {
    if (part.id === hidden) return plain ? '□' : '<span class="concept-blank" aria-label="빈칸">□</span>';
    if (concept.id === 'continuity' && part.id === 'limit' && hidden === 'approach') {
      return math(limit('x', '<mtext class="concept-blank" aria-label="빈칸">□</mtext>', f('x')));
    }
    return plain ? tokens[part.answer].text : tokens[part.answer].html;
  }
  // HTML fractions let an individual numerator/denominator contain the blank.
  const fraction = `<span class="concept-fraction"><span>${renderPart(part.fraction[0],hidden,concept,plain)}</span><span>${renderPart(part.fraction[1],hidden,concept,plain)}</span></span>`;
  return (part.limit ? `<span class="concept-limit"><span>lim</span><small>h → ${renderPart(part.limit[1],hidden,concept,plain)}</small></span>` : '') + fraction;
}

export function conceptVariants() {
  return CONCEPTS.flatMap(concept => [...slotsIn(concept.lines), ...(concept.extraSlots ?? [])].map(slot => ({
    conceptId: concept.id, name: concept.name, slotId: slot.id, answerId: slot.answer,
    // Cross-question answers can also be distractors, but exclude equivalent
    // expressions, tautologies and stronger hypotheses that also make a claim true.
    allowed: Object.keys(tokens).filter(id => !forbiddenChoices(concept.id,slot.id).includes(id)),
    preferred: slot.allowed,
    html: (['intermediate','rolle','mean-value','definite-integral'].includes(concept.id)
      ? `<div class="concept-assumption">${math(`${mi('a')}${mo('&lt;')}${mi('b')}`)}</div>`
      : concept.id==='average-rate' ? `<div class="concept-assumption">${math(`${mi('a')}${mo('≠')}${mi('b')}`)}</div>` : '') +
      concept.lines.map(parts => `<div class="concept-line">${renderPart(parts,slot.id,concept)}</div>`).join(''),
    prompt: concept.lines.map(parts => renderPart(parts,slot.id,concept,true)).join(' '),
  })));
}
function forbiddenChoices(concept, slot) {
  const denied=[];
  if(slot==='continuous') denied.push('미분 가능','일정');
  if(slot==='differentiable') denied.push('일정');
  if(concept==='differentiable-continuous') denied.push(slot==='differentiable'?'연속':'미분 가능');
  if(concept==='continuity' && slot==='limit') denied.push('f(a)');
  if(concept==='continuity' && slot==='value') denied.push('limf');
  if(concept==='intermediate') {
    if(slot==='value') denied.push('k');
    if(slot==='k') denied.push('f(c)');
  }
  if(concept==='extremum' && slot==='extremum') denied.push('극댓값','극솟값');
  if(['rolle','extremum'].includes(concept)) {
    if(slot==='derivative') denied.push('0');
    if(slot==='zero') denied.push(concept==='rolle'?'f′(c)':'f′(a)');
  }
  if(concept==='rolle' && ['derivative','zero'].includes(slot)) denied.push('df','revf');
  if(concept==='antiderivative') {
    if(slot==='derivative') denied.push('f(x)','F′');
    if(slot==='function') denied.push('F′(x)','f');
    if(slot==='primitive') denied.push('F');
    if(slot==='constant') denied.push('a','b','h','k');
  }
  if(concept==='definite-integral' && slot==='derivative') denied.push('f','F′(x)');
  return denied;
}
const pick = (items,rng) => items[Math.min(items.length-1,Math.floor(rng()*items.length))];
function shuffle(items,rng) {
  const result = items.slice();
  for(let i=result.length-1;i>0;i--) {
    const j=Math.min(i,Math.floor(rng()*(i+1)));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}

/** Select the whole sequence first; every displayed choice is reviewed for EVERY question. */
export function generateConceptSequence(spec, rng = Math.random) {
  const count = spec.questionCount ?? 1;
  if (![1,2,3].includes(count)) throw new Error('개념 질문 수는 1~3이어야 합니다.');
  const variants = conceptVariants();
  const selected = [pick(variants,rng)];
  let pool = selected[0].allowed;
  while(selected.length<count) {
    const candidates = variants.filter(q => !selected.includes(q)).filter(q => {
      const shared = pool.filter(id => q.allowed.includes(id));
      return shared.length>=5 && [...selected,q].every(item=>shared.includes(item.answerId));
    });
    if(!candidates.length) throw new Error('고정 보기를 공유할 개념 문제가 부족합니다.');
    const next=pick(candidates,rng);selected.push(next);
    pool=pool.filter(id=>next.allowed.includes(id));
  }
  const answerIds=[...new Set(selected.map(q=>q.answerId))];
  const preferred=pool.filter(id=>!answerIds.includes(id) && selected.some(q=>q.preferred.includes(id)));
  const fillers=[...shuffle(preferred,rng),...shuffle(pool.filter(id=>!answerIds.includes(id)&&!preferred.includes(id)),rng)];
  const ids=shuffle([...answerIds,...fillers.slice(0,5-answerIds.length)],rng);
  const choices=ids.map(id=>tokens[id].text);
  const choiceHtml=ids.map(id=>tokens[id].html);
  const questions=selected.map(q=>({ ...q, choices, choiceHtml,
    answer:tokens[q.answerId].text, correct:ids.indexOf(q.answerId),
    data:{kind:'concept'},
  }));
  return { questions, index:0, choices, failed:false, complete:false };
}

/** No undo or retry: the first incorrect selection permanently fails this cast. */
export function answerConcept(sequence, index) {
  if(sequence.failed || sequence.complete) return 'inactive';
  if(index!==sequence.questions[sequence.index].correct) {
    sequence.failed=true;return 'failed';
  }
  sequence.index++;
  if(sequence.index===sequence.questions.length) {sequence.complete=true;return 'complete';}
  return 'next';
}
