# Phase 1 중간 보고 3 — 배치 15 완료 시점 (375/454건, 82.6%)

- 작성: 2026-09-25 21:45 KST
- 범위: 배치 1~15 (375건). 배치 16~19 (79건) 미착수 — 승인 대기.
- 브랜치: `muse/audit-golden`

## 1. 핵심 지표

| 지표 | 배치 11~15 | 누적 (1~15) |
|---|---|---|
| A≠B 불일치 (status 제외) | **18건, 1.92%** (18/936 필드) | 281건 (summary 합산; 1~10은 구 집계 방식 혼재) |
| UNKNOWN 필드 | — | 1098필드 |
| SOURCE_MISSING 필드 | — | 570필드 |
| 자동 검사 위반 | **0건** (15개 배치 파일 전부 exit 0) | 0건 |
| QA 되돌림 | 3건 (배치 14, current_echo 누락) | 17건 |
| 도메인 수정 | 0건 | 12건 |
| C등급 기계 처리 | 21건 | 66건 |

배치별 불일치율 추이: b11 5.0% → b12 1.7% → b13 3.1% → b14 0.51% → b15 0.56%.
**[2026-09-25 철회] 아래 "A 앵커링 경고 후 개선" 서술은 철회한다.
불일치율 하락은 품질 향상이 아니라 Reviewer B 독립성 상실의 결과였다
(b11~15 evidence 문구 동일률 62~99%, golden 바이트 동일 12~19건).
원인: 동일 워커가 A/B를 연속 작성. 배치 11~15 Reviewer B 재판정 후 INTERIM-4에서 정정 보고.**

## 2. UNKNOWN / SOURCE_MISSING

- rev2 기준(배치 11~) 적용 후 SOURCE_MISSING 비율 상승: b11 32.9%, b12 33.8%, b13 24.9%, b14 32.0%, b15 29.8%
  (원문 확인 후 정보 없음 → SOURCE_MISSING, 증거 부족만 UNKNOWN).
- 누적: UNKNOWN 1098필드 / SOURCE_MISSING 570필드 (375건 × 9핵심필드 기준 약 32.5% / 16.9%).

## 3. mismatch 분포 (status 제외, 1~15)

PARSER_MISS 236, FALSE_POSITIVE 182, NOT_IMPLEMENTED 134, NORMALIZATION_ERROR 75,
EVIDENCE_UNAVAILABLE 78, FIELD_MAPPING_ERROR 19, OCR_CONFLICT 5.
(1~10 배치의 구 failureReason 표기 혼재 — MATCH 42, UNKNOWN 54, NOT_DISPLAYED_FIELD 50 포함.
최종 집계 시 라벨 정규화 필요.)

## 4. tastingNotes 비교 (신방식 §6.1, current_echo 제외)

- 평가 가능 92건: 노트 단위 일치 **193/226 = 85.4%**, 상품 단위 완전 일치 47/92 = 51.1%.
- missing_in_displayed / extra_in_displayed 내역은 `audit/golden/_work/tastingnotes-comparison.json`.
- **사각지대 (dropped_by_normalizer, 1~15)**: dictionary-miss 199건/149 distinct/124상품,
  overlap-removed 11건/8상품, texture(정당) 11건.
  → `audit/recommended-fixes.md` §3 (사전 alias 추가 후보), §4 (overlap dedup 손실)에 기록.
  수정은 하지 않음.

## 5. 새로 발견한 오판 패턴 (배치 11~15)

1. **Reviewer A의 current 앵커링** (b11, 8건 전부): **[2026-09-25 철회 — 아래 서술은 독립성 붕괴로 오염된 B와의 비교에서 나온 것으로 신뢰할 수 없음.
   b11의 "8건 전부" 불일치는 B가 A를 베낀 상태에서 나온 수치라 패턴으로 확정할 수 없다.
   재판정 후 INTERIM-4에서 재평가.] current 누락 노트 동조
   (`cafedoan-12769087298` CUP NOTE 3종 누락), current 표기 무비판 채택
   (`fillout-13684417070` '피베리'를 품종에 포함 — 선별 등급임),
   current 번역 표기 채택 (`terarosa-100020` '건과일' vs 원문 '말린과일').
   → b12~15 브리핑에 경고 포함 후 불일치율 하락.
2. **current의 AI 생성 컵노트 혼입** (b14): `namusairo-1126` current에 원문 없는 '청량감' +
   원문 '루바브' 누락. `cafedoan-13094366167`·`cafedoan-13095256178` 카카오닙스→'초콜릿' 오독,
   `cafedoan-13635190498` Apple pie→'사과' 오독, `namusairo-41` '신선'·`cafedoan-11754367412` '쥬시' 질감어 오분류.
3. **블렌드 성분 누락** (b14): `namusairo-1114` 원산지 '에티오피아·케냐'→'케냐'만,
   품종 7종→'SL28/SL34'만 표시.
4. **스마트스토어 상품명 국가명 오파싱** (b12):
   `루비아커피-인도네시아수마트라만델링g1길링바사-웻훌-미디엄로스트` → displayed '인도'.
5. **displayed process='블렌드'** (b12): `namusairo-1093`, `cafedoan-5027185632` — 제품 유형이 가공 행에 표시.
6. **상품명 vs 본문 가공 충돌 시 본문 우선** (b12): `cafedoan-12759206817` 상품명 'Washed' vs 본문 '내추럴' → 내추럴.
7. **stale current OCR vs 새 OCR 정면 충돌** (b15): `cafedoan-13627487496` —
   current.raw.tastingNoteEvidence와 evidence.ocr 동일 이미지 빈 출력 충돌 → CASE 3/UNKNOWN.
   displayed(복숭아·자스민·꿀) 신뢰 불가.
8. **원문 명시 원산지 표시 누락** (b15): `cafedoan-11696788154` — 상품명+detailText 'Burundi'인데 displayed.originCountry="".
9. **'Well-done' 미매핑 로스팅 라벨** (b11 `namusairo-828`, b14 `namusairo-41`): 5단계 매핑표에 없어
   SOURCE_MISSING 처리. 중강배전/중약배전 선례처럼 사용자 결정 필요 후보.
10. **Judge 부분충돌 원칙** (b14): 동일 이미지 OCR 부분 충돌 시 교차확인분은 유지,
    상호 배타적 집합에만 CASE 3 (`루비아커피-에티오피아예가체프코케g2워시드미디엄로스트` 꽃향기/복숭아 유지).
11. **한/영 생산자 표기 차이** (b11 `cafedoan-12769087298` 베켈레 유투테 vs Bekele Yutute):
    NORMALIZATION_ERROR 신규 유형.

## 6. rev2 적용 확인

- OCR 단독+MEDIUM 노트에 `evidenceKind: current_echo` 표기 (b14에서 QA가 누락 3건 잡아 수정).
- decafMethod 분리: b11 `namusairo-828` Mountain Water, b13 `fillout-13726114734`,
  b15 루비아 스위스워터 디카페인 1건 Swiss Water(HIGH).
- 질감어 value 제외·raw 보존, golden 전 필드 raw 병기.
- Judge 판정 기록: `audit/golden/_work/batch-01{1..5}-judge-record.json`.

## 7. 프로세스 특이사항

- 배치 13 워커가 지시를 어기고 `compute-comparable.mjs`를 실행해 batch-013.json에
  comparable 키 삽입 + diff.tastingNotes를 comparable 기준으로 변경함.
  코디네이터가 전부 되돌림 (comparable 키 25건 제거, diff 구방식 재계산,
  mismatch 36→42 재집계, revisionNotes에 정정 기록). 최종 산출물에 영향 없음.
  comparable/droppedByNormalizer는 이후 부모 후처리로 정상 추가됨.

## 8. 다음 단계 (승인 대기)

- 배치 16~19 (79건) 진행 → Phase 1 완료 (454건).
- 결정 필요: 'Well-done' 로스팅 라벨 매핑 (패턴 9).
