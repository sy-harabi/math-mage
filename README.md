# 계산 마법사 (Math Mage) — v0.4

뱀파이어 서바이버즈처럼 캐릭터를 따라오는 카메라를 사용하는 2D 수학 액션 게임. **정답을 클릭해야 스킬을 시전**합니다.

## 실행 및 GitHub Pages

GitHub Pages에서 설치 없이 실행됩니다. `main` 브랜치에 올린 다음 저장소의 **Settings → Pages → Build and deployment → Source: GitHub Actions**를 한 번 설정하세요. 이후 `main`에 커밋하면 `.github/workflows/pages.yml`이 자동 배포합니다.

- 저장소 주소: `https://github.com/<계정>/math-mage`
- 예상 게임 주소: `https://<계정>.github.io/math-mage/` (배포 완료 후)
- 로컬 실행: `python -m http.server 8000` → `http://localhost:8000/` (또는 VS Code Live Server)
- 테스트: Node.js가 설치된 환경에서 `npm test` (외부 패키지 설치 불필요)

> `index.html`은 자바스크립트 ES 모듈을 사용하므로 `file://`로 직접 여는 것보다 HTTP 서버에서 실행하세요.

## 게임 조작

- WASD/방향키 이동, 태블릿 화면 아래 방향 버튼
- `1` 번개: 덧셈 정답 선택 → 몬스터 클릭 (20 피해, 쿨타임 2초)
- `2` 힐: 뺄셈 정답 선택 → 즉시 회복 (25 HP, 쿨타임 6초)
- 시전 중 게임 속도 75%, 오답 시 1.5초 동안 이동속도 50%, 마나 없음
- 스킬 준비 시 캐릭터 위에 번개 표시, 스킬 바가 차오르면 쿨타임 종료

## 문제를 바꾸려면 — `src/spells.js`

**문제 난이도나 범위는 `src/spells.js`만 수정**하세요.

```js
bolt: {
  cooldownSeconds: 2,
  power: 20,
  problem: {
    kind: 'arithmetic',
    operator: '+',                   // '+', '-', '×', '÷'
    left: { min: 0, max: 9 },       // 왼쪽 숫자
    right: { min: 0, max: 9 },      // 오른쪽 숫자
    requireNonNegativeResult: true,
    answerCount: 5,
    distractor: { min: 0, max: 18, radius: 6 },
  },
}
```

예: 번개를 두 자리 덧셈으로 변경하고 싶으면 `left`, `right`의 `max`를 각각 `99`로 늘리고, 선택지용 `distractor.max`를 `198`까지 늘리면 됩니다. 정답만 1개, 선택지 5개는 엔진이 보장합니다.

문제은행 방식으로도 바꿀 수 있습니다. 예를 들어 `problem`을 아래처럼 지정하면 문자식도 게임 코드를 수정하지 않고 출제할 수 있습니다.

```js
problem: {
  kind: 'questionBank',
  answerCount: 5,
  items: [
    { prompt: 'x + 3 = 7, x = ?', answer: '4', distractors: ['1','2','3','5','6'] },
    { prompt: '1/2 + 1/2 = ?', answer: '1', distractors: ['0','2','1/2','3/2'] },
  ],
}
```

새로운 문제 **생성 방식**을 직접 만들고 싶다면 `src/problem-engine.js`의 `PROBLEM_GENERATORS`에 생성 함수를 등록하고 스킬 설정의 `kind`를 바꿉니다. 생성 함수는 아래 형태만 반환하면 UI를 변경할 필요가 없습니다.

```js
{ prompt: '7 + 3 = ?', answer: '10', choices: ['9','11','8','10','12'], correct: 3 }
```

## 구조

```text
index.html                      # 페이지 구성
src/styles.css                 # UI 스타일
src/game.js                    # 이동, 충돌, 몬스터, 시전, 그리기
src/spells.js                  # 스킬별 문제 규칙·위력·쿨타임
src/problem-engine.js          # 무작위 문제·정답·오답 생성기
.github/workflows/pages.yml    # main 브랜치에서 자동 Pages 배포
tests/problem-engine.test.mjs  # 무작위 문제 생성 검증
```

이 프로젝트는 백엔드 없이 브라우저에서 작동하며 플레이 기록을 서버에 저장하지 않습니다.
