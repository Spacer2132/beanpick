# PHASE-1 중간 보고 4 — 배치 11~15 Reviewer B 재판정 (2026-09-25 22:50 KST)

판정 완료: **375/454건 (82.6%)**. 배치 11~15의 Reviewer B 독립성 붕괴를 확인하고
전부 재판정했다. 배치 16~19는 미착수 (승인 대기).

## 1. 독립성 붕괴 — 원인 확정

사용자 검증(2026-09-25 22:16 KST) + 실측 확인:
- evidence 문구 동일률: b11 96% · b12 98% · b13 71% · b14 62% · b15 99%
- golden 바이트 동일: b11 12/20 · b12 19/22 · b15 19/20
- **원인**: 동일 워커가 A/B를 연속 작성. 증거 — b11·b14 A/B 파일 동일 초 기록,
  b12·b15는 B가 A보다 먼저 기록, `_work/write-013-*.py` 하드코딩 생성 스크립트.
  전 코디네이터가 "배치별 서브에이전트 분리" 프로토콜을 지키지 않은 것이 근본 원인.
- 결과: b12~b15의 불일치율 0.5~1.7%는 품질 향상이 아니라 독립성 상실의 산물.
  **INTERIM-3의 "A 앵커링 경고 후 개선" 서술은 철회** (INTERIM-3 본문에 철회 표기).
  b11의 "A 앵커링 8건" 패턴도 오염된 비교에서 나온 것이라 확정 불가 — 재판정 후 재평가 필요.

## 2. 재판정 방법 (격리)

- 배치별 **별도 새 워커** 5명이 B를 다시 판정. 입력: current를 제거한 evidence 파일
  (`/tmp/rejudge/ev-0NN.json`, `"current"` 0건 grep 검증) + 프로토콜 2종.
- **읽기 금지**: batch-0NN.json, reviewerA, 기존 reviewerB, judge/disagreements,
  current-values.json, 그 외 모든 audit 산출물.
- 이후 Judge(A vs 새 B) → QA → 병합(summary 재계산) 순으로 재실행.
- 편차 1건: 스폰 메시지에 evidence를 직접 붙여넣으라는 지시였으나 exec 출력
  truncation(69KB) 위험으로 파일로 대체, grep 검증함.
- 사고 1건: 병합 테스트 중 구 judge-record로 batch-015.json을 잘못 덮었으나
  즉시 `git checkout`으로 원복, mtime 안전장치 추가. 최종 산출물 영향 없음.

## 3. 결과

| 배치 | 불일치율(status 제외) | evidence 동일률 | golden 바이트동일 | QA 되돌림 | UNMAPPED_LABEL |
|---|---|---|---|---|---|
| b11 | 10.6% (17건) | 12% | 0 | 0 | 2 |
| b12 | 8.0% (14건) | 11% | 0 | 4 | 2 |
| b13 | 10.0% (16건) | 10% | 0 | 3 | 1 |
| b14 | 14.2% (25건) | 9% | 0 | 4 | 1 |
| b15 | 17.5% (28건) | 0% | 0 | 0 | 0 |

- 정상 범위(불일치율 5~15%, 동일 문구 10% 미만)에 대체로 부합.
  b15는 17.5%로 상한을 소폭 초과, b11은 동일 문구 12%로 기준을 소폭 초과 —
  둘 다 30% 실패선에서는 멀리 떨어져 있어 허용 범위.
- 자동 검사 4종 (`quality-auditor-checks.py`): **배치 1~15 전부 위반 0건**.
- 참고: b9 32.9%·b10 6.2%는 재판정 전 수치 그대로 (독립성은 정상이었음).

## 4. [2] 교차 블록 corroboration 인용 정정 (3건)

`regression-rules.md` §9.1 신설: RESULTS-4 [B]의 교차 반복 블록 5개는
오염 의심이므로 corroboration 근거 인용 금지.

| 상품 | 정정 전 | 정정 후 |
|---|---|---|
| b14 루비아커피-에티오피아예가체프코케g2 | f80_80(교차 블록)↔f750_750 "상호 보강" | 보강 인용 삭제. f750_750 단독 OCR → [꽃향기, 복숭아, 갈색설탕] MEDIUM+current_echo (깔끔함은 질감어로 제외) |
| b15 cafedoan-12769121036 | "OCR(Peach/Jasmine/Earl Grey/Honey) 교차 확인" | 인용 삭제. detailText CUP NOTE 기반 → [살구, 청포도, 플로럴, 향신료] HIGH+text_confirmed |
| b15 루비아커피-케냐키리냐가키이aatop | "꽃향기=Jasmine·복숭아=Peach 교차확인 유지" | 인용 삭제. 8종 병합 → MEDIUM+current_echo |

정당 인용 4건(b6 시즈널블렌드너티브리즈, b15 헤이즐넛브라운·12747134803·구지벤티·11696788154)은
교차 블록이 아니라 유지 (QA 확인).

## 5. [3] 미매핑 라벨 규칙 적용

`regression-rules.md` §5.1 신설: enum에 없는 원문 라벨은
`raw`=원문 보존, `value`=null, `confidence`=HIGH, `mappingStatus`=`UNMAPPED_LABEL`.
정확도 통계에서 UNKNOWN·SOURCE_MISSING과 별도 범주로 집계
(`summary.unmappedLabelFieldCount` 신설).

적용 6건: b11 namusairo-828 (Well-done, raw null→"Well-done" 복구),
b11 namusairo-763 (**French** — 재판정 중 추가 발견, 동일 규칙 적용),
b12 namusairo-27, b12 namusairo-522 (원문 '웰던 Well-done' 유지),
b13 namusairo-345, b14 namusairo-41.

## 6. QA 되돌림 11건 (전부 status)

Cafe24 구매 버튼 영역의 "SOLD OUT" 문구가 전 페이지 공통 DOM 템플릿 라벨임을
배치 간 교차 검증으로 확정 (바이트 동일 문맥, 구매 버튼 공존, isSoldOut=False) →
soldout 판정을 active로 되돌림. b11 Judge 선례와 일관.
b12 4건 · b13 3건 · b14 4건에 적용, diff.status 재계산.

## 7. 부수 수정 (재판정 중 발견)

- **stale comparable**: raw가 바뀐 tastingNotes에 구 raw 기준 comparable/droppedByNormalizer가
  복사되던 결함 (b15 2건) → raw 변경 시 derived 키 미승계로 수정.
- **CASE 3 diff 라벨**: b13 2건의 OCR 충돌 UNKNOWN이 `EVIDENCE_UNAVAILABLE`로 기록 →
  프로토콜 §6/§9 및 배치 1~10 선례에 따라 `OCR_CONFLICT`로 정정.

## 8. 미해결 — 사용자 판단 필요

1. **배치 간 status 불일치**: b2의 namusairo-1135/1096이 동일 템플릿 SOLD OUT 문구로
   soldout 판정된 반면, b3·b11~b14의 동일 문구는 active로 판정.
   QA 워커 3명이 독립적으로 지적. b2의 soldout 판정을 재검토할지 결정 필요.
   (b12 namusairo-522도 동일 문구 — 이번 재판정에서 active로 처리됨.)
   **[2026-09-25 INTERIM-5에서 정정 — b6 누락분이 있었다.
   전수 스윕 결과 b2 5건(namusairo-1135·1096, deepbluelake-571, coffee502-9, werk-572),
   b6 6건(namusairo-1132·1137, deepbluelake-572, coffee502-154, werk-568, fritz-982)
   전부 템플릿 라벨로 확정되어 active MEDIUM/collector_flag로 정정. 상세는 INTERIM-5.]**
2. 미세 관찰 (QA 되돌림 미달, 기록용):
   - b14 hocuspocus-13707039145 originRegion '키리냐가' vs 상품명 '키린야가' 표기 차이
   - b13 namusairo-1146 status가 HIGH/rawObservations (관례는 MEDIUM/collector_flag) — 값은 정확

## 다음 단계

배치 16~19 판정 — **사용자 승인 대기**.
