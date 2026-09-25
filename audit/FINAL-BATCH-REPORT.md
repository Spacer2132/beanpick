# BeanPick 감사 최종 일괄 작업 — 최종 보고

작성: 2026-09-26. 브랜치: `muse/audit-final` (감사) / `muse/fix-display` (수정).
모든 수치는 `audit/tools/`의 스크립트로 계산됨. 상세 근거는 `audit/FINAL-REPORT.md`.

## 1. 완료/미완료 체크리스트

| 항목 | 상태 |
|---|---|
| PART A (감사 파이프라인 A1~A6) | ✅ 완료 |
| PART B (브랜치 정리, golden 삭제) | ✅ 완료 |
| PART C FIX-1 (tasting-note alias) | ✅ 완료 — Reviewer 승인, 커밋 `2ee50c4` |
| PART C FIX-2 (farm 찌꺼기 억제) | ✅ 완료 — Reviewer 승인, 커밋 `89e9cd1` |
| PART D FIX-3/FIX-4 설계, CI 갭 보고 | ✅ 완료 — 문서만, 구현 안 함 |
| PART E FINAL-REPORT | ✅ 완료 — `audit/FINAL-REPORT.md` |

- `muse/audit-final` (`43d718b`), `muse/fix-display` (`b72b8fe`) 둘 다 push됨.
- 원격 `muse/audit-golden` 삭제됨.
- `audit-input/`은 어떤 브랜치에도 커밋하지 않았고, 매 커밋 전 스테이징 0을 확인함.

## 2. 핵심 수치

### 정확도 (golden 값 있을 때 앱 표시 일치)

| 필드 | Correct | 분모 | 정확도 |
|---|---|---|---|
| originCountry (산지) | 305 | 352 | 86.6% |
| process (가공) | 235 | 350 | 67.1% |
| producer (농장) | 126 | 303 | 41.6% |
| roast (로스팅) | 190 | 325 | 58.5% |
| tastingNotes (노트) | 258 | 330 | 78.2% |
| variety (품종) | 255 | 341 | 74.8% |

### 재현율 (golden HIGH/MEDIUM 중 앱 표시 존재)

| 필드 | 표시됨 | 분모 | 재현율 |
|---|---|---|---|
| originCountry | 247 | 274 | 90.1% |
| process | 190 | 237 | 80.2% |
| producer | 46 | 85 | 54.1% |
| roast | 5 | 73 | **6.8%** (최악) |
| tastingNotes | 50 | 94 | 53.2% |
| variety | 66 | 126 | 52.4% |

### FALSE_POSITIVE (golden 값 없는데 앱이 표시)

| 필드 | FP | 분모 |
|---|---|---|
| originCountry | 3 | 39 |
| process | 28 | 68 |
| producer | 94 → **72** (FIX-2 후) | 134 |
| roast | 1 | 162 |
| tastingNotes | 2 | 84 |
| variety | 1 | 119 |

### 12문항 요약 (PHASE-1-FINAL.md §8)

1. CASE 1 실제 데이터 오류 **557** (PARSER_MISS 169, FALSE_POSITIVE 220, NORMALIZATION_ERROR 31, FIELD_MAPPING_ERROR 23, NOT_IMPLEMENTED 102)
2. CASE 2 원문 정보 없음 **606필드**
3. Parser 놓침 **169**
4. OCR_CONFLICT **16** (전부 판정불가)
5. NOT_IMPLEMENTED **152** (수집 고정값, 채널별 전용 처리)
6. EVIDENCE_UNAVAILABLE **641필드**
7~10. 위 정확도·재현율 표
11. 문제 최다 로스터리: **나무사이로 102건**, 카페도안 96, 루비아 커피 74, 에어리커피 66
12. **정규화 사전 alias 추가 — 소규모 코드 변경** (→ FIX-1로 구현됨)

## 3. FIX-1 · FIX-2 전후 비교 요약

### FIX-1 (tasting-note alias 추가, 커밋 2ee50c4, Reviewer 승인)

- 변경: `src/services/tastingNotes.js`·`.cjs` NOTE_RULES에 alias 56개 + 신규 라벨 43개 추가 (양쪽 동일, export 구문 외 diff 0). 서술형·질감어 제외.
- 도구 변경: `audit-data.mjs`의 tastingNotes comparable을 현재 정규화기로 항상 재계산 (구 사전 하 454건 일치 검증, 기존 리포트 수치 무영향).
- 시뮬레이션 (`simulate-renormalize.mjs`, 실제 발행 경로와 동일 조건 `{limit: 5, explicitEvidence: true}`):
  - **복구 21건** (golden 커버 18 + current_echo 3), **사라진 값 0, 맞다가 틀려진 값 0, 새 FP 0** → exit 0
  - **"시뮬레이션 추정치"** — 실제 발행 후 수치 확정 필요
- 검증: 8개 테스트 스위트 전부 통과 + `npm run audit:test` ALL PASS. Reviewer 독립 재현으로 승인 (`audit/fixes/FIX-1.md` §8).

### FIX-2 (inferFarmName 찌꺼기 표시 억제, 커밋 89e9cd1, Reviewer 승인)

- 변경: `src/services/coreFeatures.js`에 `INFERRED_FARM_JUNK_PATTERNS` 12종 + `isInferredFarmJunk()` 추가. `formatProductDisplayInfo`의 fallback을 `detailFarm || (junk ? '' : inferredFarm)`로 변경. `product.farm` 상세값 우선은 구조적으로 보장, `inferFarmName` 시그니처 불변.
- 직접 측정 (stash 전후 코드 비교, 시뮬레이션 아님, `audit/tools/compare-grade-reports.mjs`):
  - **producer Correct 80→102 (+22), FALSE_POSITIVE 94→72 (−22)**, Wrong/Missing 변화 0
  - 22건 전부 FALSE_POSITIVE→Correct (빈 표시 = true negative). Correct→Wrong 0, Correct→Missing 0.
  - producer 외 5개 필드 등급 변화 0. `product.farm` 있는 상품의 표시 변경 0건.
- 잔여 72건은 표면 패턴으로 안전 분리가 **원천 불가능**함을 증명 (예: FP 'NOMAD 노마드 Abebe Hewiso' vs 정답 'NOMAD 노마드 Timbuyacu' 표면 동일, '여러 소농들' 역설). 권장 후속: 수집 단계에서 `product.farm` 확보 (FIX-3 계열).
- 알려진 한계: 찌꺼기 토큰 포함 복합 문자열 전체 blank라 golden 미커버 3건(centercoffee-417 'Kotowa Las Brujas Lot 26-124' 등)의 실제 농장명 표시도 함께 억제. 등급 영향 없음.
- 검증: 8개 스위트 전부 통과 + `npm run audit:test` ALL PASS. Reviewer 독립 재현으로 승인 (`audit/fixes/FIX-2.md` §7).

## 4. 사람이 해야 할 일

1. **실제 발행 후 FIX-1 수치 확정** — 시뮬레이션은 추정치. 발행 후 `npm run audit:data -- docs/products.json` 재실행으로 복구 21건 확인.
2. **FIX-3 (OCR 로스팅 추출) 구현 여부 결정** — roast 재현율 6.8%의 가장 큰 레버. 설계는 `audit/fixes/FIX-3-design.md`에 있음. Gemini 프롬프트 변경 + 캐시 버전 상향(`source-notes-v5`) + golden 기준 202건 재OCR 필요.
3. **FIX-4 (b) '카카오' 라벨 분리 여부 결정** — (a) 'Assam Tea'→'홍차' alias는 FIX-1 유형으로 바로 가능. (b)는 canonical 어휘 변경이라 결정 필요. 설계는 `audit/fixes/FIX-4-design.md`.
4. **CI에 `map:test`·`contract:test` 추가** — `npm run verify`에는 있는데 `.github/workflows/publish-iphone-snapshot.yml`에서 빠져 있음.
5. **tastingNotes.js/.cjs 단일 소스화 또는 동기화 가드** — 수동 동기화는 깨지기 쉬움.
6. **막힌 항목**: current_echo 표시 누락 7건 — golden에 값이 있는데 앱 표시가 비어 있음 (tastingNotes 5, process 1, roast 1). 원인: 리뷰어가 raw 증거 텍스트를 echo했는데 정규화기가 전부 버려 표시가 빔. 수집/표시 파이프라인 문제로 이번 배치 스코프 밖. `audit/FINAL-REPORT.md` §5에 기록됨.
