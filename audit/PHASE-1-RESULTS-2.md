# BeanPick Phase 1 결과 정리 — 배치 1~10 (250/454건, 55.1%)

- 작성: 2026-09-25
- 판정 파일: `audit/golden/batch-001.json` ~ `batch-010.json` (디스크 검증 완료)
- 프로토콜: `audit/PHASE-1-PROTOCOL.md` (rev1), 회귀 비교 규칙: `audit/regression-rules.md`
- 공통 입력: `audit/golden/current-values.json` (앱 실제 함수 실행값), `audit/golden/batches.json`

## 판정 방식

C등급(증거 없음)은 기계 처리로 `EVIDENCE_UNAVAILABLE`/UNKNOWN 확정.
A/B등급은 Reviewer A(current 공개)와 Reviewer B(current 블라인드·다른 순서)가 독립 판정 → 불일치는 Judge가 원문 재독 후 판정 → Quality Auditor(증거 없는 HIGH·혼동·AI 환각 체크) → Coffee Domain Reviewer 순으로 처리.
diff는 사용자에게 보이는 displayed 값을 기준으로 계산.

### rev1 스키마 개정 (배치 6 진행 전 적용, 배치 1~5 소급)

- **NOT_DISPLAYED**: 앱에 '지역' 표시가 없어 displayed originRegion·type → `NOT_DISPLAYED`, diff 125건 `NOT_DISPLAYED_FIELD`로 재분류. '농장' 행의 farm 이상 표시 39건은 producer diff로 이동 (FALSE_POSITIVE 30 / FIELD_MAPPING_ERROR 9)
- **UNKNOWN 분리**: 증거 부족 UNKNOWN vs 원문 확인·정보 없음 SOURCE_MISSING
- **roast 5단계 enum**: Light / Medium-Light / Medium / Medium-Dark / Dark, raw 라벨 보존 (중강배전=Medium-Dark 등 8건 수정, HIGH)
- **status**: `collector_flag`/MEDIUM, 원문 반대 증거 시 원문 우선, 정확도 통계 제외
- **OCR_CONFLICT**: 동일 이미지 OCR 정면 충돌 → CASE 3/UNKNOWN 별도 기록
- **golden raw+normalized 병기**

## 전체 집계

| 지표 | 값 |
|---|---|
| 총 / C등급 기계처리 / A·B 리뷰 | 250 / 45 (18%) / 205 |
| A≠B 불일치율 (필드, status 제외) | **16.0%** (263/1640) |
| Judge 판정 (누적) | A 100 / B 141 / 제3값 9 / 기타 13 |
| UNKNOWN (증거 부족) | **20.6%** (464/2250) |
| SOURCE_MISSING (원문 확인·정보 없음) | **30.2%** (679/2250) |
| Quality Auditor 되돌림 | **14건** |
| Coffee Domain Reviewer 수정 | **12건** |

## 배치별 결과

| 배치 | C | 리뷰 | 불일치율 | UNKNOWN | SOURCE_MISSING | QA | 도메인 |
|---|---|---|---|---|---|---|---|
| 1 | 4 | 21 | 9.5% | — | — | 0 | 2 |
| 2 | 4 | 21 | 28.6% | — | — | 1 | 1 |
| 3 | 3 | 22 | 16.5% | — | — | 0 | 3 |
| 4 | 3 | 22 | 8.5% | — | — | 0 | 0 |
| 5 | 5 | 20 | 23.8% | — | — | 3 | 3 |
| 1~5 소계(rev1) | 19 | 106 | 17.2% (146/848) | 20.6% | 28.8% | 4 | 9 |
| 6 | 4 | 21 | 8.9% (15/168) | 17.8% | 29.8% | 0 | 0 |
| 7 | 6 | 19 | 11.8% (18/152) | 22.2% | 35.6% | 2 | 0 |
| 8 | 3 | 22 | 14.2% (25/176) | 12.5% | 36.0% | 6 | 2 |
| 9 | 6 | 19 | 32.9% (50/152) | 23.6% | 33.3% | 0 | 0 |
| 10 | 7 | 18 | 6.3% (9/144) | 32.9% | 27.1% | 2 | 1 |

b2·b5·b9의 불일치율이 높은 것은 한/영 표기·구분자 차이와 블렌드/세트 상품 비중 때문 — regression-rules로 정규화 규칙을 문서화해 Judge 부담을 줄였다.

## 대표 오판 사례

1. **블렌드 구성 성분 승격** (deepbluelake-146, b5, QA 되돌림): OCR 속 구성 성분 표기의 "에티오피아" 하나만으로 originCountry LOW 확정 → null/UNKNOWN. b7에서 재발 시도(말릭커피-프루티블렌드)됐으나 Judge 선례로 기각.
2. **'농장' 행에 엉뚱한 값 표시** (fritz-2177 등, producer FALSE_POSITIVE 30건): `inferFarmName`이 상품명 찌꺼기를 농장으로 표시. 원산지 지역 표시가 아니라 생산자 필드 문제로 재분류.
3. **수식어의 컵노트 혼입** (namusairo-1135 "꽃향기 가득"→"가득", b2 QA 수정): '쥬시한'·'깔끔한'·'Clean' 같은 질감 서술을 노트로 오분류하는 패턴이 반복 → 도메인 규칙으로 고정.
4. **OCR 충돌** (칠린블렌드 b3, 로스터릭 2건 b10): 동일 이미지의 해상도 변형 OCR이 정면 충돌 → CASE 3/UNKNOWN + OCR_CONFLICT. 단, 동일 이미지 내 충돌이 아닌 판매자 본문 vs OCR 불일치는 본문 우선 (b8 히떼로스터리-굿데이다크 오용 사례 정정).
5. **로스팅 표기 추정 금지** (coffee502-13/182 "중강배전"): rev1에서 Medium-Dark HIGH로 확정. raw 라벨 항상 보존.
6. **라인명을 로스팅으로 오판** (fillout-8259237237, b7): Judge가 상품명 '다크'를 근거로 Dark LOW 채택 → QA가 "'다크'는 라인명(필디카프 다크)"이라며 SOURCE_MISSING으로 되돌림. Judge 판결도 QA 검토 대상.
7. **농장 라벨 무비판 수용** (fritz-1202, b8): 원문 "품종 Variety: 산 로케"를 품종 HIGH → 도메인 리뷰가 로트명으로 판단해 수정.

## diff 불일치 패턴 (displayed 기준)

| 분류 | 내용 | 규모 |
|---|---|---|
| FALSE_POSITIVE | 원문에 없는 값을 표시 (주로 '농장' 행 상품명 찌꺼기) | producer 30건+ |
| FIELD_MAPPING_ERROR | 엉뚱한 필드에 엉뚱한 값 (region→농장 오배치 등) | producer 9건 |
| PARSER_MISS | 원문에 있는데 표시 안 됨 (tastingNotes 누락이 최대) | b9에서 15건 |
| NORMALIZATION_ERROR | 같은 값을 다르게 표기 (한/영, 구분자) | 회귀 규칙으로 처리 |
| NOT_IMPLEMENTED | 수집이 해당 정보를 안 읽음 (스마트스토어 고정값, detailText 미독) | roast 4건(b10) 등 |
| NOT_DISPLAYED_FIELD | 앱에 표시 자체가 없음 (originRegion, type) | 125건+α |
| OCR_CONFLICT | 동일 이미지 OCR 정면 충돌 | 10건+ |
| EVIDENCE_UNAVAILABLE | 증거 없음 (C등급 등) | — |

## P0/P1 후보

- **'농장' 행 FALSE_POSITIVE**: `inferFarmName`이 상품명 잔여 텍스트를 농장으로 표시 — 원문에 없는 값을 만드는 고질적 문제 (30건)
- **roast '확인 필요'**: 상품명·detailText에 로스팅 명시돼 있는데 수집이 detailText를 읽지 않음 (b10에서 4건)
- **스마트스토어 수집 고정값**: origin=`로스터리명`, roastLevel='확인 필요' 고정 (Phase 0 확정, NOT_IMPLEMENTED)
- **OCR 파이프라인 오염 의심**: 'Peach/Jasmine/Earl Grey/Honey' 노트 세트가 4개 상품 OCR에 동일 반복 등장 (b9)

## 방법론 관찰

- Judge A/B 채택이 배치 1~8에선 균형이었으나 **b9에서 B(블라인드) 46/50 편향** — current를 본 A가 confidence를 높게 잡는 경향. 주시 필요.
- SOURCE_MISSING 분리 효과: b7은 리뷰 대상 UNKNOWN이 1.2%에 불과, 나머지는 "원문 확인·정보 없음"으로 분리됨.

## 사람 검증 대기

`audit/human-check.md` — A/B등급 10건 무작위 샘플 (seed=20260930). 검증 결과가 나올 때까지 배치 11 이후 정지.

## 다음 단계

1. 사람 검증 결과 수령 → golden 신뢰도 확정
2. 배치 11~19 (204건) 진행
3. 최종 집계 → failure taxonomy 리포트 → 회귀 하네스
