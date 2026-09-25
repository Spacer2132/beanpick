# BeanPick Phase 1 결과 정리 — 배치 1~5 (125/454건)

- 작성: 2026-09-25
- 판정 파일: `audit/golden/batch-001.json` ~ `batch-005.json` (디스크 검증 완료)
- 프로토콜: `audit/PHASE-1-PROTOCOL.md`, 공통 입력: `audit/golden/current-values.json`(앱 실제 함수 실행값), `audit/golden/batches.json`

## 판정 방식

C등급 19건(증거 없음)은 기계 처리로 `EVIDENCE_UNAVAILABLE`/UNKNOWN 확정.
A/B등급 106건은 Reviewer A(current 공개)와 Reviewer B(current 블라인드·다른 순서)가 독립 판정 → 불일치 필드는 Judge가 원문 재독 후 판정 → Quality Auditor(증거 없는 HIGH·혼동·AI 환각 체크) → Coffee Domain Reviewer(커피 도메인 상식 검증) 순으로 처리.
diff는 사용자에게 보이는 displayed 값을 기준으로 계산.

## 전체 집계

| 지표 | 값 |
|---|---|
| 총 / C등급 기계처리 / A·B 리뷰 | 125 / 19 (15.2%) / 106 |
| A≠B 불일치율 (필드 기준) | **15.7%** (150/954 필드) |
| A≠B 불일치 (상품 기준) | 배치별 59~85%가 1개 이상 필드 불일치 |
| Judge 판정 | A 채택 62 / B 채택 62 / 제3값 7 / missing 9 / UNKNOWN 10 |
| UNKNOWN 필드 비율 | **51.3%** (577/1125) — 리뷰 대상만 43.7% |
| Quality Auditor 되돌림 | **4건** |
| Coffee Domain Reviewer 수정 | **9건** |

Judge의 A/B 채택이 62:62로 정확히 반반 — current를 본 A가 끌려가지도, 블라인드 B가 불리하지도 않아 독립성 설계가 의도대로 작동.

## 배치별 결과

| 배치 | C | 리뷰 | 불일치율(필드) | UNKNOWN | QA | 도메인 |
|---|---|---|---|---|---|---|
| 1 | 4 | 21 | 8.5% (16/189) | 56.0% | 0 | 2 |
| 2 | 4 | 21 | 26.5% (50/189) | 52.0% | 1 | 1 |
| 3 | 3 | 22 | 15.7% (31/198) | 52.4% | 0 | 3 |
| 4 | 3 | 22 | 7.6% (15/198) | 48.9% | 0 | 0 |
| 5 | 5 | 20 | 21.1% (38/180) | 47.1% | 3 | 3 |

b2·b5의 불일치율이 높은 것은 절반 이상이 한/영 표기·구분자 차이("구지 샤키소" vs "구지, 샤키소") — 정규화 규칙 강화가 필요.

## 대표 오판 사례

1. **블렌드 구성 성분 승격** (deepbluelake-146, batch5, QA 되돌림)
   OCR 속 구성 성분 표기의 "에티오피아" 하나만으로 originCountry를 LOW 확정. A/B 양쪽이 반복한 패턴 → QA가 null/UNKNOWN으로 되돌림. 구성 성분 표기 ≠ 단품 산지.

2. **originRegion에 엉뚱한 값 혼입** (fritz-2177, batch5, FIELD_MAPPING_ERROR)
   BeanPick displayed의 originRegion에 상품명("Corazon de Jesus Java Experimental")이 그대로 들어감. 원문에 지역 정보가 없는데 값을 만듦. batch5에서만 FALSE_POSITIVE 9건이 전부 originRegion/originCountry에서 발생.

3. **수식어의 컵노트 혼입** (namusairo-1135, batch2, QA 수정)
   원문 "꽃향기 가득"의 강도 수식어 "가득"을 컵노트로 포함 → "꽃향기"로 수정. '쥬시한'·'깔끔한'·'Clean' 같은 질감·속성 서술을 노트로 오분류하는 패턴이 3개 배치에서 반복 → 도메인 규칙으로 고정.

4. **OCR 충돌** (아이덴티티커피랩-칠린블렌드, batch3, CASE 3)
   동일 이미지 OCR 2건이 정면 충돌(Jasmine/Peach/Honey/Black Tea vs Nuts/Caramel/Macadamia/Toast). 원문 이미지 없이는 해결 불가.

5. **로스팅 표기 추정** (coffee502-13/182, batch4, Judge 확정)
   "중강배전"/"중약배전"을 Reviewer A가 Dark/Medium으로 매핑했으나 Judge가 Light/Medium/Dark enum 매핑 불가로 UNKNOWN 확정. 원문에 없으면 추정 금지.

6. **producer 남발** (batch4, 5건)
   A가 "로스 코네조스"·"카라모 마테 마티오스" 등 이름만 보고 생산자로 기록 → Judge가 전부 UNKNOWN으로 되돌림. 이름만으로 가공소/지역/농장 구분 불가.

## diff 불일치 패턴 (displayed 기준, Golden vs 현재 표시값)

| 분류 | 내용 | 대표 사례 |
|---|---|---|
| FALSE_POSITIVE | 원문에 없는 값을 표시 | fritz-2177 등 region에 상품명 잔여 텍스트 |
| FIELD_MAPPING_ERROR | 엉뚱한 필드에 엉뚱한 값 | region에 생산자명("마리엘라 무뇨즈"), 표시 region에 농장명 혼입 |
| PARSER_MISS | 원문에 있는데 표시 안 됨 | tastingNotes 누락 (batch1 불일치 19건 중 11건) |
| NORMALIZATION_ERROR | 같은 값을 다르게 표기 | "잘 익은 사과"→"사과", 한/영 노트 표기 |
| NOT_IMPLEMENTED | 수집이 해당 필드를 안 읽음 | 스마트스토어 origin/process/roastLevel 고정값, 히떼로스터리-리볼브의 detailText 미독 |

P0/P1 후보:
- originRegion FALSE_POSITIVE + FIELD_MAPPING_ERROR — 원문에 없는 값을 만드는 고질적 파서 문제
- 히떼로스터리-리볼브: detailText에 블렌드/브라질·페루/미디움이 전부 명시돼 있는데 수집이 detailText를 읽지 않음

## 사용자 결정 대기 (다음 배치 전에 필요)

1. **status 판정 기준**: 수집기 `isSoldOut` 플래그를 Golden 근거로 쓸 것인가? b2 Judge는 "원문 텍스트에 품절 언급 없음 → UNKNOWN", b3는 DOM의 'SOLD OUT'이 구매 버튼 라벨임을 확인하고 active 판정. 제안: 수집 플래그를 1차 근거로 쓰되 원문에 반대 증거가 있으면 원문 우선.
2. **OCR 충돌 원칙**: 원본 이미지 없는 상충 OCR → CASE 3/UNKNOWN으로 확정.
3. **미매핑 라벨**: '중강배전'/'중약배전' 등 enum 매핑 불가 표기 → UNKNOWN 처리.

## 다음 단계

- 위 3건 결정 후 배치 6~19 (329건) 진행
- 정규화 규칙 강화(한/영 표기·구분자) 적용으로 Judge 부담 감소
