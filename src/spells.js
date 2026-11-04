/**
 * 마법별 문제 규칙을 바꾸려면 여기의 problem 항목을 수정하세요.
 * monomialDerivative: f(x)=ax^n의 도함수
 * monomialIntegral: ∫ax^n dx의 부정적분 (적분상수 C는 문제에만 표기)
 * coefficient: 0을 제외한 정수 계수 범위 (음수와 양수 모두 출제)
 * exponent: 원래 함수의 차수 범위, 난이도는 현재 고정
 * 답안의 분수 계수는 기약분수로 정확하게 표현
 */
export const SPELLS = Object.freeze({
  bolt: {
    name: '번개',
    cooldownSeconds: 2,
    power: 20,
    problem: {
      kind: 'monomialDerivative',
      coefficient: { min: -5, max: 5 },
      exponent: { min: 2, max: 4 },
      answerCount: 5,
    },
  },
  heal: {
    name: '힐',
    cooldownSeconds: 6,
    power: 25,
    problem: {
      kind: 'monomialIntegral',
      coefficient: { min: -5, max: 5 },
      exponent: { min: 1, max: 3 },
      answerCount: 5,
    },
  },
});
