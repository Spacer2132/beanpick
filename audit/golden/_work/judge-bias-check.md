# Judge 편향 점검

- 작성: 2026-09-25
- 대상: batch-001~010의 Judge 판정 기록 (`_work/*judge*.json`, `batch-00*-judge.json`, batch 파일 내 `review.judge`)
- golden 수정 없음 (분석+보고)

## 배치별 Judge 채택 집계 (불일치 필드 기준, status 제외)

| 배치 | 불일치 필드 | A 채택 | B 채택 | 제3값 | 기타 | 출처 |
|---|---|---|---|---|---|---|
| 1 | 16 | 6 | 6 | 1 | MISSING 2 / UNKNOWN 1 | batch-001.json review.judge.fields |
| 2 | 50 | 29 | 13 | 3 | UNKNOWN 5 | judge note (A:29/B:13/THIRD:3/NONE:0/UNKNOWN:5) |
| 3 | 31 | 12 | 17 | 2 | — | batch-003-judge.json |
| 4 | 15 | 2 | 3 | — | NONE 8 / UNKNOWN 2 | batch-004.json review.judge.fields |
| 5 | 38 | 12 | 23 | 1 | unknown 2 | _work/batch5-judge.json |
| 6 | 15 | 기록 미보존 | — | — | — | batch-006-judge.json이 빈 배열, review.judge.fields도 비어 있음 |
| 7 | 29 | 11 | 12 | — | AGREE 6 (재독 후 합의) | batch-007-judge.json |
| 8 | 25 | 5 | 17 | 2 | MISSING 1 | batch-008-judge.json |
| 9 | 50 | 2 | 46 | — | SOURCE_MISSING 2 | _work/batch-009-judge.json |
| 10 | 9 | 7 | 2 | — | — | _work/batch-010-judge.json |
| **합계 (b6 제외)** | **263** | **86** | **139** | **9** | **29** | — |

B 채택이 A의 약 **1.6배** (139/86). 겉보기엔 B 편향이지만 배치별 편차가 크다 (b2·b10은 A 우세).

## b9 집중 분석 (B 46/50)

### ① "A의 confidence 상향" 가설은 데이터와 반대

중간 보고(PHASE-1-INTERIM-2.md)는 "30건이 confidence-only 차이였고, current를 본 A가 confidence를 높게 잡는 경향"이라고 기록했다. **독립 재분석 결과는 정반대다:**

- b9 불일치 153건 중 value 불일치 20건, **confidence-only 30건**, 합의 103건
- confidence-only 30건 **전부 B(블라인드)가 A보다 높게** 잡음 (예: productType — A: MEDIUM / B: HIGH)
- 즉, current를 본 A는 오히려 **더 보수적**(MEDIUM)이었고, 블라인드 B가 HIGH를 줬다

**정정**: b9에서 A의 confidence 상향 경향은 없었다. 반대로 current를 본 A가 displayed 값과의 괴리를 보고 확신을 낮춘 것으로 보인다.

### ② B 채택 46건의 실제 사유

Judge note 전수 확인 — B 채택은 단순 confidence가 아니라 **실질 오판 정정**이 다수:

- cafedoan-13627475142 originRegion: A가 농장명('핀카 엘 푸엔테')을 지역으로 오분류 → B 채택
- cafedoan-13627475142 producer: A가 로스터 브랜드('Tim Wendelboe')를 생산자로 오인 → B 채택
- tastingNotes OCR 충돌: A가 "출력1은 배치 내 반복 등장이라 오염"이라는 그럴듯한 논리로 제외 시도 → Judge는 지시된 규칙(CASE 3/UNKNOWN) 적용해 B 채택

b9의 B 편향은 "Judge가 B를 편애"한 게 아니라 **b9에서 B가 실제로 더 정확했고, A는 current 노출로 인한 오판(농장→지역, 브랜드→생산자, 자의적 OCR 제외)이 많았다**는 해석이 데이터에 부합한다.

## 배치별 편향 양상

- **b2 (A 29 / B 13)**: A 우세. b2는 한/영 표기·구분자 차이가 많아 current를 본 A의 정규화 판단이 유효했던 배치.
- **b5 (A 12 / B 23), b8 (A 5 / B 17)**: B 우세. b5는 블렌드 성분 승격·농장 행 FALSE_POSITIVE 등 A의 current-앵커링 오판이 많은 배치였고, b8도 농장 라벨 무비판 수용(fritz-1202) 등 유사.
- **b10 (A 7 / B 2)**: A 우세. 불일치 자체가 9건으로 적음.
- **b1·b3·b4·b7**: 대체로 균형 (A≈B).

패턴: **current에 오류가 많은 배치(b5·b8·b9)에서는 B(블라인드)가 우세하고, 표기 차이 위주 배치(b2)에서는 A가 우세** — Judge가 일관되게 어느 쪽을 편애한 게 아니라 배치의 오류 성격에 따라 갈렸다.

## QA의 Judge 견제 작동 여부

- b7 fillout-8259237237: Judge가 B 채택(Dark LOW, 상품명 '다크' 근거) → QA가 "라인명이지 로스팅이 아님"이라며 SOURCE_MISSING으로 뒤집음. **Judge 판결도 QA 검토 대상임이 확인됨.**
- b9 tastingNotes OCR 충돌: Judge가 규칙(CASE 3)을 명시적으로 적용 — Judge가 자의적 판단을 하지 않고 프로토콜을 따름.

## 결론

1. **Judge의 구조적 B 편향은 없다.** 전체 86:139는 b9(46건) 하나의 배치 효과가 크고, 배치별로는 오류 성격에 따라 A/B가 갈린다.
2. **중간 보고서의 "A confidence 상향" 서술은 정정 필요** — b9 재분석 결과 confidence-only 30건 전부 B가 더 높았다. A는 current 노출로 오히려 보수적이었다.
3. **b6의 Judge 기록이 미보존** (judge 파일 빈 배열) — 배치 11 이후부터는 Judge 판정 기록을 파일에 남기는 것을 프로토콜에 명시할 것 (recommended-fixes 후보).
4. 블라인드 B의 역할(앵커링 제거)은 b5·b8·b9에서 유효하게 작동했다 — 프로토콜 유지 권장.
