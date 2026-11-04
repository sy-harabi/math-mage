/**
 * 단항식 표준 표현 { num, den, power }.
 * 부호는 분자에만 저장하고 분모는 양수로 유지한다.
 * 부동소수점 대신 정수 분자·분모로 정확히 계산한다.
 */
const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

function gcd(a, b) {
  while (b !== 0) [a, b] = [b, a % b];
  return Math.abs(a);
}

export function term(num, den, power) {
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den) || den === 0 ||
      !Number.isSafeInteger(power) || power < 0) {
    throw new Error('단항식에는 유효한 정수 분자·분모와 음이 아닌 정수 차수가 필요합니다.');
  }
  if (den < 0) { num = -num; den = -den; }
  if (num === 0) return { num: 0, den: 1, power: 0 };
  const divisor = gcd(Math.abs(num), den);
  return { num: num / divisor, den: den / divisor, power };
}

export function termKey(t) {
  const normalized = term(t.num, t.den, t.power);
  return `${normalized.num}/${normalized.den}:${normalized.power}`;
}

function superPower(n) {
  return String(n).split('').map(digit => SUPERSCRIPTS[Number(digit)]).join('');
}

export function termText(raw) {
  const t = term(raw.num, raw.den, raw.power);
  if (t.num === 0) return '0';
  const sign = t.num < 0 ? '−' : '';
  const numerator = Math.abs(t.num);
  const variable = t.power === 0 ? '' : `x${t.power === 1 ? '' : superPower(t.power)}`;
  const coefficient = t.den > 1 ? `(${numerator}/${t.den})` :
    (numerator === 1 && variable ? '' : String(numerator));
  return sign + coefficient + variable;
}

export function derivativeOf(a, n) {
  return term(a * n, 1, n - 1);
}

export function integralOf(a, n) {
  return term(a, n + 1, n + 1);
}
