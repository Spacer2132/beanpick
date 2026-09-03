# CLAUDE.md — BeanPick

커피 원두 정보를 수집해 아이폰 웹앱으로 발행하는 Electron 프로젝트.

전체 규칙은 `AGENTS.md`(Claude·Codex·Gemini 공통), 사건 기록은 `.wiki/`에 있다.
아래는 **매 세션 반드시 지켜야 하는 것만** 추린 것이다.

> 근거 사건: 2026-06 발행 사흘 정지 — 전체 기록 `.wiki/wiki/topics/publish-hang-postmortem.md`

## 절대 금지

1. **게시 가드 약화·삭제 금지.** `electron/githubPublisher.cjs`의 붕괴/급감/할인 가드가 게시를
   막으면 그건 버그가 아니라 데이터 이상 신호다. 가드를 고치지 말고 수집 원인을 고쳐라.
2. **실측 없이 타임아웃 단축 금지.** 정상 소요시간: Gemini 비전 OCR ~20초, 공식몰 상세 ~12초
   (하드캡 15초), 스마트스토어 페이지 로드 25초, 공식몰 보강 예산 90초. "정상은 몇 초면 끝난다"는
   가정으로 일괄 단축했다가 멀쩡한 기능(컵노트·로스터리 로딩)이 부서진 전례가 있다.
3. **테스트를 고쳐서 통과시키기 금지.** `safety-guards:test`가 실패하면 코드를 되돌려라.
   하한값·가드 조건을 낮추는 변경은 사용자 승인 없이는 금지.
4. **커밋·푸시·머지·배포는 사용자 승인 필수.** `.env`의 토큰·키를 출력·로그·커밋하지 마라.

## 완료 선언 기준 (Iron Law)

- **로컬 테스트 통과 ≠ 해결.** 발행 관련 수정은 실제 발행이 성공하고
  `Update BeanPick iPhone snapshot (NNN products)` 커밋을 확인해야 검증 완료다.
- 완료 선언 전 합성 테스트 말고 **실데이터 N건으로 재현**하고 수치를 결과문에 남긴다.
- 매칭·필터·정규화를 바꾸면 **전후를 같은 실데이터에 돌려 "사라진 것" 목록**을 뽑고 하나씩 판정한다.
  가짜양성을 없애다 가짜음성을 만드는 게 최대 리스크다.
- 로컬은 되는데 CI·자동실행만 안 되면 코드 로직보다 **환경 차이**(런타임·네트워크·IP 차단)를 먼저 의심하라.
- 원인 진단 없이 수정을 쌓지 마라. 고쳐도 안 나으면 가설이 틀린 것이다 —
  같은 방향으로 더 고치지 말고 방향 자체를 의심하라.

## 명령

```bash
npm run verify
```

- 셸에서 직접 칠 때는 **`npm`** 으로 충분하다. `package.json`의 `verify` 체인·`.claude/launch.json`·
  `run-publish.ps1`이 `npm.cmd`를 쓰는 건 그쪽이 셸 없이 실행되기 때문이지, 셸 규칙이 아니다.
- ⚠️ `verify`는 가벼운 테스트가 아니다 — 테스트 8종 + `build` + `package:portable`까지 돈다.
  `scripts/package-portable.cjs`가 **`.env`를 패키징 폴더로 병합**하므로 그 산출물은 커밋·공유 금지.
- 빠른 확인만 필요하면 개별로: `safety-guards:test` · `tasting-notes:test` · `officialmall:test` ·
  `smartstore:test` · `core-features:test` · `history:test` · `dataquality:test` · `iphone-webapp:test`

## 작업 전

- `.wiki/wiki/topics/`와 `.wiki/_index.md`에 과거 사건·함정·검증 방법이 있다. 코드 수정 전에 확인하라.
- 코드 구조 질문은 `graphify-out/GRAPH_REPORT.md` 먼저. 수정 후에는 `graphify update .`.
- 더 깊은 검증 방법론은 `.wiki/raw/notes/agent-working-standards.md`
  (평소 로드하지 않는 온디맨드 문서 — 왜 그 규칙인지 궁금할 때만).
