# Phase 1 판정 프로토콜 (배치 코디네이터용 — 반드시 그대로 따를 것)

## 0. 절대 규칙
- production 코드 수정 금지. `.env` 열람 금지. 네트워크 접속 금지.
- 원문에 없는 값은 만들지 않는다. 빈 값·UNKNOWN은 실패가 아니다.
- 모든 HIGH/MEDIUM 판정에 원문 인용 + 출처(`audit-input/products/<파일>#경로`) 필수.
- 새 파일은 `audit/golden/` 아래에만.
- 비교 정규화는 `audit/regression-rules.md`를 따른다 (한/영 매핑, 구분자·공백·대소문자).

## 0-1. 스키마 개정 이력
- **rev1 (2026-09-25)**: `originRegion`·`productType`은 앱에 표시가 없어 diff `NOT_DISPLAYED_FIELD`
  (비교 제외). `producer`는 `displayed.region`(= 앱 '농장' 행, 상품명 기반 추론)과 비교.
  confidence에 `SOURCE_MISSING`(원문 확인했으나 정보 없음) 추가 — `UNKNOWN`은 증거 부족에만 사용.
  `status`는 수집 플래그(`isSoldOut`) 기준 `MEDIUM`/`collector_flag`, 정확도 통계에서 제외.
  `roast`는 5단계 enum + `raw`(원문 표기) 보존. OCR 충돌은 `OCR_CONFLICT`/CASE 3.
  golden 전 필드에 `raw`(원문 표기) 병기.
- **rev2 (2026-09-25, 배치 11~ 적용)**: `SOURCE_MISSING` 강화 — 원문(상세 텍스트·관측·OCR)을 확인했으나
  해당 정보가 없으면 `SOURCE_MISSING`(증거 부족인 경우만 `UNKNOWN`).
  `tastingNotes` 중 OCR 단독 근거 + `MEDIUM`은 `evidenceKind: "current_echo"` 표기(§9 근거, 정확도 통계 제외).
  디카페인 가공법은 `process`에서 분리해 `decafMethod` 필드 신설
  (Mountain Water / Swiss Water / E.A / Sugarcane / Sugarcane E.A, 미명시 디카페인은 UNKNOWN).
  질감·강도 서술(쥬시/SWEET/JUICY/복합성/달콤함 등)은 `tastingNotes.value`에서 제외(`raw`는 보존).
  Judge 판정은 `audit/golden/_work/batch-0XX-judge-record.json`에 파일로 기록.
  배치마다 `audit/tools/quality-auditor-checks.py` 실행 — 위반 0건이어야 통과.

## 1. 입력
- `audit/golden/current-values.json`: 상품별 current.raw / current.displayed (실제 앱 함수 실행값). **유일한 current 출처.**
- `audit/golden/batches.json`: 배치별 상품 ID 25건.
- `audit-input/products/<file>`: 증거 (`evidence.detailCache.detailText`, `evidence.rawObservations[].text`, `evidence.ocr[].output`, `detailImageUrls`).
- 기준 스냅샷 sha256: `ac7739a73376f125a8a200796391a128b206a4da50582fbfa8e350723e6d0b81`, count 454, repoHead `88fad74faad43b8a1e8abf6ef7676c62ed0a9f09`.

## 2. C등급(증거 없음) 기계 처리 — 리뷰 연극 금지
`evidenceGrade === 'C'`인 상품은 A/B/Judge 없이 기계적으로 기록:
- golden 전 필드 `value: null`(tastingNotes는 `[]`), `confidence: "UNKNOWN"`,
  `evidence: "제공된 증거 없음 (스냅샷만 존재)"`, `evidenceSource: "manifest: hasEvidenceBeyondSnapshot=false"`,
  diff의 `failureReason: "EVIDENCE_UNAVAILABLE"`, `case: 3`.
- 예외: `status`는 스냅샷의 `isSoldOut` 플래그로 판정 → `value: soldout|active`,
  `confidence: "MEDIUM"`, `evidenceSource: "collector_flag"`.
- `review: { note: "C-grade mechanical: no evidence, skipped independent review" }`.

## 3. 증거 사전 추출 (코디네이터가 직접)
A/B 등급 상품마다 증거 텍스트를 미리 추출해 워커에게 전달한다:
- `detailText`: `evidence.detailCache.detailText` (길면 앞 4000자 + "…(생략)" 표기)
- `rawTexts`: `evidence.rawObservations[]` 중 `text`가 비어있지 않은 것 (관측별 url + text 앞 2000자)
- `ocrNotes`: `evidence.ocr[]`의 `output` — **이것은 이미지 원문이 아니라 모델이 이미 뽑은 노트 목록이다. "BeanPick 현재 추출값"으로 취급. 이것만으로 HIGH 불가, 최대 MEDIUM.**
- `detailImageUrls`: URL 목록 — 이미지 자체는 볼 수 없으므로 "이미지 안에만 있을 법한 정보인데 텍스트 증거가 없으면 CASE 3, 원인 후보 `OCR_MISS?`" (확정 금지)
- 상품명(productName) 자체도 증거다.

## 4. Reviewer A (current 공개, 단독)
입력: id, roastery, productName, productUrl, **current 전체**, §3 증거 텍스트.
지시: 각 필드를 **독립적으로** 원문 근거에서 판정하라. current는 참고만 하고, 원문에 없는 값을 current에서 가져오지 마라.
출력: 아래 §7 스키마의 `golden` 블록.

## 5. Reviewer B (current 블라인드, 다른 순서)
입력: id, roastery, productName, productUrl, §3 증거 텍스트 — **current 일체 없음**. 상품 순서는 A와 다르게 셔플.
지시: §4와 동일하되 current를 볼 수 없으므로 순수하게 원문에서 판정.
출력: `golden` 블록.

## 6. Judge (A≠B 불일치만)
핵심 필드(productType, status, originCountry, originRegion, producer, process, variety, roast, tastingNotes)에서 A≠B인 항목만:
- 원문을 다시 읽고 판정: A 채택 / B 채택 / 제3의 값 / 원문에 없음(null, SOURCE_MISSING) / UNKNOWN. **억지로 고르지 마라.**
- 비교 정규화는 `audit/regression-rules.md`를 따른다 (tastingNotes 정렬 집합 비교, 국가 한/영 동일값, 대소문자·공백·구분자 무시).
- 일치 필드는 A(또는 B) 값을 그대로 사용하되, QA에서 뒤집을 수 있다.
- 동일 이미지의 OCR이 정면 충돌하면 원문 이미지 없이는 해결 불가 → CASE 3/UNKNOWN, diff `failureReason: "OCR_CONFLICT"`로 별도 기록.

## 7. Quality Auditor (배치 전체)
다음을 찾아 되돌리고 `review.qualityAudit`에 기록:
- 증거 없는 HIGH, 로스터리명↔산지 혼동, 국가↔지역 혼동, 가공↔로스팅 혼동
- **AI가 만든 컵노트** (원문에 없는 노트를 그럴듯하게 생성), 없는 품종 생성
- 굿즈를 커피로, 블렌드를 싱글로, 품절을 판매종료(DISCONTINUED)로 분류
- `확인 필요` roastLevel을 Golden에서 "추정"한 경우 → UNKNOWN으로 되돌림. 단, 원문에 로스팅 단계 표기가 있으면
  §9의 5단계 enum 매핑(중강배전=Medium-Dark, 중약배전=Medium-Light, HIGH)을 적용한다.
되돌린 건수를 센다.

### 자동 검사 3종 (2026-09-25 추가)
`audit/tools/quality-auditor-checks.py`를 배치 전체에 실행 — 위반 0건이어야 통과:
1. **질감어 사전**: tastingNotes value에 질감 서술(쥬시/SWEET/JUICY/부드러운/풀바디/좋은균형감/좋은밸런스/마일드한커피/복합성/달콤함/가득/깔끔한 등)이 노트로混入
2. **process 오염**: process value에 블렌드/디카페인/디카페인 공정어(마운틴 워터/스위스 워터/E.A/슈가케인 등) 포함
3. **evidenceKind 누락**: OCR 단독 근거 + MEDIUM인데 evidenceKind가 없는 tastingNotes

## 8. Coffee Domain Reviewer (배치 전체)
- 게이샤=품종, 구지/예가체프/타라주=지역, 무산소/언에어로빅/애너로빅=가공 수식어(단독 가공 아님), 워시드=Washed, 내추럴=Natural, 허니=Honey, CM=Carbonic Maceration, 마운틴 워터=디카페인 가공법
- 산지 표기 검증: "에티오피아 구지" → originCountry=에티오피아(HIGH), originRegion=구지(HIGH)

## 9. 필드별 판정 가이드
- **productType**: single(단일 산지 명시) / blend(블렌드 명시 또는 복수 산지) / decaf(디카페인/마운틴워터/스위스워터 명시) / dripbag / capsule / ground(분쇄 명시) / goods(굿즈) / other(커피 상품이나 분류 불가). **블렌드인데 산지 하나만 보이면 blend 유지, single로 내리지 마라.** 앱에 표시가 없으므로 diff는 `NOT_DISPLAYED_FIELD`.
- **status**: 수집 플래그(`isSoldOut`)를 1차 근거로 사용. `evidenceSource: "collector_flag"`, `confidence: "MEDIUM"`.
  원문에 반대 증거(예: 본문 'SOLD OUT' 표기 + isSoldOut=false)가 있으면 원문 우선. **status는 정확도 통계(불일치율·불일치 건수)에서 제외.**
- **originCountry**: 국가명. 로스터리명이 origin에 들어간 것은 증거가 아니라 수집 고정값이므로 무시.
- **originRegion**: 원문 기준으로 판정하되, 앱에 지역 표시가 없으므로 diff는 `NOT_DISPLAYED_FIELD` (비교 제외).
- **producer**: 원문 기준 판정. diff는 `displayed.region`(앱 '농장' 행, 상품명 기반 추론)과 비교 — `audit/regression-rules.md` §7 규칙.
  golden.producer가 null인데 농장 행에 상품명 찌꺼기가 보이면 producer 필드의 FALSE_POSITIVE.
- **process**: Washed/내추럴/허니/무산소(애너로빅)/CM/열충격/더블퍼먼테이션/웻헐드/세미워시드/인퓨즈드 등. 상품명·본문에 명시된 것만.
- **variety**: 게이샤/티피카/버번/카투라/카투아이/문도노보/SL28/쿠루메/74158 등 품종명. 지역명(구지·예가체프·타라주·안티구아)을 품종으로 기록 금지.
- **roast**: 5단계 enum `Light / Medium-Light / Medium / Medium-Dark / Dark` — **원문에 명시된 경우만**.
  원문 라벨 매핑: 중강배전=Medium-Dark, 중약배전=Medium-Light(HIGH), 미디엄 다크 로스트=Medium-Dark,
  강배전=Dark, 중배전=Medium, 라이트 로스트=Light. `golden.roast.raw`에 원문 표기를 항상 보존.
  '확인 필요'는 정보 없음 → null/SOURCE_MISSING.
- **tastingNotes**: 원문에 명시된 노트 목록. gemini OCR 출력은 독립 증거 아님(최대 MEDIUM).
  동일 이미지의 OCR이 충돌하면 CASE 3/UNKNOWN + `OCR_CONFLICT`.

## 10. Confidence
- HIGH: 원문에 명시 (예: 본문 "국가:Ethiopia", 상품명 "에티오피아 구지 내추럴")
- MEDIUM: 복수 증거 조합으로 강하게 추론. status의 수집 플래그 근거도 MEDIUM.
- LOW: 간접·애매
- SOURCE_MISSING: 원문을 확인했으나 해당 정보가 없음 (value는 null)
- UNKNOWN: 증거 부족으로 확인 불가 (C등급 기계 처리는 UNKNOWN 유지)
- 회귀 비교는 HIGH·MEDIUM만 정답으로 사용.

## 11. 출력: `audit/golden/batch-NNN.json`
```json
{
  "batch": 1, "ids": [...],
  "snapshot": { "sha256": "ac7739a7…", "repoHead": "88fad74f…", "count": 454 },
  "summary": {
    "total": 25, "cMechanical": 0, "reviewed": 25,
    "disagreements": 0, "disagreementsExclStatus": 0, "disagreementRateExclStatus": 0.0,
    "unknownFieldCount": 0, "unknownFieldRate": 0.0,
    "sourceMissingFieldCount": 0, "sourceMissingFieldRate": 0.0,
    "mismatchCountExclStatus": 0, "failureReasonDistributionExclStatus": {},
    "statusExcludedFromAccuracy": true,
    "qaReversals": 0, "domainCorrections": 0,
    "topMisjudgments": ["사례 요약 3건"],
    "revisionNotes": "스키마 개정 내역"
  },
  "products": [{
    "id": "...", "roastery": "...", "productName": "...", "evidenceGrade": "A",
    "golden": {
      "productType":  { "value": "single", "raw": "single", "confidence": "HIGH", "evidence": "인용 원문", "evidenceSource": "audit-input/products/x.json#evidence.detailCache.detailText" },
      "status":      { "value": "active", "raw": "active", "confidence": "MEDIUM", "evidence": "isSoldOut=False (수집 플래그)", "evidenceSource": "collector_flag" },
      "originCountry": {}, "originRegion": {}, "producer": {},
      "process": {}, "variety": {}, "roast": { "value": "Medium-Dark", "raw": "중강배전" },
      "tastingNotes": { "value": ["라즈베리"], "raw": ["라즈베리"], "confidence": "HIGH", "evidence": "...", "evidenceSource": "..." }
    },
    "current": { "originCountry": { "raw": "...", "displayed": "..." }, "process": {}, "variety": {}, "roast": {}, "tastingNotes": {}, "productType": {}, "status": {} },
    "diff": { "originCountry": { "match": true, "case": null, "failureReason": null, "note": "" }, "...": {} },
    "review": { "reviewerA": { "golden": {} }, "reviewerB": { "golden": {} }, "judge": { "fields": {}, "note": "" }, "qualityAudit": { "reversals": [], "note": "" }, "domainReview": { "corrections": [], "note": "" } }
  }]
}
```
- golden 각 필드는 `{ value(정규화 값), raw(원문 표기), confidence, evidence, evidenceSource }`.
  tastingNotes는 value/raw가 배열. null 필드는 `raw: null`.
- diff는 **displayed 기준**으로 계산: `match` = golden.value와 current.displayed의 의미적 일치(`audit/regression-rules.md`).
  불일치 시 `case`(1/2/3) + `failureReason`(taxonomy 코드) + `note`.
- `originRegion`·`productType` diff는 `match: null, failureReason: "NOT_DISPLAYED_FIELD"` (앱 표시 없음, 비교 제외).
- `producer` diff는 `golden.producer` vs `displayed.region`(앱 '농장' 행) 비교.
- 스마트스토어 origin/process/roastLevel은 수집 단계 고정값이므로 golden이 UNKNOWN이어도 CASE 1이 아니라 `NOT_IMPLEMENTED`로 분류.
- summary의 정확도 지표(disagreements, mismatch, failureReason 분포)는 status 제외. `statusExcludedFromAccuracy: true` 명시.
- summary.topMisjudgments: QA/도메인 리뷰가 잡은 대표 오판 3건 요약 (어느 리뷰어가 무엇을 틀렸고 왜).

## 12. 코디네이터 실행 순서
1. batches.json에서 배치 ID 목록, current-values.json에서 current 읽기.
2. C등급 기계 처리 → 레코드 생성.
3. A/B 등급 상품의 §3 증거 사전 추출.
4. Reviewer A 워커와 Reviewer B 워커를 **병렬** 스폰 (서로의 결과를 보지 않음).
5. 핵심 필드 불일치 집계 → Judge 워커 스폰.
6. Quality Auditor 워커, Coffee Domain Reviewer 워커 스폰 (병렬 가능).
7. 수정 반영 → diff 계산 → batch-NNN.json 저장 → summary 작성.
8. 완료 보고 (나에게): summary 숫자 + topMisjudgments.
