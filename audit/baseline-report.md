# BeanPick Baseline Report — 기준 스냅샷 전수 통계 (454건)

- 기준: `audit-input/snapshot-products.json` (sha256 `ac7739a7…`, 이미 검증됨)
- 발행 시점: 2026-09-21T07:03:57Z / repoHead `88fad74…`
- 산출 방식: 모든 숫자는 `audit/tools/baseline-compute.mjs` 실행 결과 (재계산 가능). displayed 값은 실제 앱 함수(`getProductCountryLabel`, `getProductOriginLabel`, `getProductProcessLabel`, `isDecafProduct`, `isGroundCoffeeProduct`, `formatProductDisplayInfo`, `getDisplayTastingNotes`)를 node에서 직접 import·실행한 결과. 추정 없음.

## 0. snapshot 품질 가드 요약 (`quality` 필드)

| 항목 | 값 |
|---|---|
| 수집 총량 total / 게시 cleanCount / 제외 excludedCount | 459 / **454** / 5 |
| 제외 5건 (가격·용량 범위 이탈, 품질 필터) | fillout-13622584403(에티오피아 알로 옥션랏 문쉐도우 내추럴, 15g), malik-13027488633(말릭, 상품명 "..", 792000원), lubia-13751499766(파나마 블랙 문 치로소, 18g), aerycoffee-12954024415·aerycoffee-12350312581(파나마 게이샤 20g) |
| flagged 2건 (100g당 가격 범위 이탈, 게시 유지) | cafedoan-11382491273(로즈 커피 Panama Longboard 게이샤, 100g당 391,429원), aerycoffee-13629620974(핀카 소피아 토르카자, 100g당 200,000원) |
| staleProductCount (오래된 상품) | 15 |
| preserved (품질 필터가 살린 예외) | 공식몰 상세 4건, 컵노트 13건 |
| collectionRuns 21건 | terarosa만 `failed`+`usedFallback:true`(15건), 나머지 complete |

## 1. 전체 통계 (454건 기준 재계산)

| 지표 | 값 |
|---|---|
| 총 상품 | **454** |
| 품절 (`isSoldOut: true`) | **154** (33.9%) |
| 판매 중 | **300** (66.1%) |
| 스마트스토어 / 공식몰 | **328** (72.2%) / **126** (27.8%) |
| 로스터리 수 | **21** |
| 디카페인 상품 | 28 |

※ 스마트스토어/공식몰 구분: 스냅샷에 `mall`·`source` 필드가 없어 `productUrl` 호스트로 판정. `smartstore.naver.com` = 스마트스토어, 나머지 8개 호스트(terarosa.com, centercoffee.co.kr, hellcafe.co.kr, coffeelibre.kr, namusairo.com, dblcoffee.com, 502coffee.com, fritz.co.kr, momos.co.kr, werk.co.kr) = 공식몰.

### 1-1. 상품 유형 분류 (자체 규칙 — 코드에 유형 분류 함수 없음)

우선순위대로 적용: `decaf` → `blend` → `dripbag` → `capsule` → `ground` → `goods` → `single` → `other`

| 유형 | 판정 규칙 | 전체 | 판매 중 |
|---|---|---|---|
| single | 국가 라벨(`getProductCountryLabel`) 있음 | 314 | 205 |
| blend | 상품명·variety·origin·process에 `blend/블렌드/블랜딩` | 59 | 47 |
| decaf | `isDecafProduct` (상품명·origin·process에 디카페인/decaf) | 28 | 21 |
| dripbag / capsule / ground / goods | 규칙 매칭 상품 없음 | 0 | 0 |
| other | 위 어느 것도 아님 (산지 라벨 없음, 블렌드 아님 — 53건) | 53 | 27 |

- `ground`: `isGroundCoffeeProduct`가 분쇄 표시를 찾지 못한 결과 0건. ("홀빈/분쇄불가" 제외 로직이 있어 분쇄 상품이 있으면 잡혔을 것)
- `goods` 후보 "파인컵"은 'Fine Cup' 등급 표기라 제외. 유일한 비음료형은 "[26년 추석] 보름달 블렌드 & 드리퍼 세트"이나 블렌드 규칙이 먼저 적용됨.

## 2. "없음" 정의 (raw vs displayed)

| 필드 | raw 없음 | displayed 없음 |
|---|---|---|
| 산지(origin) | `origin`이 빈 문자열/공백, 또는 **roasterName과 동일**(수집 단계 고정값 → 사실상 미수집) | `getProductCountryLabel(p) === ''` |
| 가공(process) | `process` 빈 문자열/공백 | `getProductProcessLabel(p) === ''` (상품명+process에서 규칙 매칭 실패) |
| 품종(variety) | `variety` 필드 빈 문자열/공백 | `formatProductDisplayInfo(p).variety === ''` (품종 규칙 + 한글 폴백 적용) |
| 로스팅(roast) | `roastLevel === '확인 필요'` 또는 빈 문자열 | raw와 동일 (앱이 `roastLevel`을 그대로 표시하고, 빈 값만 필터링함 — `src/App.jsx` 상세 모달 `'로스팅'` 행) |
| 컵노트(notes) | `tastingNotes` 배열 비어 있음 | `getDisplayTastingNotes(p).length === 0` (정규화+evidence 인식 포함 — 실제 렌더 함수) |

## 3. 필드별 존재율

| 필드 | raw 없음 | raw 존재율 | displayed 없음 | displayed 존재율 |
|---|---|---|---|---|
| 산지 | **328건** (빈칸 0건 + roasterName 고정 328건) | 27.8% | **114건** (블렌드 제외 **58건**) | 74.9% |
| 가공 | **328건** (전부 빈 문자열) | 27.8% | **103건** | 77.3% |
| 품종 | 420건 (variety 필드 보유 89건만) | 7.5% | 324건 (이름 규칙으로 107건 복구) | 28.6% |
| 로스팅 | **427건** (`확인 필요`) | 6.0% | 427건 | 6.0% |
| 컵노트 | 188건 | 58.6% | 188건 | 58.6% |

- raw 산지·가공 328건 = 정확히 스마트스토어 328건 전체. 스마트스토어는 수집 단계에서 `origin=roasterName`, `process=''`를 고정 대입하므로 "파서가 놓친" 것이 아니라 **"처음부터 시도하지 않은"** 것(`NOT_IMPLEMENTED` 후보).
- `roastLevel` 값 분포: `확인 필요` 427 / `Dark` 13 / `Light` 10 / `Medium` 4. 실제 단계 값이 들어간 27건은 모두 공식몰(커피리브레·502커피로스터스 등).
- 컵노트 displayed = raw와 동일 188건: `getDisplayTastingNotes`는 evidence를 `tastingNotes`에 정규화 포함된 경우에만 보여주므로, `tastingNotes`가 비면 evidence로도 복구되지 않음.

## 4. 로스터리별 표 (displayed 기준, raw 병기)

`Missing Origin/Variety/Notes/Roast` = displayed 없음. `Missing Origin(raw)` = origin 빈칸 또는 roasterName 동일. `Missing Process(raw)` = process 빈 문자열.

| Roastery | Total | Active | SS/Official | Miss Origin (disp/raw) | Miss Process (disp/raw) | Miss Variety (disp/raw) | Miss Roast | Miss Notes (disp/raw) |
|---|---|---|---|---|---|---|---|---|
| 에어리커피 | 82 | 9 | 82/0 | 1 / 82 | 5 / 82 | 31 / 82 | 82 | 69 / 69 |
| 카페도안 | 53 | 0 | 53/0 | 2 / 53 | 8 / 53 | 42 / 53 | 53 | 12 / 12 |
| 호커스포커스 로스터스 | 48 | 37 | 48/0 | 14 / 48 | 15 / 48 | 34 / 48 | 48 | 44 / 44 |
| 루비아 커피 | 36 | 31 | 36/0 | 10 / 36 | 10 / 36 | 32 / 36 | 36 | 5 / 5 |
| 필아웃커피 | 32 | 31 | 32/0 | 8 / 32 | 10 / 32 | 22 / 32 | 32 | 14 / 14 |
| 나무사이로 | 29 | 28 | 0/29 | 2 / 0 | 7 / 0 | 14 / 9 | 26 | 0 / 0 |
| 로스터릭 | 17 | 17 | 17/0 | 3 / 17 | 3 / 17 | 16 / 17 | 17 | 3 / 3 |
| 테라로사 | 15 | 15 | 0/15 | 5 / 0 | 4 / 0 | 14 / 15 | 15 | 0 / 0 |
| 커피리브레 | 15 | 15 | 0/15 | 7 / 0 | 5 / 0 | 9 / 7 | 0 | 6 / 6 |
| 모모스커피 | 14 | 13 | 0/14 | 8 / 0 | 8 / 0 | 13 / 14 | 14 | 5 / 5 |
| 말릭커피 | 13 | 8 | 13/0 | 5 / 13 | 0 / 13 | 10 / 13 | 13 | 11 / 11 |
| 커피정경 로스터리 | 13 | 12 | 13/0 | 5 / 13 | 5 / 13 | 11 / 13 | 13 | 0 / 0 |
| 토치 커피 | 12 | 10 | 12/0 | 4 / 12 | 1 / 12 | 10 / 12 | 12 | 8 / 8 |
| 딥블루레이크 | 12 | 12 | 0/12 | 8 / 0 | 1 / 0 | 10 / 12 | 12 | 1 / 1 |
| 아이덴티티 커피랩 | 11 | 11 | 11/0 | 3 / 11 | 2 / 11 | 9 / 11 | 11 | 2 / 2 |
| 히떼 로스터리 | 11 | 11 | 11/0 | 8 / 11 | 6 / 11 | 11 / 11 | 11 | 0 / 0 |
| 502커피로스터스 | 11 | 11 | 0/11 | 5 / 0 | 3 / 0 | 9 / 7 | 4 | 0 / 0 |
| 베르크커피 | 10 | 10 | 0/10 | 3 / 0 | 3 / 0 | 9 / 10 | 9 | 0 / 0 |
| 프릳츠 커피 컴퍼니 | 9 | 9 | 0/9 | 7 / 0 | 5 / 0 | 9 / 7 | 9 | 3 / 3 |
| 센터커피 | 8 | 8 | 0/8 | 3 / 0 | 1 / 0 | 6 / 8 | 8 | 2 / 2 |
| 헬카페 | 3 | 2 | 0/3 | 3 / 0 | 1 / 0 | 3 / 3 | 2 | 3 / 3 |

- 카페도안 53건 전량 품절. 에어리커피는 82건 중 판매 중 9건만.
- 공식몰은 raw 산지·가공이 존재(0 누락)하지만, displayed 가공은 상품명+raw 매칭 실패 시 여전히 누락 (예: 모모스 8건, 나무사이로 7건).

## 5. 컵노트 없음 (판매 중 300건 기준)

- 판매 중 컵노트 표시 없음: **98건** (32.7%). raw와 동일.
- 로스터리별 분포:

| 로스터리 | 판매 중 컵노트 없음 |
|---|---|
| 호커스포커스 로스터스 | 35 |
| 필아웃커피 | 13 |
| 말릭커피 | 8 |
| 루비아 커피 | 4 |
| 에어리커피 | 8 |
| 토치 커피 | 6 |
| 모모스커피 | 5 |
| 커피리브레 | 6 |
| 로스터릭 | 3 |
| 프릳츠 커피 컴퍼니 | 3 |
| 아이덴티티 커피랩 / 센터커피 / 헬카페 | 각 2 |
| 딥블루레이크 | 1 |

## 6. 섹션 2 수치 정정표 (454건 기준)

| 주장 (461건 기준, 원 스펙 §2) | 재계산 (454건) | 정정 여부 |
|---|---|---|
| 461건, 품절 155, 판매 중 306 | **454건, 품절 154, 판매 중 300** | ❌ 정정 |
| 스마트스토어 333 / 공식몰 128 | **328 / 126** | ❌ 정정 |
| 로스터리 21곳 | **21** | ⭕ 유지 |
| 판매 중 컵노트 없음 100건 (호커스포커스 34, 필아웃 14, 말릭 9, 에어리 8, 모모스 6, 토치 6) | **98건 (35, 13, 8, 8, 5, 6)** | ❌ 정정 (모모스 6→5, 호커스포커스 34→35 등) |
| 산지 미판별 114건 (블렌드 제외 54건) | **114건 (블렌드 제외 58건)** | △ 포함 숫자 유지, 제외 숫자 54→58 |
| 가공 미판별 100건 | **raw 328건 / displayed 103건** | ❌ 정정 — 기준 불명확. raw 기준이면 328건 전부가 빈 문자열, 표시 기준이면 103건 |
| `roastLevel === '확인 필요'` 434건 | **427건** | ❌ 정정 |
| `electron/naverShoppingSearch.cjs` 약 1767행 `origin: source.roasterName`, 약 1769행 `roastLevel: '확인 필요'` | **미확인** — Phase 0 파이프라인 매핑 단계에서 파일·행번호 실측 후 확정 | ⏳ 보류 |
| CI는 10종 중 6종만 실행 (빠진: map, officialmall, smartstore, contract) | **미확인** — workflow 파일 실측 필요 | ⏳ 보류 |

### 보충: 주장과 실측이 갈린 주요 원인
1. 기준 스냅샷 자체가 454건 (461건은 과거 커밋 시점 수치로 보임).
2. "가공 미판별 100건"은 displayed(103) 기준이었을 가능성이 높으나, raw 기준으로는 328건이 전부 비어 있어 기준 명시 없이는 무의미.
3. 모모스 컵노트 없음이 6→5로 줄어든 것은 판매 중 기준 재계산 결과.

## 7. 해석 (Phase 1 연결점)

1. **스마트스토어 산지·가공은 수집 단계 미구현**: 328건 전체가 `origin=roasterName`, `process=''` 고정. displayed 산지 214건은 상품명 규칙으로 복구되지만, 원천은 완전히 비어 있다. CASE 분류 시 `NOT_IMPLEMENTED`(수집 단계가 시도하지 않음) vs `PARSER_MISS`(텍스트에 있는데 파서가 놓침)를 구분해야 하며, 스마트스토어 산지·가공은 전자의 몫이 크다.
2. **로스팅은 수집 파이프라인 자체가 값을 안 만듦**: 427건이 `확인 필요`. 27건만 공식몰에서 들어옴. 이건 파서가 "놓친" 것이 아니라 대부분 원천에 없는 값.
3. **품종은 107건을 상품명 규칙으로 복구**: displayed 품종 130건(28.6%) 중 107건이 `variety` 필드 없이 이름 규칙 매칭. 에어리커피(게이샤 라인)가 대표적.
4. **컵노트 98건은 로스터리 편중**: 호커스포커스 35 + 필아웃 13 + 말릭 8 + 에어리 8 + 토치 6 = 전체의 71%. 이 5곳의 상세 원문/이미지 증거가 Phase 1의 우선 조사 대상.

---
*생성: `audit/tools/baseline-compute.mjs` (node, 실함수 실행) → `audit/baseline-metrics.json`. 원천 필드 정의·규칙은 `audit/tools/baseline-compute.mjs` 주석 참조.*
