/**
 * 마법별 숫자·문제 설정은 이 파일만 수정하면 됩니다.
 * kind: "arithmetic" — +, -, ×, ÷(나누어떨어지는 정수 계산)
 * left/right: 피연산자 범위 (양끝 포함)
 * requireNonNegativeResult: 뺄셈 결과가 음수가 되지 않도록 제한
 * answerCount: 오각형 선택지는 5개 고정 (UI도 5개 기준)
 * distractor: 오답 숫자의 범위 및 정답 주변 거리 (radius)
 */
export const SPELLS = Object.freeze({
  bolt: {
    name: '번개',
    cooldownSeconds: 2,
    power: 20,
    problem: {
      kind: 'arithmetic',
      operator: '+',
      left: { min: 0, max: 9 },
      right: { min: 0, max: 9 },
      requireNonNegativeResult: true,
      answerCount: 5,
      distractor: { min: 0, max: 18, radius: 6 },
    },
  },
  heal: {
    name: '힐',
    cooldownSeconds: 6,
    power: 25,
    problem: {
      kind: 'arithmetic',
      operator: '-',
      left: { min: 0, max: 9 },
      right: { min: 0, max: 9 },
      requireNonNegativeResult: true,
      answerCount: 5,
      distractor: { min: 0, max: 18, radius: 6 },
    },
  },
});
