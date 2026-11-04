import { normalizePolynomial } from './polynomial.js';

// Native MathML avoids canvas font-shrinking and an extra third-party runtime.
// All inputs are normalized numeric coefficients produced by our question engine.
function mn(n) { return `<mn>${n}</mn>`; }
function mi(s) { return `<mi>${s}</mi>`; }
function mo(s) { return `<mo>${s}</mo>`; }
function math(body) {
  return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow>${body}</mrow></math>`;
}
function termMarkup(term) {
  const numerator = Math.abs(term.num);
  const variable = term.power === 0 ? '' : term.power === 1 ? mi('x') :
    `<msup>${mi('x')}${mn(term.power)}</msup>`;
  const coeff = term.den === 1
    ? (numerator === 1 && variable ? '' : mn(numerator))
    : `<mfrac>${mn(numerator)}${mn(term.den)}</mfrac>`;
  return coeff + variable;
}
export function polynomialMathML(terms, includeC = false, leadingPlus = false) {
  const ordered = normalizePolynomial(terms);
  const pieces = ordered.length ? ordered.map((t,i) =>
    `${t.num<0?mo('−'):i||leadingPlus?mo('+'):''}${termMarkup(t)}`).join('') : mn(0);
  return math(pieces + (includeC ? `${mo('+')}${mi('C')}` : ''));
}
export function problemMathML(q, spell) {
  const input = normalizePolynomial(q.data.inputTerms);
  const polyBody = polynomialMathML(input).replace(/^.*?<mrow>/,'').replace(/<\/mrow><\/math>$/,'');
  if (spell === 'bolt') {
    const func = math(`${mi('f')}${mo('(')}${mi('x')}${mo(')')}${mo('=')}${polyBody}`);
    const result = math(`${mi('f')}${mo('′')}${mo('(')}${mi('x')}${mo(')')}${mo('=')}${mo('?')}`);
    return func + result;
  }
  return math(`${mo('∫')}${polyBody}${mi('d')}${mi('x')}${mo('=')}${mo('?')}`);
}

/** Show the active source term and the derivative assembled so far. */
export function boltSequenceMathML(sequence,spellName='번개') {
  const { question, selectedTerms, index } = sequence;
  const input = question.data.inputTerms.map((t, i) => {
    const body = `${t.num < 0 ? mo('−') : i ? mo('+') : ''}${termMarkup(t)}`;
    const active = i === sequence.sourceIndices[index];
    const done = sequence.sourceIndices.slice(0, index).includes(i);
    return `<mstyle class="bolt-source-term${active ? ' bolt-current-term' : done ? ' is-done' : ''}" mathcolor="${active ? '#ffe17c' : done ? '#738ca5' : '#d8e6f4'}">${body}</mstyle>`;
  }).join('');
  const result = selectedTerms.map((t, i) => {
    const body = `${t.num < 0 ? mo('−') : i ? mo('+') : ''}${termMarkup(t)}`;
    return `<mstyle class="bolt-formed-term${i === selectedTerms.length - 1 ? ' is-new' : ''}">${body}</mstyle>`;
  }).join('');
  const charge = sequence.correctIndices.map((_, i) =>
    `<span class="bolt-step${i < index ? ' is-filled' : i === index ? ' is-current' : ''}"></span>`).join('');
  return `<div class="bolt-charge" role="progressbar" aria-label="${spellName}" aria-valuemin="0" aria-valuemax="${sequence.correctIndices.length}" aria-valuenow="${index}">${charge}</div>` +
    `<div class="bolt-source">${math(`${mi('f')}${mo('(')}${mi('x')}${mo(')')}${mo('=')}${input}`)}</div>` +
    `<div class="bolt-answer${selectedTerms.length ? '' : ' is-empty'}">${math(`${mi('f')}${mo('′')}${mo('(')}${mi('x')}${mo(')')}${mo('=')}${result || '<mspace width="1.5em"/>'}`)}</div>`;
}

export function integralSequenceMathML(sequence,spellName='파이어볼') {
  const {question,selectedTerms,index}=sequence;
  const input=question.data.inputTerms.map((t,i)=>{
    const body=`${t.num<0?mo('−'):i?mo('+'):''}${termMarkup(t)}`;
    return `<mstyle class="integral-source-term${i===index?' integral-current-term':i<index?' is-done':''}" mathcolor="${i===index?'#ffc18e':i<index?'#738ca5':'#d8e6f4'}">${body}</mstyle>`;
  }).join('');
  const pieces=selectedTerms.map((t,i)=>`${t.num<0?mo('−'):i?mo('+'):''}${termMarkup(t)}`).join('');
  const charge=sequence.correctIndices.map((_,i)=>`<span class="bolt-step${i<index?' is-filled':i===index?' is-current':''}"></span>`).join('');
  const constant=sequence.selectedConstant?`${mo('+')}${mi('C')}`:'';
  return `<div class="bolt-charge" role="progressbar" aria-label="${spellName}" aria-valuemin="0" aria-valuemax="${sequence.correctIndices.length}" aria-valuenow="${index}">${charge}</div>`+
    math(`${mo('∫')}${mo('(')}${input}${mo(')')}${mi('d')}${mi('x')}`)+
    `<div class="bolt-answer${selectedTerms.length?'':' is-empty'}">${math(`${mo('=')}${pieces||'<mspace width="1.5em"/>'}${constant}`)}</div>`;
}

/** +C is its own final rune; never render it as 0+C. */
export function integralChoiceMathML(question,index,leadingPlus=false) {
  return question.data.choiceKinds[index]==='constant'?math(`${mo('+')}${mi('C')}`):
    polynomialMathML(question.data.choiceTermPolys[index],false,leadingPlus);
}
