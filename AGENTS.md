# AGENTS.md — BeanPick 에이전트 필수 규칙

이 저장소에서 작업하는 모든 AI 에이전트(Claude·Codex·Gemini/Antigravity)에게 적용된다.
근거 사건: 2026-06 발행 사흘 정지 — 전체 기록은 `.wiki/wiki/topics/publish-hang-postmortem.md`.

## 절대 금지

1. **게시 가드 약화·삭제 금지.** `electron/githubPublisher.cjs`의 붕괴/급감/할인 가드가 게시를
   막으면 그것은 버그가 아니라 데이터 이상 신호다. 가드를 고치지 말고 수집 원인을 고쳐라.
2. **실측 없이 타임아웃 단축 금지.** 정상 소요시간: Gemini 비전 OCR ~20초, 공식몰 상세 ~12초
   (하드캡 15초), 스마트스토어 페이지 로드 25초, 공식몰 보강 예산 90초. "정상은 몇 초면 끝난다"는
   가정으로 일괄 단축했다가 멀쩡한 기능(컵노트·로스터리 로딩)이 부서진 전례가 있다.
3. **테스트를 고쳐서 통과시키기 금지.** `safety-guards:test`가 실패하면 코드를 되돌려라.
   테스트 기준(하한값·가드 조건)을 낮추는 변경은 사용자 승인 없이는 금지.
4. **커밋·푸시·머지·배포는 사용자 승인 필수.** `.env`의 토큰·키를 출력·로그·커밋하지 마라.

## 완료 선언 기준 (Iron Law)

- **로컬 테스트 통과 ≠ 해결.** 발행 관련 수정은 실제 발행이 성공하고
  `Update BeanPick iPhone snapshot (NNN products)` 커밋을 확인해야 검증 완료다.
- 로컬은 되는데 CI/자동실행만 안 되면, 코드 로직보다 **환경 차이**(런타임·네트워크·IP 차단)를
  먼저 의심하라. 자기 로그에 남은 단서("로컬은 10초 내, CI만 멈춤")를 변명으로 치부하지 마라.
- 원인 진단 없이 수정을 쌓지 마라. 고쳐도 안 나으면 가설이 틀린 것이다 —
  같은 방향으로 더 고치지 말고 방향 자체를 의심하라.

## 작업 전·후 확인

- 안전 테스트 일괄 실행:
  `npm run tasting-notes:test && npm run core-features:test && npm run dataquality:test && npm run iphone-webapp:test && npm run history:test && npm run safety-guards:test`
- 지식베이스: `.wiki/` — 과거 사건·함정·검증 방법이 기록되어 있다. 코드 수정 전에 관련 문서를 확인하라.
