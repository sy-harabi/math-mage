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
