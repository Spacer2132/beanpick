# BeanPick 파이프라인 맵 (pipeline-map.md)

- 작성: 2026-09-25 (Phase 0)
- 범위: 기준 스냅샷 `audit-input/snapshot-products.json` (454건, sha256 `ac7739a7…` = manifest.snapshot.sha256 일치 확인) 을 만드는 데이터 흐름
- 방법: 코드 읽기만. `electron/`, `src/`, `scripts/`, `.github/` 어떤 파일도 수정하지 않음
- 흐름: 상품 발견 → 상세 수집 → HTML/텍스트 → OCR/Gemini → 추출 → 정규화 → 산지/가공/품종/로스팅/컵노트 판별 → 중복 제거 → 상태 판정 → 품질 필터·게시 가드 → `docs/products.json` → 앱 표시
- 스마트스토어 경로와 공식몰 경로(cafe24/imweb/테라로사/momos)는 분리 기술

---

## 0. 아키텍처 요약

- **메인 프로세스(Electron)**: 목록/상세 네트워크 수집 전체, 상세 파싱(스마트스토어), OCR/Gemini 실행, GitHub 게시. 진입점 `electron/main.cjs`.
- **렌더러(React, `src/App.jsx`)**: 공식몰 목록 HTML→상품 객체 변환(어댑터), 수집 오케스트레이션("오늘의 원두 불러오기", App.jsx:873 `handleLoadProducts`), 중복 제거·정규화·캐시 저장, 게시 버튼.
- **IPC 연결 3종** (main.cjs:2020~2026):
  - `beanpick:fetch-collection-source` — 렌더러→메인, 수집 드라이버 실행
  - `beanpick:promote-collection-products` — 렌더러→메인, 수집 계약(contract) 적용
  - `beanpick:publish-iphone` — 렌더러→메인, GitHub 게시
- 드라이버 매핑 (main.cjs:2012~2016): `smartStoreCategory→fetchSmartStoreProducts`, `terarosaApi→fetchTerarosaProducts`, `momosShop→fetchMomosProducts`, `officialMallPages→fetchOfficialMallProducts`. 채널 등록은 `electron/collection/registry.cjs` `buildChannels`(37행).
- 렌더러 수집 오케스트레이션: `src/App.jsx` `handleLoadProducts`(873행) → 소스별 `fetchProducts`(880~914) → 드라이버 분기 → `officialMallPages`는 렌더러 어댑터에서 `normalizeCafe24Pages(pages, OFFICIAL_MALL_CONFIGS[sourceId])` (cafe24OfficialAdapter.ts:567; imweb 선택: `config.parser === 'imweb' ? parseImwebProducts : parseCafe24Products`, App.jsx:903~913), `momosShop→normalizeMomosPages`(momosOfficialAdapter.ts:317), `terarosaApi→normalizeTerarosaApiRows`(454) 또는 `parseTerarosaHtmlProducts`(497) + `enrichTerarosaProducts`(407).
- 수집→정제→게시 전체 공통 종료점: `electron/githubPublisher.cjs` `publishProductsToGitHub`(795행).

---

## 1. 상품 발견

### 1-A. 스마트스토어 경로

| 파일(행) | 함수 | 입력 | 출력 | fallback | 캐시 | 실패 시 동작 |
|---|---|---|---|---|---|---|
| main.cjs:1977 | `fetchSmartStoreProducts` | sourceId | 카테고리 크롤 결과 | `coffeejg`만 커머스 API 시도 (1987) | — | `ok:false` 반환, runManager가 FAILED 기록 |
| main.cjs:1004 | `fetchSmartStoreCategoryProducts` | sourceId | `{products, listCompleteness, categoryResults}` | 카테고리 단위 실패해도 나머지 계속 (1062~1068) | 상세 캐시 | catch에서 `listCompleteness: FAILED` + warning |
| main.cjs:540 | `crawlSmartStoreCategory` | categoryUrl | `{products, rawMarkup, completeness, pagesFetched, pagesFailed, endReason}` | 미확인(세부 실측 필요시 별도) | — | — |
| naverShoppingSearch.cjs:1754 | `normalizeSmartStoreCategoryItem` | 아이템 DOM 파싱 결과 | 상품 객체 — **origin=로스터리명 고정, process='', roastLevel='확인 필요' 고정** | — | — | — |
| naverShoppingSearch.cjs:1687 | `normalizeNaverCommerceProduct` | 커머스 API row (coffeejg 전용) | `normalizeSmartStoreCategoryItem` 위임 + `weight: parseExplicitWeight(rawTitle)` | — | — | — |
| naverShoppingSearch.cjs:1793 | `normalizeSmartStoreCategoryItems` | 아이템 목록 | `isAmbiguousBulkOptionProduct` 제외 + weight≤1000 필터 | — | — | — |

- 설정: `SMARTSTORE_SOURCES` (naverShoppingSearch.cjs:149~). 11곳: roasterick, lubia, hitte, identity, toch, fillout, cafedoan, coffeejg, malik, aerycoffee, hocuspocus. 각 항목은 `categoryUrls[]` + `storeUrl` + `retryEmptyOptionCaches` 플래그.
- 페이지 로드 타임아웃: `SMARTSTORE_PAGE_LOAD_TIMEOUT_MS = 25000` (main.cjs:88) — CLAUDE.md "스마트스토어 페이지 로드 25초"와 일치. 재시도: `loadSmartStorePageWithRetry` (main.cjs:450).

#### ★ 검증 1: `origin: source.roasterName` / `roastLevel: '확인 필요'` 고정값 — 사실 확정

감사 지시 섹션 2의 주장("약 1767행", "약 1769행")을 코드로 확인. 실제 행 번호는 **정확히 1767행 / 1769행**.

```
naverShoppingSearch.cjs:1754 function normalizeSmartStoreCategoryItem(item, source, index) {
naverShoppingSearch.cjs:1765     roasterName: source.roasterName,
naverShoppingSearch.cjs:1766     productName: title,
naverShoppingSearch.cjs:1767     origin: source.roasterName,        ← 로스터리명 고정 대입
naverShoppingSearch.cjs:1768     process: '',
naverShoppingSearch.cjs:1769     roastLevel: '확인 필요',           ← 고정 대입
```

판정: **PARSER_MISS가 아니라 NOT_IMPLEMENTED(시도조차 안 함)에 해당**. 근거:
- `applySmartStoreDetailInfo` (naverShoppingSearch.cjs:585~614) — 상세 정보를 상품 객체에 반영하는 유일한 후속 함수. 반환 객체에 `priceOptions, priceOptionsComplete, priceOptionsStatus, weightLabel`만 포함하고 **`origin`/`process`/`roastLevel` 필드가 존재하지 않음**. 즉 수집 단계의 고정값이 상세 단계를 그대로 통과해 `docs/products.json`까지 유지됨 (코드 추적 확정).
- 따라서 스마트스토어 상품의 origin·process·roastLevel은 "텍스트에 있는데 파서가 놓친 것"이 아니라 **수집 단계가 해당 필드를 아예 시도하지 않은 것**이다. Golden diff의 `failureReason`은 이 세 필드에 대해 `NOT_IMPLEMENTED` 계열로 분류하고, 통계는 "파서가 놓친 것"과 분리해야 한다.

### 1-B. 공식몰 경로 (cafe24 / imweb / 테라로사 / momos)

목록 수집은 메인, HTML→상품 객체 변환은 **렌더러**가 담당한다(스마트스토어와 구조적 차이).

| 파일(행) | 함수 | 입력 | 출력 | fallback | 캐시 | 실패 시 동작 |
|---|---|---|---|---|---|---|
| main.cjs:1861 | `fetchOfficialMallProducts` | sourceId | `{pages:[{url,html}], listCompleteness, endReason}` — **HTML 그대로 반환, 상품 객체 아님** | 페이지 실패 시 다른 페이지 계속 (1922) | rawStore | pages 0개면 throw |
| electron/collection/officialMallSources.cjs:4 | `OFFICIAL_MALL_PAGE_CONFIGS` | — | 8곳: fritz, namusairo, coffeelibre, werk, deepbluelake, hellcafe, centercoffee(imweb), coffee502. 각 `sourceUrl/categoryNo/verifyStockFromDetail/detailOrigin` | — | — | — |
| main.cjs:1102 | `fetchHtmlPage` | url, referer | `{url, html}` | — | — | null 반환 |
| registry.cjs + STANDALONE | momos/terarosa 별도 채널 | — | momos `driver:'momosShop'`, terarosa `driver:'terarosaApi'` | — | — | — |

- 공식몰 상세 ~12초, 하드캡 15초: main.cjs:1106 `setTimeout(() => controller.abort(), 12000)` + `fetchHtmlPage`의 `withTimeout(..., 15000, null)` — CLAUDE.md 기재와 일치.
- 공식몰 보강 예산 90초: main.cjs:96 `OFFICIAL_ENRICH_BUDGET_MS = 90000`. 예산 초과 시 "위에서 모은 상품 목록은 그대로 반환" (main.cjs:1935 주석).

---

## 2. 상세 수집

### 2-A. 스마트스토어 상세 (메인 프로세스, 숨김 BrowserWindow)

| 파일(행) | 함수 | 입력 | 출력 | fallback | 캐시 | 실패 시 동작 |
|---|---|---|---|---|---|---|
| main.cjs:652 | `fetchSmartStoreDetailContents` | storeHomeUrl, products, `{maxCount=20, timeBudgetMs=45000}` | productNo→detailInfo Map | 캐시 hit이면 창 안 띄움 | 스마트스토어 상세 캐시 | 타임아웃 넘으면 중단, 캐시만 반환 |
| naverShoppingSearch.cjs:585 | `applySmartStoreDetailInfo` | product, detailInfo | **가격 옵션·가격·용량만 반영** (origin/process/roastLevel 없음) | options 없으면 `priceOptionsComplete:false` | — | — |
| main.cjs:987 | `enrichSmartStoreProductsWithExternalNotes` | products | unspecialty 노트 보강 | — | unspecialty 캐시 | warn 후 원본 반환 |
| rawStore.cjs:44 | `putRawObservation` | channelId/url/body | `{observationId(sha256 16자리), reused}` gzip 저장 | 중복 내용은 body 미기록, lastSeenAt만 갱신 | rawStore | — |

- 상세 캐시 위치: `getSmartStoreDetailCacheDir` (naverShoppingSearch.cjs:23) → `%LOCALAPPDATA%/BeanPick/smartstore-detail-cache`. TTL: 옵션 있음 7일(`SMARTSTORE_DETAIL_OPTION_CACHE_TTL_MS`, 35행), 실패/빈결과 **24시간**(`SMARTSTORE_DETAIL_FAILURE_TTL_MS`, 34행), 캐시 버전 5. 가격 변동 시 무효 (`isSmartStoreDetailCacheUsable`, 655행).
- enrich 순서 (main.cjs:1050~1061): ① `enrichProductsWithThumbnailOcr` → ② `needsSmartStoreDetail`인 것만 `enrichSmartStoreProductsWithDetailInfo` → ③ `enrichSmartStoreProductsWithExternalNotes`.
- 참고: audit-input 추출 결과 "스마트스토어 상세 캐시 233건 중 다수는 가격 옵션만 있고 본문이 없다" — 이는 **수집 설계상 상세 단계가 가격/옵션/용량만 반영하고 본문 텍스트를 따로 보관하지 않기 때문**이며 파이프라인 결함으로 세지 않는다 (EVIDENCE_UNAVAILABLE).

### 2-B. 공식몰 상세 보강 (메인, 상세 원문 + 마커 주입)

| 파일(행) | 함수 | 입력 | 출력 | fallback | 캐시 | 실패 시 동작 |
|---|---|---|---|---|---|---|
| main.cjs:1834 | `enrichPagesWithDetailStock` | pages, config, deadlineAt | 마커 주입된 html pages | imweb/centercoffee→`enrichImwebDetailOptions`, 그 외 cafe24 분기 | — | 예산 초과 시 "원본 그대로(상세보강 없이) 반환" (1843) |
| main.cjs:1595 | `buildDetailDataFromDetails` | 상품 상세 URL 목록, concurrency=5, gap=100ms | `{stock, info}` Map | 상세 못 받으면 목록 표시 유지 | — | OCR/개별 실패 무시 |
| cafe24DetailParser.cjs:472 | `parseCafe24DetailInfo` | 상세 HTML | `{origin, variety, process, tastingNotes, region, farm, weight, priceOptions, description, tasteScale}` | 라벨 줄→div테이블→무라벨 노트 순 | — | — |
| cafe24DetailParser.cjs:511 | `buildDetailInfoMarker` | info | `<span data-beanpick-detail="JSON">` 주입 | — | — | — |
| main.cjs:1776 | `enrichImwebDetailOptions` | pages (momos/centercoffee) | OMS 옵션 + `parseCafe24DetailInfo` 마커 | OMS 비면 `load_option.cm` | — | 상세 못 받으면 대표 가격·용량 유지 |
| main.cjs:1204 | `attachCenterCoffeeOcrText` | centercoffee page | 블록별 `data-beanpick-ocr` + `data-beanpick-note-evidence` 마커 | 이미지 최대 3장 | OCR 캐시 | OCR 없으면 블록 스킵 |
| main.cjs:1421 | `attachTerarosaOcrText` | detailPages | `{ocrText, tastingNoteEvidence}` (썸네일 우선→상세 이미지 최대 8장) | gemini 먼저, 없으면 paddle | OCR 캐시 | — |
| main.cjs:1318 | `fetchDetailPages` | detail urls | `{url, html}[]` | — | — | 실패 무시 (1340) |
| main.cjs:1249 | `fetchTerarosaApiRows` | cookie, csrfToken | apiRows | API 실패 → `parseTerarosaHtmlProducts` 경로 + warning (main.cjs:1496) | — | — |

---

## 3. OCR / Gemini

### 3-1. 캐시 구조

| 파일(행) | 함수 | 입력 | 출력 | fallback | 캐시 | 실패 시 동작 |
|---|---|---|---|---|---|---|
| naverShoppingSearch.cjs:13 | `getOcrCacheDir` | — | `%LOCALAPPDATA%/BeanPick/ocr-cache` (레포 `.ocr-cache/`에 1244건 실측 — 감사 자료용 복사본) | — | — | — |
| naverShoppingSearch.cjs:825 | `ocrTextCachePathForImageUrl` | imageUrl + `{engine, lang, psm}` | sha1(`url\|engine\|lang\|psm`)+`.txt` | — | — | — |
| naverShoppingSearch.cjs:847 | `downloadImageToCache` | imageUrl | 로컬 이미지 경로 | — | sha1(url).확장자; hit 시 재사용 | `''` |
| naverShoppingSearch.cjs:889 | `readOcrTextFromImageUrl` | imageUrl | **Paddle 원문 텍스트** | 3연속 실패 시 실행 내내 스킵 | 실패도 빈 .txt로 캐시 (재시도 방지) | `''` |
| naverShoppingSearch.cjs:972 | `readGeminiTasteNotesFromImageUrl` | imageUrl | **모델 응답 원문 (JSON 배열 텍스트)** | — | hit 시 파일 원문 반환 | `''` |

#### ★ 검증: OCR 캐시의 gemini 항목은 이미지 원문이 아니라 모델이 이미 뽑은 노트 목록 — 코드로 확정

- naverShoppingSearch.cjs:946 `const GEMINI_MODEL = 'gemini-3.1-flash-lite';`
- 프롬프트는 "명시적인 커핑노트·테이스팅 노트 영역에 실제 적힌 표현만… 문자열 JSON 배열만 반환", 버전 `'source-notes-v4'`. 단 실제 호출은 `GEMINI_EVIDENCE_PROMPT`(1004행 사용)로 `{"text","group","process","scope"}` 객체 배열을 요구.
- naverShoppingSearch.cjs:1019 `text = (json?.candidates?.[0]?.content?.parts ...).map(part => part.text).join('')` → 1025~1026행 `fs.writeFileSync(textPath, text, 'utf8');` — **모델의 JSON 응답 문자열을 그대로 저장**. 실측 캐시 파일 확인: `["꽃", "백차", "핵과류"]`, `[]` — 이미지 텍스트가 아니라 노트 목록.
- naverShoppingSearch.cjs:1351 `parseGeminiEvidence`: 캐시 읽기 시 JSON 파싱 → `createTastingNoteEvidence`로 근거 항목 변환 (blend-component/process-conflict는 `reviewReason`으로 보관만 하고 노트에서 제외).
- **감사 적용**: `evidence.ocr[]`의 gemini 항목은 "BeanPick 현재 추출값"이지 독립 증거가 아니다. 이것만으로 Golden 노트를 HIGH 확정 금지 (감사 지시와 일치).

### 3-2. 타임아웃·우선순위

- Gemini abort 20000ms (naverShoppingSearch.cjs:991) — CLAUDE.md "Gemini 비전 OCR ~20초"와 일치. paddle `execFile` timeout 20000 (916행), 썸네일 OCR용 25000 (`getOcrTasteNotes`, 1396행).
- 이미지 텍스트 우선순위 (naverShoppingSearch.cjs:1404 `readOfficialMallImageText`): GEMINI_API_KEY 있으면 gemini → 노트 있으면 `Tasting Note: ...` 반환, 없으면 paddle OCR로 폴백.
- OCR 결과→tastingNotes: `getOcrTasteNotes`(1384): gemini 우선 → paddle 원문 → `extractOcrTasteNotes`(앵커 기반) → `extractFlavorNotesAnywhere`. `mergeTastingNotes`(1433): sanitize + dedupe, 최대 5개.

---

## 4. 추출·정규화 (필드 확정 위치·순서)

### 4-A. 스마트스토어 (고정값이 덮어씌워지지 않음)

`normalizeSmartStoreCategoryItem` (naverShoppingSearch.cjs:1754)에서 한 번에 확정:

| 필드 | 값 | 이후 변경 |
|---|---|---|
| `origin` | `source.roasterName` (1767) | **어떤 코드도 덮어쓰지 않음** — `applySmartStoreDetailInfo`는 가격/옵션/용량만 |
| `process` | `''` (1768) | 그대로 |
| `roastLevel` | `'확인 필요'` (1769) | 그대로 |
| `tastingNotes` | `sanitizeTastingNotes(getTasteNotes(rawTitle))` (1777) — 상품명 사전 매칭만 | 이후 노트만 merge (썸네일 OCR → 상세 extract → unspecialty) |
| `weight` | `parseWeight(rawTitle)` (1778) — **명시 없으면 200** (395~403행) | 상세 옵션으로 보강. 단 커머스 API 경로(`normalizeNaverCommerceProduct`, 1701~1710)는 `parseExplicitWeight`라 명시 없으면 **0** |

### 4-B. 공식몰 (상세 마커가 있으면 상세값이 이김)

- cafe24OfficialAdapter.ts `parseCafe24Products`(321행), `parseImwebProducts`(499행), momosOfficialAdapter.ts(217/285행):
  - `origin: detail?.origin || inferOrigin(combinedText)` — 상세 원산지 라벨 없으면 국가명 휴리스틱, 그래도 없으면 `'확인 필요'`
  - `process: detail?.process || inferProcessFromName(productName, combinedText)` — 상품명 우선, `'확인 필요'` fallback
  - `roastLevel`: 약배전→Light / 강배전→Dark / 중배전→Medium / 그 외 `'확인 필요'`
  - `tastingNotes` 병합 순서 (cafe24 348~361): 구조화 노트(detail.tastingNotes) → description → OCR → 휴리스틱, dedupe, 최대 5
- terarosa: `normalizeTerarosaApiRows`(454: API row 텍스트에서 infer, roastLevel '확인 필요') → `enrichTerarosaProducts`(407: 상세 페이지 파싱값으로 origin/process/roastLevel/notes **덮어씀**).
- 보조 함수: `getTasteNotes`(naverShoppingSearch.cjs:819) — TASTING_NOTE_PATTERNS 사전 매칭; `parseWeight`(395, 기본 200); `parseExplicitWeight`(405, 기본 0); `sanitizeTastingNotes`(1179) → `normalizeTastingNotes`(src/services/tastingNotes.js:382, NON_TASTING_NOTES 제외); `inferWeight`(cafe24 어댑터, defaultWeight=200 — officialMallConfigs.ts 전 로스터 200).

### 4-C. 렌더러 최종 단계 (공통)

`promote-collection-products` → `promoteProducts` (electron/collection/engine.cjs:36): `fromLegacyProduct`(contract.cjs:308: channelId `${sourceId}:smartStore|officialMall`, 옵션 완전성 판정) → `toLegacyProduct`(contract.cjs:166: 대표 가격=레코드값 우선, priceOptionsComplete 등 재계산). → `groupProductsByNameAndWeight`(coreFeatures.js:790: 키=`roasterName::정규화상품명`; 대표=최저 단가가; 가격 옵션 생성) → `normalizeProducts`(coreFeatures.js:868: normalizeTastingNotes + acidityScore) → localStorage `beanpick.productCache.v1`(productHistory.js:2) + `beanpick.productSnapshot.v1`(monitoring.ts:31).

- 렌더러 타임아웃: 소스당 300000ms (App.jsx:941, `withRoasterTimeout`), 동시 3개 (`LIVE_SOURCE_LOAD_CONCURRENCY = 3`, App.jsx:123).
- 소스 실패 시: 이전 캐시 상품 중 해당 로스터리를 `roasterPreservedReason: '수집 실패로 이전 데이터 유지'`로 유지 (App.jsx:967~975). 이후 `markStaleProduct`(contract.cjs:246)로 "갱신 실패 · N분 전 정보" 표시 (githubPublisher.cjs:677 `markPreservedProductFreshness`).

---

## 5. 중복 제거·상태 판정

| 파일(행) | 함수 | 로직 |
|---|---|---|
| coreFeatures.js:790 | `groupProductsByNameAndWeight` | 키=`roasterName::정규화상품명`, 대표는 최저 단가가, 가격 옵션 생성 |
| dataQuality.cjs:41 | `validateProduct` | 제외: 용량 30~2000g 밖, 가격 1000~500000원 밖, 제목 용량≠저장 용량, "대용량"인데 <400g. 플래그: 100g당 500~150000원 밖 |
| dataQuality.cjs:107 | `sanitizeProductPriceOptions` | 옵션 무효 제거 → `priceOptionsComplete: false, priceOptionsQualityIssue: true` |
| stockStatus.cjs:50 | `isSoldOutFromHtml` | 숨김 마크업 제거 후 품절 alt/텍스트 검사 (공식몰) |
| — | `isSoldOutRow` (terarosaOfficialAdapter.ts:441) | soldout/status/saleStat='2'/재고0 |
| main.cjs:~363 | extractSmartStoreCategoryItemsScript | 스마트스토어 목록 텍스트 `/(^\|\n)품절(\n\|$)/` 검사 |
| naverShoppingSearch.cjs:1704 | (커머스 API) | `/OUTOFSTOCK\|STOPPED\|SUSPEND\|REJECT/` 또는 (stock===0 && status!=='SALE') |
| — | cafe24 상세 | `buildDetailDataFromDetails`의 stock Map, `stripCafe24FalseSoldOutMarkup`으로 오탐 제거 |

---

## 6. 품질 필터·게시 가드 (변경 금지 — 감사 경계선)

### 6-1. githubPublisher.cjs 가드 (코드 읽기만, 약화·삭제 절대 금지)

| 파일(행) | 함수 | 로직 |
|---|---|---|
| githubPublisher.cjs:606 | `getCollectionRunBlockReason` | 수집 상태가 partial/blocked/failed/empty이고 폴백이 아니면 **게시 중단** |
| githubPublisher.cjs:620 | `getPublishBlockReason` | ① 전체 상품 수 절반 이하 급감 (기준 prev≥20, next < ceil(prev×0.5)) ② 로스터리 수 절반 이하 ③ `findCollapsedRoaster`(472): 로스터리별 절반 이하 급감 (모모스 카탈로그 이관 승인 예외 457) ④ `findCollapsedOptionRoaster`(499): 다용량 상품의 옵션 소실 ⑤ 스마트스토어 할인 가드: prev할인≥20 & next≥20 & next < ceil(prev×0.5)일 때 `countUnexplainedDiscountLoss`(165)로 정상가 복귀가 아닌 소실만 카운트, `unexplained ≥ ceil(prev할인×0.5)`면 중단 |
| githubPublisher.cjs:535 | `preservePreviousCollapsedRoasters` | 급감한 로스터리는 이전 스냅샷 상품으로 메움 (가드가 막지 않은 경우) |
| githubPublisher.cjs:301 | `preservePreviousTastingNotes` | **최종 tastingNotes는 근거(`tastingNoteEvidence`, reviewReason 없는 항목)로부터 재구성** (305~309행). 근거가 비었는데 이전 스냅샷에 노트가 있으면 이전 노트 복원 + `tastingNotesPreservedAt` |
| githubPublisher.cjs:369 | `preservePreviousOfficialDetails` | 공식몰 상세를 이전 스냅샷에서 최대 7일(`OFFICIAL_DETAIL_PRESERVE_TTL_MS`, 17행) 보존 |
| githubPublisher.cjs:677 | `markPreservedProductFreshness` | 유지된 상품에 "갱신 실패 · N분 전 정보" 표시 |

### 6-2. docs/products.json 기록

`publishProductsToGitHub` (githubPublisher.cjs:795):
1. 토큰 없으면 중단. 2. `readExistingFile`(762행, 타임아웃 15000ms)로 기존 스냅샷+sha 읽기. 3. `buildGithubSnapshot`(688행): 스키마 `{ publishedAt, count, products: clean[], quality: { total/cleanCount/excludedCount/flaggedCount/invalidOptionCount, excluded, flagged, optionExcluded, preservedRoasters, preservedRoasterProductCount, preservedDiscountCount, preservedOfficialDetailCount, preservedTastingNoteCount, staleProductCount, collectionRuns } }`. 4. `getPublishBlockReason` → 차단 시 `ok:false`. 5. 통과 시 `PUT https://api.github.com/repos/Spacer2132/beanpick/contents/docs/products.json`(DEFAULT_PATH, 8행), 커밋 메시지 `Update BeanPick iPhone snapshot (${count} products)`(814행), 타임아웃 15000ms/시도, 최대 3회 재시도 (409/422 sha 충돌→sha 갱신, 429/5xx).

호출 체인: 렌더러 "아이폰 게시" → `handlePublishIphoneSnapshot`(App.jsx:824) → `window.beanpick.publishToGithub({ products, collectionRuns })`(835행; `products`는 `normalizeProducts(baseProducts)` 메모값, 714행) → `ipcMain.handle('beanpick:publish-iphone')`(main.cjs:2026) → `publishProductsToGitHub`.

### 6-3. CLAUDE.md / AGENTS.md 감사 경계선 요약

- **게시 가드 약화·삭제 금지**: 가드가 게시를 막으면 데이터 이상 신호 — 가드를 고치지 말고 수집 원인을 고쳐라. (AGENTS.md 규칙 1, CLAUDE.md 절대금지 1)
- **실측 없이 타임아웃 단축 금지**: 정상 소요시간 — Gemini 비전 OCR ~20초, 공식몰 상세 ~12초(하드캡 15초), 스마트스토어 페이지 로드 25초, 공식몰 보강 예산 90초. (모두 코드에서 일치 확인 — 3-2, 1-B 참조)
- **테스트를 고쳐서 통과시키기 금지**: `safety-guards:test` 실패 시 코드 되돌리기. 하한값·가드 조건 하향은 사용자 승인 없이 금지.
- **커밋·푸시·머지·배포는 사용자 승인 필수**. `.env` 토큰·키 출력·로그·커밋 금지.
- **Iron Law**: 로컬 테스트 통과 ≠ 해결. 발행 관련 수정은 실제 발행 성공 + `Update BeanPick iPhone snapshot (NNN products)` 커밋 확인해야 검증 완료. 매칭·필터·정규화 변경 시 전후를 같은 실데이터에 돌려 "사라진 것" 목록을 뽑고 하나씩 판정.

---

## 7. 앱 표시 (소비 경로) — ★ origin=로스터리명 실측 포함

### 7-1. 소비 함수 로직 (파일+행번호)

**`src/services/coreFeatures.js`**
- `findCountryDisplay(product)` (585~595): 산지 표시값 결정의 유일한 진입점. ① `product.productName`에서 `COUNTRY_DISPLAY_RULES`(428~446, 18개국 규칙)의 alias가 **가장 앞에 등장한 규칙**을 선택하고, ② 없으면 `product.origin`에서 alias 매칭. **가드(591~592)**: `compact(origin) === compact(roasterName)`이면 origin alias 매칭을 건너뛰고 `undefined` 반환 — 이 때문에 **로스터리명은 구조적으로 산지 라벨에 표시될 수 없음**.
- `getProductCountryLabel` (627~629): `findCountryDisplay(product)?.label || ''` — 항상 규칙 label 또는 ''.
- `getProductOriginLabel` (631~635): country label이 있으면 그 값, 없으면 블렌드면 `'블렌드'`, 아니면 `''`. **raw origin 문자열을 그대로 노출하지 않음**.
- `getProductProcessLabel` (637~639): `findProcessDisplay`(596~599) → `product.process + ' ' + product.productName`에서 `PROCESS_DISPLAY_RULES`(449~456) 매칭. 스마트스토어 수집(`process: ''`)인 경우 상품명에서만 추출.
- `isDecafProduct` (641~644): `[productName, origin, process].join(' ')`에 `/디카페인|decaf/i` 매칭 — **origin 필드는 실제로 정규식 입력에 포함됨** (코드 증거).
- `isBlendProduct` (336~343): productName+variety+origin+process 합친 텍스트에 `blend|블[렌랜]드|블[렌랜]딩` 매칭 — origin=roasterName이 블렌드 판정에 기여할 수 있는 구조.
- `featuredVarietyLabel` (324~332): productName+variety+origin 합친 텍스트에서 품종 alias 매칭 (추천상품 선별용).
- `uniqueProductMeta` (415~419): roasterName·origin 중복 제거 — **현재 src 전체에서 사용처 없음(dead export)**.
- 검색 텍스트: App.jsx:52~73 `productSearchText` 및 coreFeatures.js:995~1010 `filterProductsBySearchAndNotes` — 둘 다 **raw `product.origin`을 그대로 포함**.

**`src/services/tastingNotes.js`**
- `getDisplayTastingNotes(product)` (450~470): `tastingNoteEvidence`에서 `reviewReason` 없고 `tastingNotes`에 포함된 tag를 먼저, 그다음 `normalizeTastingNotes(product.tastingNotes)` 나머지를 합침. **origin 필드를 읽지 않음** (컵노트 표시와 무관).

### 7-2. origin 소비처 표

| 소비처 | 위치 | 로직 | origin===roasterName일 때 사용자 가시 결과 |
|---|---|---|---|
| 산지 라벨(필터 드롭다운·필터) | App.jsx:733/750 ← `getProductCountryLabel` | 규칙 label만 반환 | 로스터리명 노출 **0건**(가드 591~592 작동). 드롭다운 옵션 18개국만 |
| 상품 상세 모달 '원산지' 행 | App.jsx:215 ← `getProductOriginLabel` | label/블렌드/'' | 로스터리명 노출 **0건**. 라벨 없으면 행 자체 숨김 |
| 디카페인 판정 | coreFeatures.js:641 | productName+origin+process 정규식 | origin 필드 **사용됨**. 현 스냅샷에선 오탐 0건(아래) |
| 블렌드 판정 | coreFeatures.js:336 | 위 4필드 합침 | 로스터리명에 블렌드 alias 포함 시 오판 가능 → 현 스냅샷 **0건** |
| 추천품종 판정 | coreFeatures.js:324 | name+variety+origin 합침 | 품종 alias 포함 로스터리명만 위험 → 미확인(현 데이터 영향 측정 불가, 구조적 가능성만 있음) |
| 통합검색 | App.jsx:57, coreFeatures.js:1000 | raw origin 그대로 색인 | 로스터리명 검색 시 origin 경유 중복 매칭 — 무해 |
| 세계지도 핀 | mapCoordinates.js:360~361 `extractProductCountries` | productName+origin에서 국가 alias 매칭 | 로스터리명에 국가 alias 포함 시 잘못된 핀 → 현 스냅샷 **0건** |
| 로스터리별 섹션/정렬/그룹핑 | App.jsx `roasterySources`(정적), `sortProducts`(coreFeatures.js:353) | origin 미사용 | 영향 없음 |

### 7-3. 실측 — 454건 기준 (함수 직접 import 실행, 추정 없음)

| 지표 | raw 기준 | displayed 기준 |
|---|---|---|
| origin이 로스터리명과 동일 | **328건 (72.2%)** | — |
| origin이 빈값 | 0건 | — |
| 산지 라벨이 로스터리명과 동일 | — | **0건** (country/origin 양쪽 함수 기준) |
| 산지 라벨 있음(국가명) | — | **340건 (74.9%)** |
| 산지 라벨 '블렌드' | — | 59건 |
| 산지 라벨 없음(모달 원산지 행 숨김) | — | 55건 |
| 가공 미판별(displayed process '') | — | 103건 (판매중 300 중 84건) |
| 컵노트 없음(displayed notes 빈배열) | — | 188건 (판매중 98건) |
| roastLevel '확인 필요' | 427건 (94.1%) | 동일 (App.jsx:220이 raw 그대로 표시) — 판매중 273건 |
| 디카페인 판정 true | — | 28건, 그중 **origin이 판정을 좌우한 건 0건** (origin 제거해도 모두 true) |

교차 분석(감사 지시 핵심 가설 검증):
- origin===roasterName 328건 중 265건은 **상품명 재추출로 정확한 displayed 산지 라벨 복구** (예: origin "아이덴티티 커피랩" → 상품명에 '에티오피아' → '에티오피아' 표시). 복구 실패 63건.
- origin이 정상(로스터리명 아님) 126건 중 displayed 산지 75건, 미표시 51건.
- → **raw 기준으로만 측정하면 328건(72%)을 "산지 미상"으로 잡아 스마트스토어 산지 정확도가 0%에 가깝게 왜곡**되지만, 실제 displayed 산지 정확도는 340/454(75%). 감사 지시의 가설 **실측으로 확정**.
- 드롭다운 산지 옵션 18개국: 에티오피아 104 > 콜롬비아 62 > 파나마 56 > 케냐 34 > 과테말라 22 … 파푸아뉴기니/인도/볼리비아/엘살바도르/니카라과 각 1.
- 규칙 사전 누락 사례 발견: `NOMAD COFFEE … Filter Burundi Gahahe Washed`(origin=카페도안) — 상품명에 Burundi가 있으나 `COUNTRY_DISPLAY_RULES`에 부룬디 항목이 없어 산지 미복구. 수집 오류가 아니라 **표시 사전 커버리지 문제** (미확인 영역, 추정 금지).

### 7-4. 등급 제안: origin=로스터리명 현상 → **P2**

- P0/P1 기각 근거: "산지 라벨에 로스터리명이 표시되는 오동작"은 **발생하지 않음** — `findCountryDisplay` 591~592행 가드가 실측 454건 전수에서 0건 노출을 보장했고, 지도 핀 오배치도 0건, 디카페인 오판도 0건.
- P2로 두는 이유: ① raw 수집값(origin=로스터리명, process='', roastLevel='확인 필요')이 products.json에 그대로 남아 **raw 기준 데이터 품질 지표를 72%p 왜곡** (328/454). 수집-표시 간 '운 좋게 복구되는' 구조라 규칙 사전 누락(부룬디 사례)이나 로스터리명 변경 시 displayed 품질이 조용히 깨짐. ② 디카페인 판정이 origin 필드를 정규식 입력에 포함 — 현 스냅샷 28건 모두 안전이나, 로스터리명에 'decaf/디카페인'이 들어가면 오판하는 구조적 가능성 잔존.
- P3 아님: 감사 지시 핵심 가설(raw vs displayed 측정 분리)이 실측으로 확정됐고, 누락된 CI 4종(특히 contract·smartstore)이 바로 이 수집값을 검증하는 테스트라는 점에서 재발 방지 관점에서 P2가 적절.
- 미확인: `featuredVarietyLabel`의 origin 기여분이 실제 추천상품 선별을 바꾼 사례는 이번 측정에서 분리하지 못함.

---

## 8. 코드 중복: tastingNotes.js vs tastingNotes.cjs — ★ 리스크만 기록

- `diff` 결과 **전체 522행 중 차이 1행**: 510행 `export { … }`(ESM) ↔ `module.exports = { … }`(CJS). 함수 본문·사전·정렬 로직 **100% 동일** (diff 출력 `510c510` 단일 차이).
- `.cjs` 소비자: electron/main.cjs, electron/githubPublisher.cjs, electron/naverShoppingSearch.cjs, src/services/adapters/cafe24DetailParser.cjs, electron/noteSources/unspecialty.cjs, scripts/test-core-features.cjs, test-official-mall.cjs, test-smartstore-search.cjs, test-tasting-notes.cjs, test-iphone-webapp.cjs, test-tasting-note-evidence.cjs
- `.js` 소비자: src/App.jsx, coreFeatures.js, adapters 3종(ts), scripts/test-iphone-webapp.cjs, test-tasting-note-evidence.cjs (후자 2개는 양쪽 모두 로드)
- **리스크**: 두 파일이 수동 동기화 구조. 한쪽만 수정되면 수집(CJS)·표시(JS) 간 컵노트 정규화 결과가 달라질 수 있는 드리프트 리스크. (리팩터링 제안 없음)

---

## 9. CI 워크플로 테스트 목록 — ★ 10종 중 6종 실행 주장 검증

`.github/workflows/publish-iphone-snapshot.yml` "Run safety tests" 스텝(60~67행)이 실행하는 6종:

```
tasting-notes:test, core-features:test, dataquality:test, iphone-webapp:test, history:test, safety-guards:test
```

package.json에 정의된 테스트 10종 중 **빠진 4종** (주장 확정):
| 빠진 테스트 | 스크립트 파일 | 담당 영역 |
|---|---|---|
| `map:test` | scripts/test-map-feature.cjs | 지도 기능 |
| `officialmall:test` | scripts/test-official-mall.cjs | 공식몰 수집 |
| `smartstore:test` | scripts/test-smartstore-search.cjs | 스마트스토어 수집 |
| `contract:test` | scripts/test-collection-contract.cjs | 수집 계약 |

- 증거: 워크플로 62~67행은 6개 `npm run`만 나열, 68행 이후 `npm run build` → `prepare-pages.cjs` → git push docs → `iphone:snapshot:publish`로 직행.
- 참고: package.json의 `verify` 스크립트(40행)는 10종 전부 + build + package:portable을 포함하지만 **워크플로에서는 사용되지 않음** (미실행).
- 보고만 하고 수정하지 않는다 (감사 지시 준수).

---

## 10. 과거 감사 자료: graphify-taste-notes-recovery-2026-07-13/ 요약

3개 파일, 총 4275바이트. 2026-07-13 컵노트 복구 감사 기록.

- `01-recovery-stages.md` — 복구 단계 요약. 기준: 명시적인 컵노트/테이스팅 노트/상품별 상세 이미지만 사용, 상품명·설명 문장에서 맛 추정 금지. 원인 3종: SmartStore 상세 수집의 앞 20개 고정 대기열(누락 상품을 계속 뒤로 밈), 한 줄 상세 텍스트가 문장 중간의 컵노트 라벨을 놓침, 빈 새 수집 결과가 이전 게시 맛정보를 덮음. 대응: 대기열은 캐시 확인 뒤 미캐시·맛정보 누락 상품 우선, 빈 상세 결과는 24시간 캐시, 파서는 강한 명시 라벨만 문장 중간에서 허용, 게시 직전에는 정확히 같은 상품 ID의 기존 맛정보만 보존. 첫 라이브 수정 스냅샷에서 누락 108→89, 새 소실 0. 8단계: `se-image-resource` 상세 이미지 URL을 기존 OCR 경로에 전달 (94개 캐시 중 47개가 상세 이미지 보유, 38개 OCR 맛정보 복구).
- `02-audit-matrix.md` — P2/P3 감사 분류. P2 SmartStore 21개 (기존 복구 7, 새 명시 이미지 노트 3, 네이버 IP 차단 10, 상품 제외 검토 1). P3 공식몰·직영몰 15개 (정규화 사전 공백 1 — coffee502-182 `로즈, 엘더플라워, 피치, 망고스틴`이 빈 배열로 정규화; 본문 파서 공백 1 — coffeelibre-3176 `Cupping Note | 조청, 메이플시럽, 밀크 초콜릿, 크리미 바디` 미인식; 상세 이미지 획득 공백 2 — terarosa-100448, terarosa-100019는 OCR에 직접 넣으면 복구, 즉 이미지 URL 전달 문제).
- `03-next-implementation.md` — 11단계 구현 범위와 금지선. 자동 경로 3개만 수정: ① 502커피로스터스 정규화 사전에 로즈/엘더플라워/피치/망고스틴 추가 ② 커피리브레 본문 파서가 `Cupping Note |` 명시 라벨 읽기 ③ 테라로사 공식몰 상세 이미지 URL이 OCR 입력까지 도달. 게시 가드와 시간 제한은 약화/제거 금지.

**이번 감사에 재사용 가능한 지점**:
- "원문에 없는 값은 만들지 않는다" 원칙 (상품명·설명에서 맛 추정 금지) — Golden confidence 기준과 동일.
- 노트 보강 우선순위 구조 (썸네일 OCR → 상세 → unspecialty) 와 `preservePreviousTastingNotes` 복원 로직은 현재 코드에 그대로 존재 — tastingNotes 결측 분석 시 이 로직을 CASE 분류에 반영.
- P2/P3 분류 체계 (네이버 IP 차단=접근 문제, 이미지 URL 전달 공백=파이프라인 결함, 명시 원문 없음=정상 빈값) — failure taxonomy 매핑에 재사용 가능.

---

## 11. 스마트스토어 vs 공식몰 경로 요약표

| 구분 | 스마트스토어 | 공식몰 (cafe24/imweb + terarosa/momos) |
|---|---|---|
| 발견 | 카테고리 크롤(BrowserWindow) / coffeejg만 커머스 API | 목록 HTML fetch (메인) |
| 상품 객체화 | 메인에서 즉시 (`normalizeSmartStoreCategoryItem`) | **렌더러**에서 HTML→객체 (어댑터) |
| origin | **`source.roasterName` 고정, 끝까지 유지** (NOT_IMPLEMENTED) | 상세 원산지 라벨 → 휴리스틱 → '확인 필요' |
| process | `''` 고정 (NOT_IMPLEMENTED) | 상세 가공법 → 휴리스틱 → '확인 필요' |
| roastLevel | `'확인 필요'` 고정 (NOT_IMPLEMENTED) | 약배전/Light 등 판별, 없으면 '확인 필요' (terarosa도 고정 '확인 필요'→상세 덮어씀) |
| 노트 | 상품명 사전 → 썸네일 OCR → 상세 → unspecialty | 상세 마커(JSON) → OCR/설명/휴리스틱 (순서: 구조화>설명>OCR>휴리스틱) |
| 용량 | 기본 200g (API 경로는 0) → 상세 옵션으로 보강 | 목록 추론(기본 200g) → 상세 옵션으로 보강 |
| 품절 | 목록 텍스트/API 상태 | 목록 HTML + 상세 재확인 |
| 원문 보관 | rawStore (상세 JSON/HTML) | rawStore (목록+상세 HTML) |

---

## 12. 미확인 사항 (추측하지 않음)

1. `crawlSmartStoreCategory` 내부 페이지네이션 상한/상세 (`endReason` 값).
2. `extractOcrTasteNotes`/`extractFlavorNotesAnywhere`의 앵커 규칙 상세.
3. `preservePreviousOfficialDetails`의 매칭키 상세 로직 (TTL 7일은 확인).
4. `featuredVarietyLabel`의 origin 기여분이 실제 추천상품 선별을 바꾼 사례 — 이번 측정에서 분리하지 못함.
5. `audit-input/wiki/` 및 `.wiki/` — 둘 다 존재하지 않음 (clone에 없음, .gitignore 대상). 사건 기록 없이 진행.

---

## 13. Phase 1 적용 지점 (참고)

- Golden diff의 `failureReason`은 스마트스토어 origin/process/roastLevel에 대해 `PARSER_MISS`가 아니라 **수집 단계 고정값이므로 `NOT_IMPLEMENTED`** 로 분류. 통계에서 "파서가 놓친 것"과 분리.
- 정확도 평가는 `displayed` 기준 (실측: displayed 산지 340/454 vs raw 기준 왜곡 72%). `raw` 수치는 별도 병기.
- Gemini OCR 캐시는 독립 증거가 아님 — Golden HIGH 확정에 사용 금지.
- 스마트스토어 상세 캐시 다수가 가격 옵션만 있는 것은 설계상 정상 (EVIDENCE_UNAVAILABLE), 파이프라인 결함으로 세지 않음.
