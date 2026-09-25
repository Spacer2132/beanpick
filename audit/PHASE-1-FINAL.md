# BeanPick Phase 1 최종 보고서 — Golden Dataset 감사 (454건)

- 기간: 2026-09-25 ~ 2026-09-26
- 범위: 454개 상품, 19개 배치 (18×25 + 4)
- 방법: Reviewer A/B 독립 판정 → Judge 불일치 해소 → Quality Auditor → Coffee Domain Reviewer
- 브랜치: `muse/audit-golden` (main 미터치)
- 입력: `audit/golden/current-values.json` (실제 앱 함수 실행값) + `audit-input/products/*.json`
- 품질 검사: `audit/tools/quality-auditor-checks.py` 5종 — **19개 배치 전부 위반 0건**
- 2026-09-26 정정: tastingNotes diff §6.1 집합 비교 재계산 (131건 정정), 지표 정의 개정

## 1. 지표 정의 (2026-09-26 개정)

"일치/454"는 판정 불가와 "둘 다 빈 값"을 섞어 실제를 가리므로, 필드별로 아래 세 지표를 따로 본다.

- **(a) 판정 가능 기준 정확도** = match / (match + mismatch). 판정 불가(None) 제외.
- **(b) 값 재현율** = golden에 HIGH/MEDIUM 값이 있는 상품 중 BeanPick이 맞게 보여준 비율 (current_echo 제외).
- **(c) 거짓양성** = golden이 SOURCE_MISSING인데 BeanPick이 값을 보여준 건수.

### (a) 판정 가능 기준 정확도

| 필드 | 정확도 |
|---|---|
| originCountry | 86.6% (305/352) |
| tastingNotes | 78.2% (258/330) |
| variety | 74.8% (255/341) |
| process | 67.1% (235/350) |
| roast | 58.5% (190/325) |
| producer | 41.6% (126/303) |

### (b) 값 재현율 (golden HIGH/MEDIUM, current_echo 제외)

| 필드 | 재현율 |
|---|---|
| originCountry | 90.1% (247/274) |
| process | 80.2% (190/237) |
| producer | 54.1% (46/85) |
| tastingNotes | 53.2% (50/94) |
| variety | 52.4% (66/126) |
| roast | 6.8% (5/73) |

roast 6.8%: golden에 배전도 값이 있는 73건 중 5건만 표시. 기존 "41.9%"는 둘 다 빈 값 185건이 포함된 수치였다.

### (c) 거짓양성 (golden SOURCE_MISSING → 표시값 있음)

| 필드 | 건수 | 비고 |
|---|---|---|
| producer | 95/134 | 상품명 파생 farm 텍스트 표시 (최대 거짓양성원) |
| process | 28/68 | |
| originCountry | 3/39 | |
| variety | 1/119 | |
| tastingNotes | 2/84 | |
| roast | 1/162 | 161건은 "확인 필요" 플레이스홀더라 제외, 진짜 오표시 1건 |

### 불일치 원인 (match=False, 상위)

| 원인 | 건수 | 대표 패턴 |
|---|---|---|
| producer FALSE_POSITIVE | 144 | 상품명·에스테이트명 → producer 승격 (b16에서 9건 QA 되돌림) |
| tastingNotes FALSE_POSITIVE | 42 | §6.1 재계산 후 25→42 (golden 외 표시가 집합 차집합으로 정확히 분류) |
| tastingNotes PARSER_MISS | 20 | §6.1 재계산 후 113→20으로 감소 |
| roast NOT_IMPLEMENTED | 101 | 로스팅 파서 미구현 (False 75 + 판정불가 26) |
| variety PARSER_MISS | 55 | 품종 표기 파서 누락 |
| process PARSER_MISS / FALSE_POSITIVE | 38 / 31 | — |
| tastingNotes NORMALIZATION_ERROR | 10 | §6.1 재계산 후 64→10으로 감소 |

### 판정 불가 (match=None)

- EVIDENCE_UNAVAILABLE 641필드 — C등급(증거 없음)이 가장 큰 판정 불가 원인
- OCR_CONFLICT 16 (tastingNotes), UNMAPPED_LABEL 6 (roast), NOT_IMPLEMENTED 50 (판정불가)

### golden UNKNOWN 현황

originRegion 334 · variety 328 · roast 380 · producer 365 · process 215 · originCountry 180 · productType 106 · tastingNotes 6. 빈 값·UNKNOWN은 실패가 아님 (프로토콜 결정).

## 2. tastingNotes §6.1 재계산 (2026-09-26)

- 문제: diff.tastingNotes.match=false 212건 중 131건이 comparable과 displayed가 집합으로 동일했다 (순서만 다름 123 + 둘 다 빈값 8). 워커가 순서·원문 기준으로 PARSER_MISS 등으로 오분류.
- 조치: `audit/tools/recompute-tastingnotes.py`로 454건 전부 §6.1(집합 비교, 순서 무시) 재계산. OCR_CONFLICT·UNKNOWN은 유지.
- 결과: match=True 136→258건. 배치 summary mismatch/원인분포 재계산. 원인 집계: PARSER_MISS 113→35, NORMALIZATION_ERROR 64→29.
- 사각지대(§6.2)는 별도: 정규화기가 버린 실제 노트 손실 236건(dictionary-miss 228 + overlap-removed 8), 144개 상품 — golden-vs-app 불일치가 아니라 정규화기 자체 손실.

## 3. 판정 품질

### 배치별 A/B 불일치율 (status 제외)

| 배치 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| 불일치율 | 9.5% | 28.6% | 16.5% | 8.5% | 23.7% | 8.9% | 11.8% | 14.2% | 32.9% | 6.2% |
| 배치 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | |
| 불일치율 | 10.6% | 8.0% | 10.0% | 14.2% | 17.5% | 15.4% | 21.5% | 6.7% | 0% | |

- Quality Auditor 되돌림: 34건 · Coffee Domain Reviewer 수정: 13건
- b17 불일치 31건 중 17건은 값 동일·confidence만 다름 (실질 불일치 아님, Judge가 A 채택)

### Reviewer B 독립성 붕괴 및 재판정 (b11~15)

동일 워커가 A/B를 연속 작성한 사실이 발각됨 (evidence 동일률 53~99%, golden 바이트동일 다수). 배치별 별도 새 워커로 재판정 → 불일치율 8.0~17.5%, evidence 동일 0~12%, golden 바이트동일 0건. INTERIM-3의 "A 앵커링 경고 후 개선" 서술은 철회됨 (오염된 비교의 산물).

### 자동 검사 5종

1. evidence 완전동일 30% 초과 시 FAIL
2. golden 바이트동일 1건+ 시 FAIL
3. (기타 무결성)
4. 독립성 — 유사 문구(difflib ≥ 0.8) 50% 초과 시 FAIL (오염 버전 70~99% vs 정상 13~40% 실측으로 기준 확정)
5. status 데이터 기반 — golden status.value ≠ current-values.json isSoldOut 시 FAIL (정적 문구 매칭에서 교체, `isSoldOut=False` 변형도 검출 검증)

## 4. 감사 중 추가된 규칙 (`regression-rules.md`)

- **§5.1 미매핑 라벨**: enum 미매핑 원문 라벨(Well-done·French 등 6건)은 raw=원문 보존, value=null, confidence=HIGH, mappingStatus=UNMAPPED_LABEL
- **§9.1 OCR 교차 반복 블록**: 5개 반복 블록(Jasmine/Peach/Honey/Black Tea 등)은 corroboration 근거 인용 금지 — 3건 정정
- **§9.2 status 템플릿 라벨**: 구매 버튼 영역의 "SOLD OUT" 라벨은 status 근거 금지 → isSoldOut 플래그 기준 MEDIUM/collector_flag — **11건 정정** (b2·b6)
- **§6.1/6.2**: 테이스팅 노트 번역·정규화 인식 비교, 정규화기 사각지대 기록

## 5. 최소 변경으로 가장 많이 개선할 지점 (재계산 수치 기준)

| 순위 | 조치 | 개선 상품 수 | 변경 크기 |
|---|---|---|---|
| 1 | 테이스팅 노트 정규화 사전 alias 추가 (dictionary-miss 228건) | 144개 상품 | 사전 데이터 추가만 (코드 변경 없음) |
| 2 | 근거 없는 farm 행 표시 억제 (producer 거짓양성) | 95건 | 표시 조건 1줄 수준 |
| 3 | roastLevel 파서·매핑 개선 ("확인 필요" 64건 중 golden 값 있음) | 64건 (UNMAPPED_LABEL 6건 포함) | 파서 개선 |
| 4 | variety 파서 누락 보완 (Missing 42건) | 42건 | 파서 개선 |
| 5 | process 오분류 수정 (Wrong 31건) | 31건 | 파서 개선 |

1위는 코드 변경 없이 정규화 사전에 alias를 추가하는 것만으로 144개 상품의 실제 노트 손실이 복구된다.

## 6. 한계 및 주의

1. **status golden은 BeanPick status 정확도 검증에 쓸 수 없다.** 템플릿 라벨로 품절을 구분할 수 없어 golden이 수집 플래그와 같아진다 (INTERIM-5).
2. producer 재현율 54.1%·정확도 41.6%는 golden 판정 난이도(에스테이트명·상품명과 생산자 구분)가 높기 때문. QA 되돌림 9건(b16)이 대표 사례.
3. roast 재현율 6.8% — 파서 미구현 영역이 그대로 golden UNKNOWN으로 남음 (NOT_IMPLEMENTED 101건).
4. C등급(증거 없음) 641필드는 판정 자체가 불가 — 앱 표시값과 비교할 근거가 없음.
5. 회귀 도구(`audit-data.mjs`)의 live-data 수치는 감사 시점(current-values.json)과 다를 수 있다 — 수집 후 데이터가 바뀌었기 때문 (docs/products.json 461건 중 golden 커버 433건).

## 7. 산출물

- `audit/golden/batch-001.json` ~ `batch-019.json` (최종 golden)
- `audit/golden-products.json` (19개 배치 통합본, 454건)
- `audit/golden/current-values.json`, `batches.json`
- `audit/PHASE-1-PROTOCOL.md`, `audit/regression-rules.md`
- `audit/PHASE-1-INTERIM-1.md` ~ `INTERIM-5.md` (중간 보고)
- `audit/tools/quality-auditor-checks.py`, `audit/tools/compute-comparable.mjs`, `audit/tools/recompute-tastingnotes.py`
- `audit/tools/audit-data.mjs` (+ package.json `audit:data` 스크립트) — 회귀 감사 도구
- `audit/regression-report.md` — docs/products.json 현재 상태 스냅샷
- `audit/roastery-quality-report.md` — 로스터리별 × 필드별 재현율·거짓양성
- `audit/golden/_work/` (배치별 중간 산출물)

## 8. 원래 지시문 §40의 12개 질문 — 답변 (산출: `audit/tools/answer-12q.py`)

| # | 질문 | 답변 |
|---|---|---|
| 1 | 454건 중 실제 데이터 오류(CASE 1) 건수 | **557건** (match=False 중 golden 독립근거 있음: PARSER_MISS 169, FALSE_POSITIVE 220, NORMALIZATION_ERROR 31, FIELD_MAPPING_ERROR 23, NOT_IMPLEMENTED 102 — 필드 단위 집계) |
| 2 | 원문에 정보 없음(CASE 2) 건수 | **606필드** (golden SOURCE_MISSING) |
| 3 | Parser 때문에 놓친 건수 | **169건** (failureReason PARSER_MISS) |
| 4 | OCR 때문에 놓친 건수 | **16건** (OCR_CONFLICT, 전부 판정불가 — 동일 이미지 OCR 정면충돌) |
| 5 | 로스터리 전용 처리가 필요한 건수 | **152건** (NOT_IMPLEMENTED — 스마트스토어 등 수집 단계 고정값, 채널별 전용 파서 필요) |
| 6 | 판정 불가(접근 실패·증거 없음) 건수 | **641필드** (match=None EVIDENCE_UNAVAILABLE) |
| 7 | origin 정확도 | 정확도 **86.6%** (305/352), 재현율 **90.1%** (247/274) |
| 8 | process 정확도 | 정확도 **67.1%** (235/350), 재현율 **80.2%** (190/237) |
| 9 | roast 정확도 | 정확도 **58.5%** (190/325), 재현율 **6.8%** (5/73) |
| 10 | tasting note coverage | 정확도 **78.2%** (258/330), 재현율 **53.2%** (50/94) |
| 11 | 문제를 가장 많이 만드는 로스터리 | **나무사이로 102건** (match=False + FP; 다음 카페도안 96, 루비아 커피 74, 에어리커피 66) |
| 12 | 최소 코드 변경으로 가장 많이 개선할 지점 | **정규화 사전 alias 추가 — 소규모 코드 변경** (`src/services/tastingNotes.js`·`.cjs` 사전에 실제 맛 노트 alias 추가, dictionary-miss 228건 → **144개 상품** 개선) |

- 7~10의 정확도·재현율 산출: `audit/tools/regen-reports.py`
- 12번: "코드 변경 없음"이 아니라 `tastingNotes.js`·`.cjs` 수정이 필요하므로 "소규모 코드 변경"으로 표기. 서술형·질감어('쥬시한', '가득' 등)는 alias 추가 금지.
