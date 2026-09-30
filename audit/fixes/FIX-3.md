# FIX-3 — 로스팅(roast) 재현율 개선

상태: 구현 완료, Reviewer 승인 (1차 반려→수정→재검증 승인, 2026-09-26 20:47 KST). 커밋하지 않음.
브랜치: `muse/fix-roast` (origin/main에서 분기, FIX-1 반영·FIX-2 미반영).

## 1. 기준선 → 결과

기준선 (`npm run audit:data -- docs/products.json`, 2026-09-26):
- roast Correct 161, Wrong 5, Missing 62, FALSE_POSITIVE 1, Skip 201 (golden 커버 430/462)
- 재현율 10/73 (13.7%), roastLevel 분포: '확인 필요' 435, Dark 13, Light 10, Medium 4

### 4b (상품명 표시 보완 — 실측, stash 전후)
- Missing→Correct **31**, Correct→Wrong 0, Correct→Missing 0, FP 증가 0, 타 필드 변화 0
- 측정: `audit/tools/grade-dump.mjs`로 신/구 코드 등급 덤프 후 전이 비교

### 4c (상세 텍스트 수집 — 시뮬레이션 추정치)
- `audit/tools/simulate-roast.mjs`: audit-input 상세 텍스트로 수집 단계(4c 로직) 흉내
- 복구 **28**, 사라진 값 0, 맞다가 틀려진 값 0, 새로 생긴 거짓양성 0
- `npm run audit:data -- /tmp/sim-roast.json --before docs/products.json`

### 결합 (4b + 4c 시뮬레이션)
- roast Correct **161→220 (+59)**, Missing 62→3 (−59), Wrong 5→5, FALSE_POSITIVE 1→1
- 재현율 **10/73 (13.7%) → 69/73 (94.5%)**
- 잔여 4건: 이미지 근거 2건(OCR 2단계 대상), 블렌드 대표값 없음 1건(비움이 정답), current_echo 1건(스코프 밖)

## 2. 구현 내용

- **신규** `src/services/roastLevel.js` / `roastLevel.cjs` (export 구문 외 동일 — 단위 테스트에서 검사)
  - `extractRoastLevel(text)`: 5단계 enum 매핑. 명시적 표기(볶음도/배전도/로스팅±값, 값-앞/뒤 모두) 우선, 모호(2개 이상 레벨)→''.
  - `getDisplayRoastLevel(product)`: 저장값이 '확인 필요'/빈 값이 아닐 때 그대로, 그 외 상품명에서 보완. 상품명에는 로스트 표기(로스트·배전·볶음·로스팅) 필수 (bare '다크' 오탐 방지).
  - 매핑: 약배전→Light, 중약배전→Medium-Light, 중배전→Medium, 중강배전→Medium-Dark, 강배전→Dark (+미디움 변형).
  - 비매핑: Well-done/웰던, 시나몬/시티/풀시티/프렌치/이탈리안/비엔나, 필터/에스프레소 로스트 (corpus 근거 없음).
  - 오탐 마스크: 다크초콜릿/다크체리/라이트바디(컵노트), 다크우드/Darkwood(라인명), 다크브라운(색상), 필디카프(라인명), 프렌치프레스(기구).
- **4b**: `src/App.jsx` 219행 → `getDisplayRoastLevel(product)`, `audit/tools/audit-data.mjs` displayedOf 동일 함수 사용.
- **4c**: `electron/main.cjs` `enrichSmartStoreProductsWithDetailInfo`에서 detailText로 추출 (미상일 때만),
  `src/services/adapters/cafe24DetailParser.cjs` `parseCafe24DetailInfo`에 roastLevel 추가,
  `cafe24OfficialAdapter.ts`에서 `detail?.roastLevel` 우선 (기존 crude regex는 fallback 유지).
- **테스트**: `scripts/test-roast-level.cjs` (76 checks) + package.json `roast:test`. §3 오탐 목록 각각 + 매핑 표 각각 + .js/.cjs 동일성.
  (재검증 권고 반영: 질문형 마스크를 `/…(\s*(로스팅|로스트|배전))?\s*인가요/`로 일반화 — '약배전인가요?' 같은 형태도 제외. 454건 코퍼스 전수에 영향 0.)
- **도구**: `audit/tools/collect-roast-vocabulary.mjs`, `audit/fixes/roast-vocabulary.json` (51 패턴),
  `audit/tools/simulate-roast.mjs`, `audit/tools/grade-dump.mjs`, `audit/tools/build-roast-change-list.mjs`.

## 3. 462건 전체 변경 목록

`audit/fixes/roast-change-list.json` — 462건 중 **59건** 변경 (상품 id, 이전→이후, 근거 텍스트 포함).
after 분포: Dark 15, Medium 21, Light 15, Medium-Dark 7, Medium-Light 1.
golden HIGH/MEDIUM 대조: 불일치 **0건**.
(Reviewer 지적 1건 `deepbluelake-146`("다크딥 블랜딩"→Dark 오판, golden UNKNOWN) 제외 후. 마스크에 `/다크\s*딥/`, 질문형(`/다크...로스팅인가요?/`) 추가, 회귀 테스트 4건 추가.)

## 4. Reviewer 검증 (1차: 반려 → 수정 후 재검증 요청)

1차 검증 결과: 59건 정판정, **1건 오판**(`deepbluelake-146` — "다크딥 블랜딩" 블렌드명을 배전도로 오인, golden "원문에 배전도 정보 없음"). 수정 완료: 마스크 2종 추가(후속 일반화 1건), 회귀 테스트 7건 추가, 변경 목록에서 제외. 등급 수치에는 영향 없음 (해당 건 golden UNKNOWN=Skip).
**재검증 결과: 승인** (2026-09-26 20:47 KST). 59건 오판 0건, 11종 테스트 전부 통과, 측정 재현 일치, 금지 위반 없음.
추가 검증 요청:
1. `audit/fixes/roast-change-list.json` 59건을 한 건씩 판정 (특히 근거 텍스트가 상세 이미지/텍스트 경계에 있는 것).
2. `npm run roast:test` + 10개 스위트 재실행 확인.
3. 4c는 시뮬레이션 추정치 — 실제 발행 후 수치 확정 필요.
4. 구현 중 발견·수정된 이슈 3건 (리뷰 포인트):
   - `tasting-note-evidence` 테스트의 import 목이 `../roastLevel.js`를 거부 → 어댑터의 import를 되돌리고 `detail?.roastLevel` 우선 + 기존 regex fallback 유지 (테스트 수정 금지 규칙 준수).
   - 상품명 bare '다크' 오탐 2건 ('다크브라운', '[에어리커피] 다크 블렌드' — golden이 라인명임을 명시) → 상품명 경로에 로스트 표기 필수 조건 추가.
   - '미디움 다크 로스트'(히떼로스터리 표기 변형) 누락 → `미디[엄움]` 변형 추가. "기존의 다크 로스팅과 미디엄 다크 로스팅" 같은 회고적 언급은 값-앞 명시적 표기로 2개 레벨 검출 → 모호성 '' 처리.

## 5. 테스트 출력

```
tasting-notes: errors=0 / roast: errors=0 (76 checks) / core-features: errors=0
dataquality: errors=0 / iphone-webapp: errors=0 / history: errors=0
safety-guards: errors=0 / map: errors=0 / contract: errors=0 / smartstore: errors=0
npm run audit:test: ALL PASS
```

## 6. 막힌 항목

- 4c는 실제 수집이 아닌 시뮬레이션 — 발행 후 `npm run audit:data -- docs/products.json` 재측정으로 확정 필요.
- `coffee502-93` (5종 블렌드, 구성별 로스팅 상이): 대표값이 없어 '' 유지가 정답. 규칙상 해결 불가.
- 잔여 이미지 근거 2건은 OCR 2단계(`audit/fixes/FIX-3-design.md` 갱신됨, 재OCR 대상 약 59건)로만 해결 가능.
- `src/data/mockBeans.ts`의 비표준 'Light-Medium' 1건은 목 데이터라 손대지 않음.
