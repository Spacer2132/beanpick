# FIX-3(muse/fix-roast `0c5905c`) 독립 검증

작성: 2026-09-26. 측정 기준: `docs/products.json` 462건.

## 결론
| 부분 | 판정 | 조치 |
|---|---|---|
| 4b 상품명 기반 표시 보완 | 통과 | 그대로 반영. 462건 중 31건 표시 추가, 전부 상품명에 "미디엄 로스트"·"중강배전" 등 명시 |
| 4c 상세 텍스트 수집 보완 | **오탐** | 엄격 추출 `extractRoastLevelFromDetail`로 교체 |
| cafe24 목록 판정 덮어쓰기 | 규칙 위반 | 기존 목록 판정이 '확인 필요'일 때만 상세 값 사용 |
| 앱 상세 모달 '로스팅' 행 | 의도치 않은 UI 변화 | 값이 없으면 기존처럼 저장값('확인 필요') 표시 |

## 4c 오탐
Muse 버전은 상세 텍스트에 상품명용 규칙을 그대로 써서 단독 '다크/라이트/미디엄'을 로스팅으로 봤다.
- `Dark Chocolate`, `다크 초콜렛`(마스크는 '초콜릿'만), `Medium Dark Chocolate` → Dark / Medium-Dark
- `Body: Medium`, `미디엄 바디`, `medium acidity` → Medium
- `Light body`, `라이트한 산미` → Light
- 462건의 컵노트 원문만 넣어도 19건이 로스팅 값을 얻었다 (예: identity-13700316596 "Dark cherry" → Dark).
  Muse의 "오탐 0"은 상세 텍스트가 있는 76건 시뮬레이션만 본 결과다.

## 수정
- `extractRoastLevelFromDetail`: 로스팅 표기(로스트·배전·로스팅·roast)가 붙은 값만 인정.
  "로스팅 포인트/레벨/단계: 값" 형식 지원. 서로 다른 값이 2개 이상이면 비움.
- 수집 경로(`electron/main.cjs` 스마트스토어 상세, `cafe24DetailParser.cjs`)는 엄격 추출만 사용.
- 컵노트 원문 기준 오탐 19 → 0. 상품명 기반(4b) 결과는 변화 없음(31건).
- `scripts/test-roast-level.cjs`에 오탐 11개·정탐 7개 회귀 테스트 추가 (94개 검사 통과).

## 측정
- `audit:data` roast: Correct 161 → 192, Missing 62 → 31, Wrong 5 → 5, FALSE_POSITIVE 1 → 1. 다른 5개 필드 변화 0.
- 이 수치는 4b(표시 단계)만 반영한다. 4c(수집 단계)는 발행 후에 확정된다.
  엄격 추출이라 Muse 시뮬레이션의 +28보다 적게 복구될 수 있다.
- 테스트 11종(tasting-notes, core-features, dataquality, iphone-webapp, history, safety-guards,
  map, contract, smartstore, roast, audit)과 build 통과.
