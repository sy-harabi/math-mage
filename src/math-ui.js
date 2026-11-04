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
export function polynomialMathML(terms, includeC = false) {
  const ordered = normalizePolynomial(terms);
  const pieces = ordered.length ? ordered.map((t,i) =>
    `${t.num<0?mo('−'):i?mo('+'):''}${termMarkup(t)}`).join('') : mn(0);
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
export function boltSequenceMathML(sequence) {
  const { question, selectedTerms, index } = sequence;
  const input = question.data.inputTerms.map((t, i) => {
    const body = `${t.num < 0 ? mo('−') : i ? mo('+') : ''}${termMarkup(t)}`;
    return i === sequence.sourceIndices[index] ? `<mstyle class="bolt-current-term" mathcolor="#ffe17c">${body}</mstyle>` : body;
  }).join('');
  const result = sequence.correctIndices.map((_, i) => {
    const t = selectedTerms[i];
    return t ? `${t.num < 0 ? mo('−') : i ? mo('+') : ''}${termMarkup(t)}` :
      `${i ? mo('+') : ''}${mo('□')}`;
  }).join('');
  return math(`${mi('f')}${mo('(')}${mi('x')}${mo(')')}${mo('=')}${input}`) +
    math(`${mi('f')}${mo('′')}${mo('(')}${mi('x')}${mo(')')}${mo('=')}${result}`) +
    '<span class="bolt-build-hint">왼쪽 항부터 선택 · 한 번 틀리면 실패</span>';
}
