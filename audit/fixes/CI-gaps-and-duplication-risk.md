# D3 보고 — CI 누락 테스트 + tastingNotes.js/.cjs 중복 위험 (보고만, 변경 없음)

## 1. CI에서 실행되지 않는 테스트
`.github/workflows/publish-iphone-snapshot.yml` (62-66행)에서 실행되는 테스트:
- tasting-notes:test, core-features:test, dataquality:test, iphone-webapp:test, history:test, safety-guards:test

`package.json`의 `verify` 스크립트에는 있지만 CI에서 실행되지 않는 테스트:
- **map:test** (`node scripts/test-map-feature.cjs`)
- **officialmall:test** (`node scripts/test-official-mall.cjs`)
- **smartstore:test** (`node scripts/test-smartstore-search.cjs`)
- **contract:test** (스크립트명 확인: package.json의 contract:test)

즉, `npm run verify`의 10개 중 4개가 CI 사각지대. 특히 smartstore/officialmall은 수집기(네트워크) 테스트라 CI에서 불안정할 수 있으나, contract:test는 순수 로직 테스트로 보여 CI 추가가 용이.

권장: CI 워크플로에 `map:test`와 `contract:test`를 추가 (네트워크 의존인 officialmall/smartstore는 별도 판단).

## 2. tastingNotes.js / tastingNotes.cjs 중복 위험
- `src/services/tastingNotes.js` (ESM, 앱)와 `src/services/tastingNotes.cjs` (CJS, 수집기·발행기)는 export 구문(`export {` vs `module.exports = {`) 외 동일해야 한다.
- 현재 상태: 위 export 1줄 외 diff 0 (2026-09-26 확인).
- 위험: 한쪽만 수정하면 수집기와 앱의 정규화 결과가 달라져, 발행된 데이터와 화면 표시가 어긋난다. FIX-1 같은 사전 수정 시 양쪽 동시 수정이 필수.
- 권장: 단일 소스에서 생성하거나, CI/테스트에서 두 파일의 export-외 동일성을 검사하는 가드 추가 (예: `diff <(sed ...) <(...)` 를 테스트에 포함). 단, 테스트 파일 추가는 별도 승인 필요.
