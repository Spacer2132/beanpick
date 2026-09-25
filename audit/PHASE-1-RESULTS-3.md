# BeanPick Phase 1 결과 정리 3 — 사람 검증 반영 + 재검사 (배치 1~10)

- 작성: 2026-09-25
- 범위: `audit/golden/batch-001.json` ~ `batch-010.json` (250/454건)
- 계기: 사람 검증 7건(1건 404 보류) 결과 + 사용자 지시 [1]~[5]
- 주의: 사용자 지시의 "[4] 지난 메시지의 [1]~[4]" 원문은 이 대화·메인챗·메모리 어디에서도 찾지 못했음.
  아래 [4]는 항목명(OCR 순환 83건 / 도메인 규칙 위반 정정 / 시트 표기 분리 / Judge 편향 점검)으로 해석해 처리한 것 — 다르면 정정 바람.

## 1. 사람 검증 결과 반영 (7건)

| # | 상품 | 결과 |
|---|---|---|
| 1 | namusairo-1090 (피크닉) | process "블렌드"(HIGH) → **"Natural Fermentation · Washed" HIGH** 정정 (golden 오류·필드 혼동). tastingNotes '쥬시' 제거 (도메인 규칙) |
| 3 | 커피정경 배합커피#4 율무 | originCountry → **"브라질 · 인도 · 콜롬비아 · 베트남" HIGH**, roast → **Dark(원문: 다크 로스트) HIGH** 정정. process는 SOURCE_MISSING 유지. **상품 혼동 없음** — snapshotRecord·detailCache의 productUrl/productName/ID 일치. 단 priceOptions에 데이터셋 외 상품 ID(13736426450) 혼입 기록 |
| 4 | 로스터릭 콜롬비아 E.A 디카페인 | roast → **Medium-Dark(원문: 중강배전) HIGH** 정정 |
| 5 | identity-13718237904 | 변경 없음 (UNKNOWN 정직). 시트는 "증거 부족(UNKNOWN)"으로 분리 표시 |
| 6 | werk-170 | golden 유지 — productType=blend / process=null이 규칙상 정답 |
| 7 | fillout-13684373989 | 변경 없음 (UNKNOWN 정직). 노트 누락은 **OCR_MISS 확정 사례**로 기록 ([3]) |
| 2, 8~10 | 미확인 (1건 404 보류 포함) | — |

정정 3건의 diff는 NOT_IMPLEMENTED(수집 시 detailImageUrls 미수집)로 분류.

## 2. [1] SOURCE_MISSING 판정 기준 강화 — 679건 전수 재검사

새 기준: **SOURCE_MISSING은 해당 필드가 있을 수 있는 원문 전부를 확인했을 때만 허용.**
productName만 근거거나 이미지 미확인 상태의 SOURCE_MISSING → UNKNOWN(EVIDENCE_UNAVAILABLE).

| 구분 | 건수 |
|---|---|
| 재검사 대상 | 679 |
| → UNKNOWN 재분류 | **451** |
| 유지 (전수 확인 문서화 217 + Judge/도메인 전수 결론 7) | 224 |
| 사람 검증으로 HIGH 정정 | 3 |

재분류 후: SOURCE_MISSING **679 → 225**, UNKNOWN **474 → 925** (+451).

### 필드별 재분류

| 필드 | 재분류 | 유지 |
|---|---|---|
| roast | 104 | 43 |
| variety | 98 | 32 |
| producer | 90 | 34 |
| originRegion | 74 | 30 |
| process | 41 | 27 |
| originCountry | 39 | 17 |
| tastingNotes | 5 | 36 |
| productType | 4 | 5 |

미확인 출처 1위: **OCR 출력 (257건 단독, 107건 이미지+OCR)** — 리뷰어가 OCR을 봤어도 evidence에 인용하지 않으면 재분류.
tastingNotes는 OCR 인용이 잘 문서화되어 유지율 최고. 로스터리별 × 필드별 상세표는 `audit/golden/_work/source-missing-reexam.md`.

## 3. [2] evidenceSource 경로 검증 — 5655건 전수

| 구분 | 건수 |
|---|---|
| 정상 해석 (실제 파일·키로 확인) | 4678 |
| 유효 마커 (`collector_flag`, `coffee_domain_review`, `manifest:`, judge 주석) | 726 |
| 복합 인용 (A + B — 부분별 전부 해석됨) | 24 |
| 내부 참조 (`audit/golden/*-evidence.json` 번들) | 292 |
| 빈 문자열 (원천 데이터 부재) | 161 |
| 서술형 주석 (`judge: insufficient evidence` 등, 의도된 것) | 66 |

깨진 패턴 3224건 전수 수정: `#productName`→`snapshotRecord.productName`(1546건),
`#evidence.ocrNotes`→`evidence.ocr`, `#evidence.rawTexts`→`evidence.rawObservations`,
`#evidence.detailText`→`evidence.detailCache.detailText`, `<파일명 미제공>`/`[id=]`/bare id→실제 파일명,
`products/products/` 중복 제거 등. 수정 제안서는 `audit/golden/_work/evidence-source-fixes.json`.
잔여 161건(empty) + 55건(detailCache null)은 수집 단계 데이터 부재 — golden의 UNKNOWN/SOURCE_MISSING과 함께 관리.

## 4. [3] 발견 사항 기록 — `audit/recommended-fixes.md` (코드 수정 없음)

1. **roast 누락 원인 가설**: 사람 검증 6건 중 4건에서 상세이미지에 로스팅 표기 확인.
   현재 Gemini OCR은 노트만 추출 → roast 누락의 상당수는 SOURCE_MISSING이 아니라 **OCR 범위 밖(NOT_IMPLEMENTED)**일 가능성.
   검증 방법: OCR 스키마에 roast 추가 후 4개 상품 재추출 비교 (배치 11 이후).
2. **fillout-13684373989 OCR_MISS 확정 사례**: 상세이미지에 히비스커스·레드커런트·감초가 있으나 BeanPick 표시 누락.
   golden은 UNKNOWN 유지 (사람 검증 사실을 소급 반영하지 않음).

## 5. [4] 네 항목

### ① OCR 순환
- 91개 노트 텍스트가 2개 이상 상품에 반복 (153상품, 33.7%). 완전 중복 OCR 블록 **10개 → 29상품**,
  로스터리 교차 **5블록 → 17상품** (cafedoan의 Jasmine/Peach/Honey 계열 출력이 아이덴티티·루비아·히떼 상품에 그대로).
  원본/피해자 판별 불가 → CASE 3.
- 배치 1~10 진입 11건 중 10건은 QA가 UNKNOWN/제외 처리 ("제외 확인").
  유일하게 채택된 b1 **cafedoan-6199336952** (tastingNotes MEDIUM) → **UNKNOWN으로 강등** (CASE 3, 일관성 유지).
- "83건"은 추정치였음 — 실측은 텍스트 91 / 상품 153. 상세: `audit/golden/_work/ocr-circulation.md`.

### ② 도메인 규칙 위반 정정 (8건 적용, batch 파일 반영)
- werk-161 process '블렌드' → null/SOURCE_MISSING (성분별 가공 상이, #6 werk-170 규칙)
- tastingNotes 식감어 제거 5건: namusairo-1090 '쥬시', 루비아-피렌체 '부드러운', 히떼-포스트업 '풀바디', 히떼-굿데이 '좋은균형감', coffee502-11 '좋은밸런스'
- originRegion 농장명 혼입 정정 2건: toch-13663022224 '라 에스페란자 부에노스 아이레스' → '부에노스 아이레스',
  identity-13735844414 '엘 푸엔테 산 이시드로' → '산 이시드로'
- namusairo-1090 process는 [결과]에서 이미 정정됨. LOW 4건은 판매자 노트 섹션 명시된 경계 사례로 판단 유보.
- 수정 제안서: `audit/golden/_work/domain-violations.json`.

### ③ 시트 표기 분리 (`audit/human-check.md` 직접 수정)
- UNKNOWN → **"증거 부족(UNKNOWN)"**, SOURCE_MISSING → **"원문에 없음"**. legend에 정의 추가.

### ④ Judge 편향 점검
- b9의 B 46/50은 **편향이 아니라 B가 실제로 더 정확했기 때문** (A의 농장→지역 오분류, 브랜드→생산자 오인 등).
- 중간 보고서의 "current를 본 A의 confidence 상향" 서술은 **사실과 반대**: b9 confidence-only 30건 전부 B(블라인드)가 A보다 높게 잡음.
  current를 본 A는 오히려 보수적이었다.
- b2·b10은 A 우세 (표기 차이 배치에서 current 노출이 유효). 구조적 B 편향 없음.
- **b6의 Judge 기록 미보존** (judge 파일 빈 배열) → 배치 11부터 Judge 판정 기록 파일화를 프로토콜에 명시 (recommended-fixes 후보).
- 상세: `audit/golden/_work/judge-bias-check.md`.

## 6. 변경 파일

- `audit/golden/batch-001.json` ~ `batch-010.json` (golden 정정·재분류·경로 수정·도메인 정정)
- `audit/golden/_work/source-missing-reexam.md` (신규)
- `audit/golden/_work/evidence-source-fixes.json` (신규)
- `audit/golden/_work/ocr-circulation.md` (신규)
- `audit/golden/_work/domain-violations.json` (신규)
- `audit/golden/_work/judge-bias-check.md` (신규)
- `audit/recommended-fixes.md` (신규)
- `audit/human-check.md` (표기 분리)
- `audit/PHASE-1-RESULTS-3.md` (본 파일)

## 7. 다음 단계

- 배치 11~19 (204건)는 지시대로 **아직 진행하지 않음**
- 배치 11 시작 전 반영 사항: Judge 판정 기록 파일화 (프로토콜 명시), OCR 스키마에 roast 추가 검토
