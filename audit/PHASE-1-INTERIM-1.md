# Phase 1 중간 보고서 1 — 배치 1~5 (125건)

- 작성: 2026-09-25
- 산출물: `audit/golden/batch-001.json` ~ `batch-005.json` (디스크 검증 완료, 125건)
- C등급 19건은 기계 처리(EVIDENCE_UNAVAILABLE/UNKNOWN), A/B 독립 판정 106건

## 집계

| 지표 | 값 |
|---|---|
| 총 / C등급 기계처리 / A·B 리뷰 | 125 / 19 (15.2%) / 106 |
| A≠B 불일치율 (필드 기준) | **15.7%** (150/954 필드) |
| A≠B 불일치 (상품 기준) | 배치별 59~85% (1개 이상 필드 불일치) |
| Judge 판정 | A 채택 62 / B 채택 62 / 제3값 7 / missing 9 / UNKNOWN 10 |
| UNKNOWN 필드 비율 | **51.3%** (577/1125) — C등급 포함. 리뷰 대상만: 43.7% |
| Quality Auditor 되돌림 | **4건** |
| Coffee Domain Reviewer 수정 | **9건** |

배치별 불일치율: b1 8.5% / b2 26.5% / b3 15.7% / b4 7.6% / b5 21.1%.
b2·b5가 높은 것은 한/영 표기·구분자 차이("구지 샤키소" vs "구지, 샤키소")가 절반 이상 — 정규화 규칙 강화 필요.

**Judge A/B 채택이 62:62로 정확히 반반** — current를 본 A가 끌려가지도, 블라인드 B가 불리하지도 않음. 독립성 설계가 의도대로 작동.

## 대표 오판 3건

1. **블렌드 구성 성분 승격** (deepbluelake-146, QA 되돌림): OCR 구성 성분 표기의 "에티오피아" 하나만으로 originCountry를 LOW 확정. A/B 양쪽이 저지른 반복 패턴 → QA가 null/UNKNOWN으로 되돌림. 구성 성분 ≠ 단품 산지.
2. **region에 엉뚱한 값 혼입** (fritz-2177, FIELD_MAPPING_ERROR): BeanPick displayed의 originRegion에 상품명("Corazon de Jesus Java Experimental")이 그대로 들어감. 원문에 지역 정보가 없는데 값을 만듦 — batch5에서만 FALSE_POSITIVE 9건이 전부 originRegion/originCountry에서 발생.
3. **수식어의 노트 혼입** (namusairo-1135, QA 수정): 원문 "꽃향기 가득"의 강도 수식어 "가득"을 컵노트로 포함 → "꽃향기"로 수정. 'Clean'/'깔끔한'/'쥬시한' 같은 질감·속성 서술을 노트로 오분류하는 패턴이 3개 배치에서 반복 → 도메인 규칙으로 고정.

## 주목할 diff 패턴 (P0/P1 후보)

- **originRegion FALSE_POSITIVE**: 상품명 잔여 텍스트("E.A 디카페인", "블루마운틴 100%", "GENTLE 젠틀" 등)를 지역으로 표시 — 원문에 없는 값을 BeanPick이 만듦 (batch5에서 9건).
- **originRegion FIELD_MAPPING_ERROR**: 생산자명·상품명이 region에 혼입 3건 (batch5).
- **히떼로스터리-리볼브** (batch1): detailText에 블렌드/브라질·페루/미디움이 전부 명시돼 있는데 수집이 detailText를 읽지 않아 NOT_IMPLEMENTED 3건.
- tastingNotes가 최대 격전지: batch1의 displayed 불일치 19건 중 11건이 노트 누락(PARSER_MISS).

## 정책 결정 필요 (다음 배치 전)

1. **status 판정 기준**: 수집기 `isSoldOut` 플래그를 Golden 근거로 쓸 것인가? b2에서 Judge는 "원문 텍스트에 품절 언급 없음 → UNKNOWN", b3에서는 DOM 'SOLD OUT'이 구매 버튼 라벨임을 확인하고 active 판정. 제안: 수집 플래그를 1차 근거로 쓰되 원문에 반대 증거가 있으면 원문 우선.
2. **OCR 충돌 원칙**: 동일 이미지의 OCR 2건이 정면 충돌(칠린블렌드: Jasmine/Peach vs Nuts/Caramel) → 원문 이미지 없으면 CASE 3/UNKNOWN으로 확정 제안.
3. **로스팅 표기 매핑**: "중강배전"/"중약배전" → Light/Medium/Dark enum 매핑 불가 → UNKNOWN (Judge 선례 유지).
