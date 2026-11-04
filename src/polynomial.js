import { term, termText } from './monomial.js';

/** Rational coefficients are reduced before combining equal powers. */
export function normalizePolynomial(input) {
  const byPower = new Map();
  for (const raw of input) {
    const t = term(raw.num, raw.den, raw.power);
    if (!t.num) continue;
    const prev = byPower.get(t.power);
    byPower.set(t.power, prev ? term(prev.num * t.den + t.num * prev.den,
      prev.den * t.den, t.power) : t);
  }
  return [...byPower.values()].filter(t => t.num !== 0).sort((a, b) => b.power - a.power);
}

export function polynomialKey(terms) {
  return normalizePolynomial(terms).map(t => `${t.num}/${t.den}:${t.power}`).join('|') || '0';
}

export function polynomialText(terms) {
  const ordered = normalizePolynomial(terms);
  if (!ordered.length) return '0';
  return ordered.map((t, i) => {
    const text = termText(t);
    if (!i) return text;
    return text.startsWith('−') ? ` − ${text.slice(1)}` : ` + ${text}`;
  }).join('');
}

/** For narrow pentagon choices, one line per term keeps two-term answers legible. */
export function polynomialChoiceLines(terms, hasConstant = false) {
  const ordered = normalizePolynomial(terms);
  if (ordered.length <= 1) return [polynomialText(ordered) + (hasConstant ? ' + C' : '')];
  return ordered.map((t, i) => {
    const raw = termText(t);
    const piece = i && raw.startsWith('−') ? `− ${raw.slice(1)}` :
      i ? `+ ${raw}` : raw;
    return piece + (i === ordered.length - 1 && hasConstant ? ' + C' : '');
  });
}
