# BeanPick 증거 커버리지 분석 (Evidence Coverage)

- 분석일: 2026-09-25
- 대상: `audit-input/manifest.json` (products 454건), `audit-input/products/*.json`
- 기준 스냅샷: `audit-input/snapshot-products.json` (454건, sha256 불변)
- 절대 규칙: production 코드 수정 없음, `.env` 열람 없음, 네트워크 접속 없음

## 0. 2차 갱신 (2026-09-25 17:48) — 재추출본 적용

이전 분석에서 보고한 "공유 파일 5개 / 74개 상품 혼재"는 **추출 스크립트 버그였음이 확인**됨 (한글 ID가 파일명에서 지워져 75건이 5개 파일에 덮어써짐). 수정본 zip으로 `audit-input/` 전체 교체 후 재계산 결과:

- `audit-input/products/`에 **454개 개별 파일** (파일명: `<상품ID>-<해시8자리>.json`) — 디스크 454 = manifest 참조 454 = 상품 454
- 454개 파일 전부에서 `snapshotRecord.id` = `top.id` = manifest 상품 ID **일치 (454/454, 불일치 0건)**
- manifest 플래그(hasDetailCache/hasDetailText/detailImageCount/rawObservationCount/ocrEntryCount)와 **실제 파일 내용 전수 대조: 불일치 0건**
- → **공유 파일 문제 해결됨.** 이전 보고서의 §1-3·§7 공유 파일 경고는 철회한다. Phase 1에서 파일 단위 증거 인용 가능.
- 커버리지 수치(detailCache 233 / detailText 76 / detailImages 77 / rawObservation 206 / ocrAny 271 / noEvidence 93)는 **1차와 동일** — manifest 플래그 자체는 처음부터 정확했고, 버그는 파일 매핑에만 있었다.

---

## 1. manifest.json 커버리지 수치 — 재계산 검증

### 1-1. 스냅샷 무결성

| 항목 | manifest 주장 | 재계산 | 판정 |
|---|---|---|---|
| snapshot-products.json sha256 | `ac7739a73376f125a8a200796391a128b206a4da50582fbfa8e350723e6d0b81` | `sha256sum` 결과 동일 | ✅ 일치 |
| 상품 수 | 454 | 454 | ✅ 일치 |
| manifest products 수 | 454 | 454 | ✅ 일치 |
| 증거 파일 수 | — | **454개 (1:1 매핑, 2차 재추출본)** | 아래 1-3 참고 |

### 1-2. 커버리지 수치 전 항목 재계산

`manifest.products[]`의 플래그(`hasDetailCache`, `hasDetailText`, `detailImageCount>0`,
`rawObservationCount>0`, `ocrEntryCount>0`, `hasEvidenceBeyondSnapshot`)를 직접 집계한 결과:

| 지표 | manifest 주장 | 재계산 | 판정 |
|---|---|---|---|
| total | 454 | 454 | ✅ |
| detailCache (상세 캐시 존재) | 233 | 233 | ✅ |
| detailText (상세 본문 텍스트 존재) | 76 | 76 | ✅ |
| detailImages (상세 이미지 URL 존재) | 77 | 77 | ✅ |
| rawObservation (원문 관측 존재) | 206 | 206 | ✅ |
| ocrAny (OCR 캐시 매칭 존재) | 271 | 271 | ✅ |
| noEvidenceBeyondSnapshot (스냅샷 외 증거 없음) | 93 | 93 | ✅ |

**전 항목이 manifest 주장과 정확히 일치한다.**

### 1-3. 파일 구조 — 공유 파일 문제 해결됨 (2차)

~~1차 분석에서 `audit-input/products/`에는 454건이 아닌 385개 파일만 존재하고 5개 파일이 74개 상품에 공유된다고 보고했었다.~~ **이는 추출 스크립트 버그였음이 확인되어 철회한다** (한글 ID가 파일명에서 지워져 75건이 5개 파일에 덮어써짐). 재추출본 전수 검증 결과:

- `audit-input/products/`에 **454개 개별 파일** (파일명 형식: `<상품ID>-<해시8자리>.json`, 예: `아이덴티티커피랩-미드센추리블렌드-3d9961ed.json`)
- manifest `file` 참조 454개 = 디스크 파일 454개 = 상품 ID 454개 (참조 누락 0건, 디스크 잉여 0건)
- 454개 파일 전부: `id` = `snapshotRecord.id` = manifest 상품 ID (불일치 0건)
- manifest 플래그와 실제 파일 내용(`detailCache.status` / `detailText` / `detailImageUrls` / `rawObservations[]` / `ocr[]`) 전수 대조: **불일치 0건**

**Phase 1 주의점 (남은 것만):** 공유 파일 경고는 더 이상 적용되지 않는다. 파일 단위 증거 인용(`audit-input/products/<id>-<hash>.json#evidence.detailCache.detailText` 형식)이 가능해졌다. 단, 2건의 "빈 껍데기" 항목(`hocuspocus-11840045264`, `루비아커피-스트로베리초콜릿케이크`)은 `hasEvidenceBeyondSnapshot=true`이나 상세 본문·관측·OCR·이미지 URL이 전무하므로 실질 C등급으로 취급 (7번 참고).

---

## 2. 로스터리별 증거 커버리지 (21개 로스터리)

정의:
- `DetailText` = `hasDetailText=true` (상세 본문 텍스트 존재)
- `DetailImagesURL` = `detailImageCount>0` (상세 이미지 URL 존재 — 이미지 자체는 미제공)
- `RawObservation` = `rawObservationCount>0`
- `OCR` = `ocrEntryCount>0`
- `NoEvidenceBeyondSnapshot` = `hasEvidenceBeyondSnapshot=false`
- `CacheNoText` (참고) = 상세 캐시는 있지만 본문 텍스트가 없는 상품 수 (가격 옵션만)

| Roastery | Total | DetailText | DetailImagesURL | RawObservation | OCR | NoEvidenceBeyondSnapshot | (CacheNoText) |
|---|---|---|---|---|---|---|---|
| 에어리커피 | 82 | 19 | 0 | 19 | 13 | 50 | 0 |
| 카페도안 | 53 | 24 | 14 | 17 | 51 | 0 | 26 |
| 호커스포커스 로스터스 | 48 | 2 | 0 | 25 | 12 | 14 | 21 |
| 루비아 커피 | 36 | 8 | 21 | 7 | 32 | 0 | 26 |
| 필아웃커피 | 32 | 0 | 16 | 31 | 31 | 0 | 32 |
| 나무사이로 | 29 | 0 | 0 | 29 | 12 | 0 | 0 |
| 로스터릭 | 17 | 3 | 0 | 2 | 14 | 2 | 12 |
| 테라로사 | 15 | 0 | 0 | 0 | 15 | 0 | 0 |
| 커피리브레 | 15 | 0 | 0 | 0 | 2 | 13 | 0 |
| 모모스커피 | 14 | 0 | 0 | 0 | 0 | 14 | 0 |
| 말릭커피 | 13 | 13 | 0 | 13 | 12 | 0 | 0 |
| 커피정경 로스터리 | 13 | 1 | 1 | 5 | 13 | 0 | 12 |
| 토치 커피 | 12 | 0 | 12 | 4 | 12 | 0 | 12 |
| 딥블루레이크 | 12 | 0 | 0 | 12 | 11 | 0 | 0 |
| 아이덴티티 커피랩 | 11 | 0 | 8 | 9 | 9 | 0 | 11 |
| 히떼 로스터리 | 11 | 6 | 5 | 0 | 11 | 0 | 5 |
| 502커피로스터스 | 11 | 0 | 0 | 11 | 0 | 0 | 0 |
| 베르크커피 | 10 | 0 | 0 | 10 | 10 | 0 | 0 |
| 프릳츠 커피 컴퍼니 | 9 | 0 | 0 | 9 | 3 | 0 | 0 |
| 센터커피 | 8 | 0 | 0 | 0 | 8 | 0 | 0 |
| 헬카페 | 3 | 0 | 0 | 3 | 0 | 0 | 0 |
| **합계** | **454** | **76** | **77** | **206** | **271** | **93** | **157** |

합계 검산: Total 454 ✅, DetailText 76 ✅, DetailImagesURL 77 ✅,
RawObservation 206 ✅, OCR 271 ✅, NoEvidence 93 ✅ (전부 1-2와 일치)

### 2-1. NoEvidenceBeyondSnapshot이 큰 로스터리 (판정 불가 비율이 구조적으로 높음)

| 로스터리 | Total | NoEvidence | 비율 | 비고 |
|---|---|---|---|---|
| 모모스커피 | 14 | 14 | **100%** | 어떤 증거도 없음. 전건 CASE 3 (UNKNOWN) 확정 |
| 커피리브레 | 15 | 13 | **87%** | OCR 2건만. 나머지 CASE 3 |
| 에어리커피 | 82 | 50 | **61%** | 454건 중 최대 규모 + 증거 공백 최대 (50건) |
| 호커스포커스 로스터스 | 48 | 14 | 29% | — |

이 로스터리들의 판정 불가 비율은 **파이프라인 결함이 아니라 증거 부재**에 기인한다.
통계에서 `SOURCE_MISSING`·`EVIDENCE_UNAVAILABLE`과 파서 결함을 분리해야 한다.

---

## 3. 스마트스토어 상세 캐시 재분류 — "본문 없음 157건"

스펙 지시에 따라 `hasDetailCache=true` 233건을 본문 유무로 재분류했다.

| 분류 | 건수 | 근거 |
|---|---|---|
| `hasDetailCache=true` 전체 | 233 | manifest 재계산 ✅ |
| ├─ `hasDetailText=true` (본문 있음) | **76** | 파일에서 `detailText` 비어있지 않음 확인 |
| └─ `hasDetailText=false` (본문 없음, 가격 옵션만) | **157** | 아래 실측 구조 참고 |

`hasDetailText=false`인 대표 파일(`products/hocuspocus-5935682761-8b8b9a42.json`)의
`evidence.detailCache` 실제 구조:

```json
{
  "file": "…json",
  "cachedAt": "2026-09-25T….Z",
  "status": "success",
  "detailText": "",
  "detailHtmlStripped": "",
  "detailHtmlTruncated": false,
  "detailImageUrls": [],
  "priceOptions": [ { "id": "…", "price": …, "weight": …, "priceLabel": "…원", … } ],
  "otherKeys": ["status","detailImagesChecked","detailImagesCheckedVersion",
                "priceOptionsStatus","optionFingerprint","optionParserVersion",
                "priceOptionsCheckedAt","optionRetryAt","sourcePrice",
                "sourceOriginalPrice","cachedAt"]
}
```

`status: "success"`인데도 `detailText`·`detailHtmlStripped`·`detailImageUrls`가 전부 비어 있고,
가격 옵션만 들어 있다. 파일 단위 `detailCache.status` 분포(454개 파일 기준, 2차 재확인): `success` 200, `empty` 33, 없음 221 (success+empty = 233 = manifest `hasDetailCache`와 일치).

### 본문 없는 157건의 CASE 1/2 판정 가능성 판단

**CASE 1(원문에 있는데 BeanPick이 놓침)과 CASE 2(원문 자체에 없음)를 구분하려면
"원문"이 있어야 한다.** 본문 텍스트가 없는 캐시는 "원문"이 아니므로,
이 157건은 상세 텍스트만으로는 CASE 1/2 구분이 **불가능**하다.

단, 보조 증거가 있으면 제한적 판정이 가능하다 (7번 등급표 참고):
- OCR만 있는 경우: 컵노트에 한해 제한적 판정 가능. 단 gemini 항목은 모델이 이미 뽑은 노트 목록이므로 HIGH 불가 (5번 참고)
- rawObservation에 `text`가 있는 경우: 공식몰 페이지 텍스트로 독립 판정 가능 (3-3 참고)
- 상품명 자체: 산지·가공 명시 여부 판단 가능하나, 이는 BeanPick `displayed`값과 같은 출처(상품명)이므로 독립 검증이 아니다

**결론: 본문 없는 157건은 "증거 있음"이 아니라 `EVIDENCE_UNAVAILABLE`(상세 본문 기준)로 분류해야 하며,
CASE 1/2 판정은 보조 증거의 질에 따라 A/B/C 등급으로 차등 적용한다.**

---

## 4. 증거 파일 구조 문서화 (샘플 5종)

### 4-1. 공통 외형: `audit-input/products/<id>.json`

```json
{
  "id": "malik-11068505354",
  "snapshotRecord": { "id", "roasterName", "productName", "origin", "process",
                      "roastLevel", "price", "weight", "score", "tastingNotes",
                      "productUrl", "imageUrl", "isSoldOut", "priceOptions", … },
  "evidence": {
    "detailCache": { … } | null,
    "rawObservations": [ … ],
    "ocr": [ … ]
  }
}
```

- `snapshotRecord`: 기준 스냅샷의 해당 상품 레코드 (원천값 그대로)
- `evidence.detailCache`: 스마트스토어 상세 캐시 (4-2)
- `evidence.rawObservations`: 원문 저장소 관측 (4-3)
- `evidence.ocr`: OCR 캐시 매칭 (4-4)
- 증거 없음 상품(예: `products/momos-7422-dfc827e1.json`): `{"detailCache": null, "rawObservations": [], "ocr": []}`

### 4-2. `evidence.detailCache` — 스마트스토어 상세 캐시

필드: `file`, `cachedAt`, `status` (`success`/`empty`), `detailText`, `detailHtmlStripped`,
`detailHtmlTruncated`, `detailImageUrls[]`, `priceOptions[]`, `otherKeys[]`

`detailText` 실측 예시 (`products/malik-11068505354-9fc9a309.json`, 300자):

> "*참고사항 로스팅 프로파일에 수정이 있었습니다. 추출시 커피와 물의 비율을 1:15, 1:16, 1:17로 추출후에 물에 희석하지 않으셔도 맛있게 드실 수 있도록 로스팅 프로파일을 변경했습니다. 브루잉 레시피 링크 에티오피아 구지 샤키소 타데 GG 쿠루메 내추럴 마운틴 워터 디카페인 Ethiopia Guji Shakiso Tade GG Kurume Natural Mountain Water Decaffeinated 국가:Ethiopia 지역: Shakiso, Guji, Oromia 농장: Tade GG Highland Forest C…"

원문 인용에 적합한 구조(국가/지역/농장 명시) — **이것이 A등급 판정의 근거가 된다.**

### 4-3. `evidence.rawObservations[]` — 원문 저장소 관측

필드: `observationId`, `channelId` (예: `malik:smartStore`), `url`, `contentType`,
`lastSeenAt`, `extractorVersion` (예: `smartStoreDetail@1`), `text`, `body`,
`bodyTruncated`, `jsonLd[]`, `meta{}`, `imageUrls[]`

- 전체 511개 관측 중 `text` 비어있지 않음 213개, `body` 존재 510개, `jsonLd`/`meta` 존재 213개
- 공식몰(cafe24 등) 관측은 `text`에 페이지 텍스트가 들어 있어 독립 판정에 사용 가능.
  실측 예시 (`products/coffee502-10-9c34144d.json`, url `https://502coffee.com/product/workers-워커스/10/…`):
  > "502 COFFEE ROASTERS | WORKERS 워커스 - 다크 초콜릿의 짙은 단맛 \n 전체상품목록 바로가기 \n … 40,000원 이상 구매시 무료 배송 … 원두 블렌드 \n 싱글오리진 \n …"
- 스마트스토어 관측은 `body`가 추적용 JSON(`abt` 등)인 경우가 많아 `text`가 비어 있는 경우가 많다
  (예: `products/malik-11068505354-9fc9a309.json`의 3개 관측 중 2개는 `text: ""`, `body`는 추적 JSON)

### 4-4. `evidence.ocr[]` — OCR 캐시 매칭 항목

필드: `imageUrl`, `engine` (`gemini`), `promptOrLang` (`source-notes-v4`),
`cacheDir` (`local/ocr-cache`), `output` (JSON 문자열)

**제품 파일 내 OCR 항목은 전부 `gemini|source-notes-v4` 340개이며, paddle 항목은 0개다.**
(패키지 번들의 `.ocr-cache`에는 paddle 캐시가 있을 수 있으나,
manifest notes에 명시된 대로 "현재 코드의 캐시 키로만 매칭"되어 제품 파일에는 매칭되지 않았다.)

실측 예시 3건 (2차 재추출본에서 재확인 — 5번 참고):

1. `products/terarosa-100543-c9569f19.json` — `[{"text": "Black Tea, Apricot, Lychee, Herbs, Crisp Finish", "group": "", "process": "Washed", "scope": "product"}, {"text": "홍차, 살구, 리치, 허브, 깔끔한 여운", …}]`
2. `products/coffeejg-13717993203-adf3fdb4.json` — 빈 항목 `[]` 1개 + `[{"text": "Lavender", "group": "", "process": "Washed", "scope": "product"}, {"text": "Earl Grey", …}]`
3. `products/히떼로스터리-포스트업-33aa28d9.json` — `[{"text": "Cacao", "group": "", "process": "", "scope": "product"}, {"text": "Roasted Nut", …}]` 및 `[{"text": "Cacao", "group": "Post up Blend", …}, {"text": "Berry", "group": "Post up Blend", …}]`

동일 이미지에 대해 `output: "[]"`인 빈 항목과 노트 항목이 함께 존재하는 경우도 있다
(위 2번 파일은 동일 `imageUrl`에 `[]` 항목 1개 + 노트 항목 1개).

---

## 5. gemini OCR 항목 구조 확인 (스펙 지시 검증)

스펙: "`.ocr-cache/` 및 `evidence.ocr[]`의 gemini 항목은 이미지 원문이 아니라
**모델이 이미 뽑은 노트 목록**이다."

**4-4의 3개 샘플에서 모두 확인됨 (2차 재추출본에서도 3개 새 샘플로 재확인: `coffeejg-13717993203-adf3fdb4.json`, `히떼로스터리-포스트업-33aa28d9.json`, `terarosa-100543-c9569f19.json`).** `output`은 이미지의 OCR 텍스트가 아니라
`[{"text": "<노트>", "group": "", "process": "<Washed 등>", "scope": "product"}]` 형태의
**모델 추출 결과(JSON)** 이다. 특히 `"process": "Washed"`는 이미지 텍스트가 아니라
모델이 노트에 붙인 속성이다. 따라서:

- 이 항목은 "BeanPick 현재 추출값"이지 독립 증거가 아니다
- 이것만으로는 Golden 컵노트를 **HIGH로 확정할 수 없다** (스펙 3-4 준수)
- OCR만 있는 상품(B등급)의 컵노트 판정은 MEDIUM 이하, 원문 이미지 확인이 필요하면 CASE 3

---

## 6. `audit-input/wiki/` 존재 여부

- `audit-input/wiki/`: **없음**
- 레포 `.wiki/` (`.gitignore`에 `.wiki/` 명시됨): **없음**
- → "없음(추측하지 않음)"으로 기록. 과거 사건 기록은 이 분석에 반영하지 않는다.

---

## 7. CASE 1/2 판정 가능성 등급 (A/B/C)

등급 정의 (manifest 플래그 기준):

| 등급 | 조건 | 의미 | 건수 |
|---|---|---|---|
| **A** | `hasDetailText=true` | 상세 본문 있음 → 독립 판정 가능 (CASE 1/2/3 모두 판정) | **76** |
| **B** | 상세 본문 없음 + `rawObservation>0` 또는 `ocr>0` 또는 `detailImageUrl>0` | 판정 제한적 (OCR은 노트만, 이미지는 URL만) | **283** |
| **C** | `hasEvidenceBeyondSnapshot=false` (+ 본문·관측·OCR·이미지 전무 2건) | 스냅샷만 → **UNKNOWN 확정** | **95** |

B등급 내역: rawObservation 보유 150건, OCR 보유 221건, 상세 이미지 URL만 보유 2건
(중복 포함). A+B = 359건이 어떤 형태로든 판정 가능, C 95건은 판정 불가 확정.

⚠️ 등급 산정 시 주의 2건: `hasEvidenceBeyondSnapshot=true`이나
상세 본문·관측·OCR·상세 이미지 URL이 전무한 상품 2건
(`hocuspocus-11840045264`, `루비아커피-스트로베리초콜릿케이크`) —
가격 옵션 캐시만 있으므로 실질적으로 C로 취급한다.
(2차 재추출본에서 전수 확인 — 개별 파일이 제대로 매핑된 상태에서도 여전히 빈 껍데기.)

### 7-1. 로스터리별 판정 가능성 등급

| Roastery | Total | A (독립 판정) | B (제한적) | C (UNKNOWN 확정) |
|---|---|---|---|---|
| 에어리커피 | 82 | 19 | 13 | 50 |
| 카페도안 | 53 | 24 | 29 | 0 |
| 호커스포커스 로스터스 | 48 | 2 | 31 | 15 |
| 루비아 커피 | 36 | 8 | 27 | 1 |
| 필아웃커피 | 32 | 0 | 32 | 0 |
| 나무사이로 | 29 | 0 | 29 | 0 |
| 로스터릭 | 17 | 3 | 12 | 2 |
| 테라로사 | 15 | 0 | 15 | 0 |
| 커피리브레 | 15 | 0 | 2 | 13 |
| 모모스커피 | 14 | 0 | 0 | 14 |
| 말릭커피 | 13 | 13 | 0 | 0 |
| 커피정경 로스터리 | 13 | 1 | 12 | 0 |
| 토치 커피 | 12 | 0 | 12 | 0 |
| 딥블루레이크 | 12 | 0 | 12 | 0 |
| 아이덴티티 커피랩 | 11 | 0 | 11 | 0 |
| 히떼 로스터리 | 11 | 6 | 5 | 0 |
| 502커피로스터스 | 11 | 0 | 11 | 0 |
| 베르크커피 | 10 | 0 | 10 | 0 |
| 프릳츠 커피 컴퍼니 | 9 | 0 | 9 | 0 |
| 센터커피 | 8 | 0 | 8 | 0 |
| 헬카페 | 3 | 0 | 3 | 0 |
| **합계** | **454** | **76** | **283** | **95** |

등급 합계: A 76 + B 283 + C 95 = 454 ✅

(2차: 공유 파일 경고는 철회됨 — 454개 파일이 1:1 매핑되고 manifest 플래그와 파일 내용 전수 일치(불일치 0건)이므로 위 등급은 파일 단위로 검증 가능하다.)

### 7-2. 예상 판정 불가 비율 (Phase 1 계획 참고용)

- 확정 UNKNOWN (C): 95건 (20.9%)
- 제한적 (B): 283건 (62.3%) — 필드별로 CASE 3이 대량 발생 예상
  (특히 상세 이미지 URL만 있는 2건, OCR만 있는 상품의 산지/가공/품종/로스팅)
- 독립 판정 가능 (A): 76건 (16.7%)

---

## 8. 핵심 요약 (PHASE-0-REPORT용) — 2차 갱신

1. **manifest 커버리지 수치 7개 전 항목이 재계산과 일치** (sha256 포함) — 1차와 동일
2. 상세 캐시 233건 중 **본문 있는 것은 76건뿐, 157건은 가격 옵션만** — "증거 있음"이 아니라 `EVIDENCE_UNAVAILABLE`(본문 기준)로 재분류 필요 (2차 파일에서도 동일)
3. OCR 항목은 전부 `gemini|source-notes-v4` (제품 파일 내 paddle 0건). gemini 출력은 **모델이 뽑은 노트 목록(JSON)** 이지 이미지 원문이 아님 — Golden HIGH 근거로 사용 금지 (2차 3개 새 샘플로 재확인)
4. **공유 파일 문제 해결됨 (철회):** 1차 보고의 "공유 파일 5개 / 74개 상품"은 추출 스크립트 버그였다. 재추출본에서는 454개 파일이 454개 상품과 1:1 매핑되고, manifest 플래그와 파일 내용 전수 대조 불일치 0건. 파일 단위 증거 인용 가능
5. `audit-input/wiki/` 없음 (`.gitignore`에 `.wiki/` 명시, clone에도 없음) — 추측하지 않음
6. 판정 가능성: A 76건 / B 283건 / C 95건(UNKNOWN 확정) — 1차와 동일
7. NoEvidence가 큰 로스터리: **모모스커피 14/14(100%), 커피리브레 13/15(87%), 에어리커피 50/82(61%)** — 판정 불가 비율이 높을 수밖에 없으며 파이프라인 결함이 아님
8. rawObservation 511개 중 `text` 보유 213개 — 공식몰(cafe24 등) 관측은 독립 판정 근거로 유효. 스마트스토어 관측의 `body`는 추적 JSON인 경우가 많아 주의
9. `hasEvidenceBeyondSnapshot=true`이나 실질 증거 없는 2건 (`hocuspocus-11840045264`, `루비아커피-스트로베리초콜릿케이크`)은 실질 C등급으로 취급 — 재추출본에서도 확인됨
