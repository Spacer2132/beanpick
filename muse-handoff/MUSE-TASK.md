# BeanPick — 전체 상품 데이터 품질 감사 및 Golden Dataset 구축

## ⛔ 절대 규칙 (작업 내내 이 6줄을 기준으로 판단하라)

1. **production 코드(`electron/`, `src/`, `scripts/`의 기존 파일, `.github/`)를 수정하지 않는다.** 새 파일은 `audit/` 아래에만 만든다. 예외: `package.json`에 `audit:data` 스크립트 한 줄 추가.
2. **원문에 없는 값은 만들지 않는다.** 빈 값·`UNKNOWN`은 실패가 아니다. 잘못된 확신이 최악이다.
3. **모든 판정에 원문 증거(인용 텍스트 + 출처 파일·필드)를 남긴다.** 증거 없는 `HIGH`는 금지.
4. **`.env`·키·토큰·쿠키를 열거나 출력하지 않는다.** 네트워크로 쇼핑몰에 접속하지 않는다. 주어진 파일만 쓴다.
5. **push·merge·배포·발행·GitHub Actions 실행 금지.** 결과는 브랜치 커밋 + PR 초안까지.
6. **Phase 0이 끝나면 멈추고 `audit/PHASE-0-REPORT.md`를 제출한 뒤 승인을 기다린다.** 자동으로 Phase 1로 넘어가지 않는다.

---

## 0. 역할과 목표

당신의 임무는 코드를 고치는 것이 아니라, **기준 스냅샷의 상품 461건을 사람 수준으로 전수 검토해 신뢰할 수 있는 정답셋(Golden Dataset)을 만들고, 현재 파이프라인이 무엇을 왜 놓치는지 증거로 증명하는 것**이다. 그리고 앞으로 어떤 변경이든 "무엇이 좋아지고 무엇이 망가졌는지"를 자동으로 보여주는 회귀 도구를 만든다.

토큰은 아끼지 말되, 토큰이 **검증 깊이**(독립 판정·반박·재검토)로 바뀌게 써라. 속도보다 정확도다.

## 1. 입력 자료

| 자료 | 위치 | 성격 |
|---|---|---|
| 기준 스냅샷 | `docs/products.json` (461건) | 현재 BeanPick 출력. **정답이 아니다.** |
| 원문 증거 묶음 | `audit-input/products/<id>.json`, `audit-input/manifest.json` | 사용자가 로컬 캐시에서 추출해 제공. 스마트스토어 상세 본문·상세 이미지 URL·공식몰 원문·OCR 캐시 |
| 과거 감사 자료 | `graphify-taste-notes-recovery-2026-07-13/*.md` | 7월 컵노트 복구 감사 |
| 사건 기록 | `audit-input/wiki/` (사용자가 첨부한 경우) | `.wiki/`는 `.gitignore` 대상이라 clone에 없다. 없으면 없다고 기록하고 추측하지 마라. |
| 프로젝트 규칙 | `CLAUDE.md`, `AGENTS.md` | 반드시 정독. 게시 가드·타임아웃·테스트 기준을 건드리지 말 것. |

`audit-input/manifest.json`에 기준 스냅샷의 `sha256`과 `repoHead`가 있다. **Golden은 이 스냅샷에 고정한다.** 작업 중 `docs/products.json`이 바뀌어도(자동 발행 커밋) 기준을 바꾸지 마라.

### 증거 자료에 대한 주의 (중요)
- `.ocr-cache/` 및 `evidence.ocr[]`의 gemini 항목은 **이미지 원문이 아니라 모델이 이미 뽑은 노트 목록**이다(예: `["꽃","백차","핵과류"]`). 이것은 "BeanPick 현재 추출값"이지 독립 증거가 아니다. 이것만으로 Golden 노트를 `HIGH`로 확정하지 마라.
- 상세 이미지 자체는 제공되지 않을 수 있다(URL만 있음). 이미지 안에만 정보가 있을 법한데 텍스트 증거가 없으면 `CASE 3(판정 불가)`, 원인 후보는 `OCR_MISS?`로 표시하고 확정하지 않는다.
- `manifest.coverage.noEvidenceBeyondSnapshot`이 큰 로스터리는 판정 불가 비율이 높을 수밖에 없다. 이를 파이프라인 결함으로 세지 마라.

## 2. 이미 확인된 사실 (재계산해서 확정하라, 그대로 믿지 마라)

기준 커밋 `3b17d39` 시점 실측:

- 461건, 품절(`isSoldOut`) 155건, 판매 중 306건. 스마트스토어 333건 / 공식몰 128건. 로스터리 21곳.
- 판매 중 306건 중 컵노트 없음 100건. 호커스포커스 34, 필아웃 14, 말릭 9, 에어리 8, 모모스 6, 토치 6.
- 앱 표시 기준 산지 미판별 114건(블렌드 제외 54건), 가공 미판별 100건.
- `roastLevel === '확인 필요'` 434건.
- `electron/naverShoppingSearch.cjs` 약 1767행 `origin: source.roasterName`, 약 1769행 `roastLevel: '확인 필요'` — 스마트스토어 상품은 **수집 단계에서 이 값을 고정으로 넣는다.** 파서가 "놓친" 것인지, 처음부터 "시도하지 않은" 것인지 구분하라.
- 앱은 원천 `origin`/`process`를 그대로 쓰지 않고 `src/services/coreFeatures.js`의 `getProductCountryLabel` · `getProductOriginLabel` · `getProductProcessLabel` · `isDecafProduct` 등으로 상품명에서 다시 추출해 표시한다. 컵노트 표시는 `src/services/tastingNotes.js`의 `getDisplayTastingNotes`.
- CI(`.github/workflows/publish-iphone-snapshot.yml`)는 테스트 10종 중 6종만 실행한다. 빠진 것: `map`, `officialmall`, `smartstore`, `contract`. (보고만 하고 수정하지 마라.)
- `src/services/tastingNotes.js`와 `.cjs`는 export 구문 외 동일. (리스크만 기록, 리팩터링 금지.)

## 3. 핵심 정의

### 3-1. "현재 값"은 두 층으로 기록한다
각 필드마다:
- `current.raw` — `docs/products.json`의 원천 필드 값
- `current.displayed` — 앱이 실제로 사용자에게 보여주는 값 (`coreFeatures.js`/`tastingNotes.js` 함수를 **직접 import해서 계산**. 추정 금지)

**정확도 평가는 `displayed` 기준**으로 한다. `raw` 기준 수치는 별도로 보고한다. (raw 기준으로만 재면 스마트스토어 산지 정확도가 0%에 가깝게 나와 왜곡된다.)

### 3-2. 판정 세 가지 — 절대 섞지 않는다
- **CASE 1** 원문에 정보가 있는데 BeanPick이 놓침/틀림 → 버그 후보
- **CASE 2** 원문 자체에 정보가 없음 → 정상 빈 값 (`value: null`, `SOURCE_MISSING`)
- **CASE 3** 원문 부족·접근 실패·증거 없음 → 판정 불가 (`UNKNOWN`)

### 3-3. 상품 상태
- `isSoldOut: true`는 **품절**이지 판매 종료가 아니다. 품절 상품도 상세 정보 판정 대상이다.
- `DISCONTINUED`는 원문에 판매 종료가 명시된 경우만.

### 3-4. Confidence
- `HIGH` 원문에 명시 (예: 상품명 "에티오피아 구지 내추럴")
- `MEDIUM` 복수 증거 조합으로 강하게 추론
- `LOW` 간접·애매
- `UNKNOWN` 근거 부족

회귀 비교는 기본적으로 `HIGH`·`MEDIUM`만 정답으로 사용한다.

### 3-5. Failure taxonomy
| 코드 | 의미 | 고칠 대상? |
|---|---|---|
| `SOURCE_MISSING` | 원문에 정보 없음 | ❌ |
| `NOT_IMPLEMENTED` | 수집 단계가 해당 필드를 아예 시도하지 않음(고정값 대입 등) | 판단 필요 |
| `PARSER_MISS` | 텍스트에 있는데 파서가 놓침 | ✅ |
| `OCR_MISS` | 이미지에만 있고 OCR이 놓침 (이미지 원문 확인 가능할 때만 확정) | ✅ |
| `OCR_ERROR` | OCR이 잘못 읽음 | ✅ |
| `FIELD_MAPPING_ERROR` | 값이 엉뚱한 필드로 들어감 | ✅ |
| `NORMALIZATION_ERROR` | 추출은 했으나 정규화 실패 | ✅ |
| `PRODUCT_TITLE_PARSE_ERROR` | 상품명 파싱 실패 | ✅ |
| `ROASTERY_TEMPLATE_ERROR` | 특정 로스터리 템플릿 문제 | ✅ |
| `DATA_CONTRACT_ERROR` | 수집기↔소비처 계약 불일치 | ✅ |
| `FALSE_POSITIVE` | 원문에 없는 값을 BeanPick이 만들어냄 | ✅ |
| `BLOCKED` / `DISCONTINUED` / `CACHE_STALE` | 접근·상태·캐시 문제 | ❌ (파서 대상 아님) |
| `EVIDENCE_UNAVAILABLE` | 제공된 자료에 원문이 없어 판정 불가 | ❌ |
| `UNKNOWN` | 원인 불명 | — |

`SOURCE_MISSING`·`EVIDENCE_UNAVAILABLE`과 고칠 대상은 **통계를 반드시 분리**한다. "94% 누락 = 94% 버그"가 아니다.

`origin`에 로스터리명이 들어간 현상은 **P0로 미리 단정하지 마라.** 그 값을 실제로 읽는 소비처(검색·필터·디카페인 판정·지도·그룹핑 등)를 코드로 추적해, 사용자에게 보이는 오동작이 몇 건인지 증명한 뒤 등급을 매겨라.

## 4. Phase 0 — 이해와 기준선 (코드 수정 없음)

1. 저장소 구조, `CLAUDE.md`, `AGENTS.md`, 기존 테스트 10종, 발행 workflow, 과거 감사 자료를 읽는다.
2. `audit-input/manifest.json`으로 **증거 커버리지를 로스터리별로 표로** 만든다. (상세 본문 있음 / 상세 이미지 URL만 / 원문 없음)
3. 데이터 흐름을 추적해 `audit/pipeline-map.md` 작성:
   상품 발견 → 상세 수집 → HTML/텍스트 → OCR/Gemini → 추출 → 정규화 → 산지/가공/품종/로스팅/컵노트 판별 → 중복 제거 → 상태 판정 → 품질 필터·게시 가드 → `docs/products.json` → 앱 표시.
   단계마다 파일·함수·입력·출력·fallback·캐시·실패 시 동작을 적는다. 스마트스토어와 공식몰(cafe24·imweb·테라로사 API 등) 경로를 따로 그린다.
4. 기준선 재계산 → `audit/baseline-metrics.json`, `audit/baseline-report.md`.
   - 상품 유형(싱글/블렌드/디카페인/드립백/캡슐/분쇄/굿즈/기타), 판매 중/품절
   - 필드별 존재율(raw / displayed 각각), 로스터리별 표:
     `| Roastery | Total | Active | Missing Origin | Missing Process | Missing Variety | Missing Roast | Missing Notes | Evidence Coverage |`
5. `audit/PHASE-0-REPORT.md` 작성 후 **정지.** 반드시 포함:
   - 위 2번 증거 커버리지 표와 "이 증거로 CASE 1/2를 판정 가능한 상품 수 추정"
   - 섹션 2의 사실 중 틀린 것이 있으면 정정
   - Phase 1 계획(배치 크기, 판정자 구성, 예상 판정 불가 비율)
   - 추가로 필요한 자료가 있으면 목록 (사용자가 로컬에서 더 뽑아 줄 수 있다)

## 5. Phase 1 — Golden Dataset (승인 후)

### 5-1. 절차
1. **결정적 추출 먼저:** 상품명·상세 텍스트에 **명시된** 값(국가명, Washed/내추럴 등)은 스크립트로 먼저 후보를 뽑는다. AI 판정자는 그 후보를 검증하고 애매한 것을 판정한다.
2. **배치:** 25건 단위, 로스터리가 섞이도록 순서를 섞는다. 배치마다 `audit/golden/batch-NNN.json`에 즉시 저장한다.
3. **독립 판정 2회 이상:** Reviewer A·B는 서로의 결과를 보지 않는다. 독립성을 높이기 위해
   - A와 B에 상품 순서를 다르게 준다.
   - **B에게는 BeanPick 현재값(`current`)을 숨긴다.** (현재값에 끌려가는 것 방지)
   - 핵심 필드(origin·process·variety·roast·tastingNotes·productType)에서 A≠B면 Judge가 원문을 다시 읽어 판정한다: A / B / 제3의 값 / 원문에 없음 / UNKNOWN. 억지로 고르지 마라.
4. **Quality Auditor**(배치마다): 증거 없는 HIGH, 로스터리↔산지 혼동, 국가↔지역 혼동, 가공↔로스팅 혼동, **AI가 만든 컵노트**, 없는 품종 생성, 굿즈를 커피로, 블렌드를 싱글로, 품절을 종료로 분류한 것을 찾아 되돌린다.
5. **Coffee Domain Reviewer**: 산지·가공·품종·노트 표현의 의미 검토(예: "게이샤"는 품종, "구지"는 지역, "무산소"는 가공 수식어).

### 5-2. 필드별 추가 조사
- **가공:** 규칙 추가 전에 461건 전체에서 실제 쓰인 표현 corpus를 만든다 → `audit/process-vocabulary.json` (표현, 한/영, 출현 수, 대표 상품, 현재 인식 여부). Washed / Natural / Honey / Anaerobic(무산소·언에어로빅·애너로빅) / Carbonic Maceration(CM) / Thermal Shock / Double Fermentation / Wet Hulled / Semi Washed / Infused 등.
- **로스팅:** 로스터리별로 로스팅 정보를 실제 제공하는지 먼저 분류한다: 명시 단계 / 프로파일명(예: "필터 로스트") / 카테고리에서만 추론 / 간접 추론 / 정보 없음. 정보 없는 상품에 Light/Medium/Dark를 만들지 마라.
- **컵노트:** 판매 중 누락 100건을 로스터리별로 나눠 각각 판정: 상세 텍스트에 있음 / 이미지에만 있을 가능성(증거 필요) / 상품명에 있음 / 구조화 데이터에 있음 / 원문에 없음 / 증거 없음.
- **산지:** collector raw / 상품명 추론 / 상세 확인 / 앱 표시 / Golden 다섯 값을 나란히 기록하고, 로스터리명이 들어간 단계를 추적한다.

### 5-3. 레코드 형식 (`audit/golden-products.json`)
```json
{
  "snapshot": { "sha256": "...", "repoHead": "...", "count": 461 },
  "products": [{
    "id": "...", "roastery": "...", "productName": "...",
    "golden": {
      "productType":  { "value": "single|blend|decaf|dripbag|capsule|ground|goods|other", "confidence": "HIGH", "evidence": "인용 원문", "evidenceSource": "audit-input/products/x.json#evidence.detailCache.detailText" },
      "status":       { "...": "active|soldout|discontinued|unknown" },
      "originCountry": {}, "originRegion": {}, "producer": {},
      "process": {}, "variety": {}, "roast": {}, "tastingNotes": {}
    },
    "current": { "originCountry": { "raw": "...", "displayed": "..." }, "...": {} },
    "diff":    { "originCountry": { "match": false, "case": 1, "failureReason": "PRODUCT_TITLE_PARSE_ERROR", "note": "..." } },
    "review":  { "reviewerA": {}, "reviewerB": {}, "judge": {}, "qualityAudit": {} }
  }]
}
```
더 나은 구조가 있으면 바꿔도 되지만 **원문 인용, 출처, confidence는 반드시 보존**한다.

## 6. Phase 2 — 정량 평가와 회귀 도구

- 필드별(origin·process·variety·roast·tastingNotes) × 로스터리별: Correct / Incorrect / Missing / False positive / Coverage / Precision / Recall. raw·displayed 각각.
- **회귀 도구 `npm run audit:data`** (`audit/tools/` 아래 구현, 오프라인):
  - 입력: `products.json` 경로 하나 (기본 `docs/products.json`). 수집기를 다시 돌리지 않는다.
  - Golden의 HIGH/MEDIUM 필드와 비교해 필드별 Correct / Wrong / Missing 출력.
  - `--before <old.json>`을 주면 전후 비교: **새로 복구된 값 / 새로 사라진 값 / 맞다가 틀려진 값 / 값이 바뀐 상품**을 목록으로 출력. 회귀가 1건이라도 있으면 종료코드 1.
  - Golden에 없는 새 ID는 `NEW`, 스냅샷에서 사라진 ID는 `GONE`으로 따로 표시하고 회귀로 세지 않는다.
  - 외부 의존성 추가 금지(Node 20 표준 라이브러리만).
- 결과: `audit/regression-report.md` (현재 스냅샷 기준 실행 결과 포함)

## 7. 산출물

```
audit/
├─ PHASE-0-REPORT.md
├─ pipeline-map.md
├─ baseline-report.md / baseline-metrics.json
├─ golden-products.json
├─ golden/batch-001.json …
├─ failure-taxonomy.md
├─ process-vocabulary.json
├─ roastery-quality-report.md
├─ origin-quality-report.md
├─ roast-quality-report.md
├─ tasting-note-missing-report.md
├─ disagreement-report.md      (A≠B 건수·필드·Judge 결론·UNKNOWN 비율)
├─ regression-report.md
├─ recommended-fixes.md
├─ ci-and-duplication-notes.md (CI 누락 테스트, tastingNotes 중복 — 보고만)
└─ tools/                      (audit:data 구현)
```

## 8. recommended-fixes.md (구현하지 말고 제안만)

이번 작업에 **Fix 단계는 없다.** 파서 수정은 실제 발행 성공으로만 검증할 수 있고(`CLAUDE.md` Iron Law), 이 환경에서는 불가능하다. 각 후보는 아래 형식:

```
FIX-001
Problem            무엇이 틀렸나
Evidence           영향 상품 수, 대표 상품 3건, 원문 인용
Root Cause         파일 / 함수 / 데이터 흐름
Expected Benefit   복구 가능 건수 (Golden 기준 실제 개수)
Regression Risk    LOW / MEDIUM / HIGH + 망가질 수 있는 상품군
Minimal Change     최소 변경 방법 (코드 스케치 가능, 적용은 금지)
Required Test      추가할 회귀 테스트
Devil's Advocate   "정말 버그인가? 원문에 없는 것 아닌가? 소수 로스터리 때문에 전체를 복잡하게 만드는 것 아닌가? 다른 300건을 망가뜨리지 않나?" 에 대한 답
```
등급: P0 사용자에게 보이는 명백한 오염 / P1 원문에 있는데 대량 누락 / P2 일부 패턴 누락 / P3 원문에 없음(파서 대상 아님, 제외).
Devil's Advocate 검토를 통과하지 못한 후보는 목록 하단 "보류"로 옮긴다.

## 9. 최종 보고서에 반드시 답할 숫자

1. 461건 중 실제 데이터 오류(CASE 1) 건수
2. 원문에 정보가 없는(CASE 2) 건수
3. 판정 불가(CASE 3) 건수와 그중 증거 자료 부족 때문인 건수
4. 파서 때문에 놓친 건수 / OCR 때문에 놓친 건수 / 로스터리 전용 처리가 필요한 건수
5. origin · process · roast 정확도(displayed 기준, raw 기준 병기)
6. tasting note coverage (판매 중 기준)
7. 문제를 가장 많이 만드는 로스터리 (CASE 1 건수 기준)
8. **최소 코드 변경으로 가장 많은 상품을 개선할 지점** — 실제 복구 건수와 근거 상품 목록으로

## 10. 질문 기준

읽기·분석·통계·보고서·`audit/` 내 파일 생성·회귀 도구 작성은 묻지 말고 진행한다.
production 코드 변경, 스키마 변경, 기능 삭제, push·merge·발행은 하지 않는다(필요하면 제안만).

## 마지막 원칙

가장 위험한 행동: **"문제가 있어 보이니 코드를 고쳤다."**
가장 가치 있는 행동: **"461건을 조사해 무엇이 진짜 문제인지 증명했고, 앞으로 어떤 변경이 데이터를 망가뜨렸는지 자동으로 알 수 있게 만들었다."**

461건 중 일부만 보고 "대표성을 확보했다"며 끝내지 마라. 단, 증거가 없는 상품은 `UNKNOWN`으로 정직하게 남기는 것이 전수조사다.
