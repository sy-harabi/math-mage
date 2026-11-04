# 계산 마법사 (Math Mage) — v0.5

뱀파이어 서바이버즈처럼 캐릭터를 따라오는 카메라를 사용하는 2D 수학 액션 게임. **수학 문제의 정답을 선택해야 마법을 사용할 수 있습니다.**

**[게임 플레이](https://sy-harabi.github.io/math-mage/)** · [GitHub 저장소](https://github.com/sy-harabi/math-mage)

## 플레이 방법

- WASD/방향키 이동, 태블릿 화면 아래 방향 버튼
- `1` 번개: **단항식 도함수**의 정답 선택 → 몬스터 클릭 (20 피해, 쿨타임 2초)
- `2` 힐: **단항식 부정적분**의 정답 선택 → 즉시 회복 (25 HP, 쿨타임 6초)
- 마법을 고르는 동안 게임은 75% 속도, 오답 시 1.5초 동안 이동속도 50% 감소. 마나 없음
- 체력은 캐릭터 위의 초록 바, 번개 사용 가능 여부는 캐릭터 위 번개 아이콘으로 확인
- 각 마법의 쿨타임은 하단에 차오르는 바 표시

## 문제 생성 규칙 (고정 난이도)

| 스킬 | 문제 유형 | 원래 단항식 계수 | 원래 단항식 차수 | 정답 |
|---|---|---|---|---|
| 번개 | `f(x)=axⁿ` 의 도함수 | −5~−1, 1~5 | 2~4 | `an xⁿ⁻¹` |
| 힐 | `∫axⁿ dx = ? + C` | −5~−1, 1~5 | 1~3 | `(a/(n+1)) xⁿ⁺¹` |

- **양수와 음수 계수** 모두 등장하고 0은 제외합니다.
- **힐 답안의 분수 계수**도 허용하며 기약분수 형태로 출력합니다. 예: `∫−5x³ dx = ? + C` → `−(5/4)x⁴`.
- 오각형 보기 5개는 정답 1개와 전형적 계산 실수에서 생성한 오답 4개이며, 구조화된 수학 표현으로 동치식 중복을 제거합니다.
- `+ C`는 문제에 미리 표시되므로 선택지에는 적분상수를 생략합니다.
- 부동소수점 오차 없이 **정수 분자/분모**로 계산합니다.

## 출제 규칙 바꾸기

스킬별 난이도·문제 유형은 **[`src/spells.js`](src/spells.js)**에서 설정합니다.

```js
bolt: {
  cooldownSeconds: 2,
  power: 20,
  problem: {
    kind: 'monomialDerivative',   // 도함수
    coefficient: { min: -5, max: 5 },
    exponent: { min: 2, max: 4 },
    answerCount: 5,
  },
}
```

힐은 `kind: 'monomialIntegral'`, `exponent: { min: 1, max: 3 }`입니다. 범위를 바꾸면 문제 생성기가 자동으로 그 범위에서 출제합니다. 문제를 문자열로 직접 계산하지 않고 [`src/monomial.js`](src/monomial.js)의 정규화된 `{ num, den, power }`로 정확히 다룹니다.

새 문제 유형은 [`src/problem-engine.js`](src/problem-engine.js)의 `PROBLEM_GENERATORS`에 생성기를 등록하여 추가합니다. 기존 `arithmetic`(사칙연산)과 `questionBank`(문제은행)도 유지합니다.

반환값은 기본적으로 다음을 따릅니다.

```js
{
  prompt: 'f(x) = −3x⁴, f′(x) = ?',
  display: ['f(x) = −3x⁴', 'f′(x) = ?'], // 게임 화면 2줄 표현 (선택)
  answer: '−12x³',
  choices: ['−3x³', '−12x⁴', '−12x³', '−7x³', '12x³'],
  correct: 2,
}
```

## 개발 및 자동 배포

- 개발 서버: `python -m http.server 8000` → `http://localhost:8000/` 또는 VS Code Live Server
- 자동 테스트: Node.js에서 `npm test` (추가 의존성 없음)
- `main`에 커밋하면 GitHub Actions가 문제 검증 후 Pages에 자동 배포합니다.
- ES 모듈을 사용하므로 `file://` 대신 HTTP 서버에서 실행하세요.

```text
index.html                      # 게임 페이지
src/styles.css                  # HTML UI 스타일
src/game.js                     # 이동, 전투, 화면/UI, 오각형 정답 클릭
src/spells.js                   # 마법별 문제 설정
src/monomial.js                 # 단항식·기약분수 표현과 정확한 미분/적분
src/problem-engine.js          # 문제·정답·오답 생성
.github/workflows/pages.yml    # GitHub Pages 배포
 tests/problem-engine.test.mjs # 문제 생성 검사
```

이 프로젝트는 브라우저에서 실행되며 플레이 기록은 서버에 저장하지 않습니다.

## v0.7 — 오답 출제 비중과 스킬 레벨

- 오답 **각 보기**의 유형 추첨 가중치: 공식 적용 실수 50%, 부호·적분상수 실수 20%, 단순 계산 실수 30%. 네 개의 오답을 독립적으로 추첨하므로 한 문제 안의 실제 개수는 달라진다. 중복·동치식은 제거한다.
- 적분의 정답은 언제나 `+ C`가 포함된다. 적분상수 누락은 20% 유형의 후보 중 하나여서 **매번 반드시 나오지는 않는다** (기존 고정 패턴 제거).
- 번개 Lv1: 단항식 미분, 타격 개체 1. 번개 Lv2: 서로 차수가 다른 두 항으로 이루어진 다항식 미분, 클릭한 개체부터 **최대 두 개체**에 연쇄 타격한다. 연쇄 거리 260px, 각 개체 피해 20.
- 현재 레벨업 시점/보상 선택 규칙은 확정 전이므로 **번개 Lv2 체험** 버튼으로 Lv1·Lv2를 수동 전환한다. 추후 경험치/웨이브 보상에서 `getSpellAtLevel`을 호출하면 된다.
- 주요 구현: `src/spells.js` (레벨별 설정), `src/problem-engine.js` (가중 오답), `src/polynomial.js` (동치식·표시), `src/combat.js` (연쇄 대상 선택).
