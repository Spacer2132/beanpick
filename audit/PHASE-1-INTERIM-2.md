# Phase 1 중간 보고서 2 — 배치 6~10 (250/454건 누적)

- 작성: 2026-09-25
- 산출물: `audit/golden/batch-006.json` ~ `batch-010.json` (프로토콜 rev1 적용)
- rev1 변경: NOT_DISPLAYED(originRegion/type), SOURCE_MISSING 분리, roast 5단계 enum, status collector_flag/MEDIUM·정확도 제외, OCR_CONFLICT, golden raw+normalized (`audit/regression-rules.md`)

## 집계 (배치 6~10, 125건)

| 지표 | 값 |
|---|---|
| 총 / C등급 기계처리 / A·B 리뷰 | 125 / 26 (20.8%) / 99 |
| A≠B 불일치율 (필드, status 제외) | **14.8%** (117/792) |
| Judge 판정 | A 38 / B 79 / 제3값 2 / 기타 4 |
| UNKNOWN (증거 부족) | **20.6%** (232/1125) |
| SOURCE_MISSING (원문 확인·정보 없음) | **31.6%** (355/1125) |
| Quality Auditor 되돌림 | **10건** |
| Coffee Domain Reviewer 수정 | **3건** |

## 배치별

| 배치 | C | 리뷰 | 불일치율 | UNKNOWN | SOURCE_MISSING | QA | 도메인 |
|---|---|---|---|---|---|---|---|
| 6 | 4 | 21 | 8.9% (15/168) | 17.8% | 29.8% | 0 | 0 |
| 7 | 6 | 19 | 11.8% (18/152) | 22.2% | 35.6% | 2 | 0 |
| 8 | 3 | 22 | 14.2% (25/176) | 12.5% | 36.0% | 6 | 2 |
| 9 | 6 | 19 | 32.9% (50/152) | 23.6% | 33.3% | 0 | 0 |
| 10 | 7 | 18 | 6.3% (9/144) | 32.9% | 27.1% | 2 | 1 |

## 주목할 패턴

1. **Judge의 B 편향 (batch9)**: 불일치 50건 중 B(블라인드) 채택 46건. 30건이 confidence-only 차이였고, current를 본 A가 confidence를 높게 잡는 경향이 있었음. 전체 누적으론 균형이지만 배치별 편차가 있어 주시 필요.
2. **OCR_CONFLICT 10건** (b6:1, b7:2, b9:5, b10:2): 동일 이미지의 해상도 변형(f80_80/f750_750) OCR이 정면 충돌하는 사례 확인. 오용 사례도 있음 — b8 히떼로스터리-굿데이다크는 동일 이미지 내 충돌이 아니라 판매자 본문과 OCR의 불일치라 Judge가 본문 우선으로 정정.
3. **OCR 파이프라인 오염 의심** (b9): 'Peach/Jasmine/Earl Grey/Honey' 노트 세트가 4개 상품의 OCR에 동일하게 반복 등장. QA 전수 대조로 golden 미유입은 확인.
4. **roast NOT_IMPLEMENTED 4건** (b10): 루비아커피 아바야게이샤·워터멜론(상품명 '라이트 로스트' 명시인데 표시 '확인 필요'), namusairo-1134/1127(detailText에 Medium 명시인데 '확인 필요') — 수집이 detailText를 읽지 않는 구조적 문제.
5. **QA가 Judge를 뒤집음** (b7 fillout-8259237237): Judge가 B 채택(Dark LOW, 상품명 '다크' 근거) → QA가 "'다크'는 라인명(필디카프 다크)이지 로스팅 단계가 아니라"며 SOURCE_MISSING으로 되돌림. Judge 판결도 QA 검토 대상임이 확인됨.
6. **블렌드 성분 승격 재발 시도** (b7 말릭커피-프루티블렌드): B가 구성 성분 표기만으로 originCountry/process HIGH → Judge가 A 채택(SOURCE_MISSING). b5 교훈이 Judge 선례로 정착.
7. **농장 라벨 무비판 수용** (b8 fritz-1202): 원문 "품종 Variety: 산 로케"를 그대로 품종 HIGH → 도메인 리뷰가 '산 로케'는 로트명으로 판단해 null/SOURCE_MISSING 수정.

## 사람 검증 대기

`audit/human-check.md` (A/B등급 10건 무작위 샘플, seed=20260930) — 검증 결과가 나올 때까지 배치 11 이후는 정지.

## 누적 (배치 1~10): 250/454건 (55.1%)
