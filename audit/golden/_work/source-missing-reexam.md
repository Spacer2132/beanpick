# SOURCE_MISSING 재검사 보고서 (2026-09-25)

- 범위: `audit/golden/batch-001.json` ~ `batch-010.json` (250건)의 confidence=SOURCE_MISSING 679건 전수
- 계기: 사용자 사람 검증에서 productName 근거 SOURCE_MISSING 판정이 실제 상세이미지 정보와 충돌한 사례 확인
  (커피정경 배합커피#4 율무: 원산지·로스팅이 상세이미지에 있었으나 SOURCE_MISSING으로 판정됨)

## 1. 재검사 기준 (강화)

**SOURCE_MISSING은 해당 필드가 있을 수 있는 원문 전부를 확인했을 때만 허용.**
productName만 보고 판단했거나, detailImageUrls가 있는데 이미지 내용을 확인하지 못한 상태의 SOURCE_MISSING은 금지 → UNKNOWN(EVIDENCE_UNAVAILABLE)으로 재분류.

### 기계 판정 규칙

각 SOURCE_MISSING 필드에 대해:

1. **가용 출처** = 해당 상품의 audit-input 파일에 실제로 존재하는 원문
   - `productName` (항상), `detailText`(detailCache.detailText 비어 있지 않음),
     `detailHtml`(detailHtmlStripped), `rawTexts`(rawObservations 중 비어 있지 않은 text 존재;
     `rawTexts` 키는 454개 파일 중 0개에 존재 → evidenceSource의 `rawTexts` 표기는 rawObservations를 가리키는 것으로 간주),
     `ocr`(ocr 출력 비어 있지 않음), `detailImages`(detailImageUrls 1개 이상)
   - snapshotRecord는 수집기 파생값이라 원문에서 제외
2. **확인 출처** = golden의 evidenceSource fragment + evidence 텍스트에 명시된 출처
   (키워드: 상품명/detailText/detailHtml/rawObservations/rawTexts/ocr·OCR·gemini/상세이미지)
   - 상세이미지는 OCR 인용 시 이미지 내용 확인으로 간주 (OCR이 이미지 내용 점검 수단)
   - `judge: insufficient evidence`, `coffee_domain_review`는 전수 검토 결론으로 간주 → 유지
3. 가용 출처 − 확인 출처 − {productName} 가 비어 있으면 **유지**, 하나라도 있으면 **UNKNOWN 재분류**
   - 재분류 시 evidence에 사유 추기 (값·raw·evidenceSource는 불변)

## 2. 결과 요약

| 구분 | 건수 |
|---|---|
| 재검사 대상 (SOURCE_MISSING) | 679 |
| → UNKNOWN 재분류 | **451** |
| 유지 (전수 확인 문서화) | 217 |
| 유지 (Judge/도메인 전수 결론) | 7 |
| 사람 검증으로 HIGH 정정 (재분류 제외) | 3 |

재분류 후 배치 1~10 전체: SOURCE_MISSING **225건**(679→), UNKNOWN **925건**(474→, +451), HIGH +3.

### 미확인 출처 분포 (재분류 451건)

| 미확인 출처 | 건수 | 비고 |
|---|---|---|
| OCR 출력만 | 257 | OCR 출력이 있는데 evidence에 인용 없음 — 최대 비중 |
| 상세이미지 + OCR 출력 | 107 | 이미지 있고 OCR도 있는데 둘 다 미인용 |
| OCR 출력 + 원문 텍스트 | 33 | |
| 상세이미지만 | 28 | 이미지 있고 OCR 없음 — 이미지 내용 미확인 |
| 원문 텍스트만 | 15 | rawObservations 미인용 |
| detailText만 | 12 | |
| detailText + OCR 출력 | 3 | |

### 필드별 재분류

| 필드 | 재분류 | 유지 | 합계 |
|---|---|---|---|
| roast | 104 | 43 | 147 |
| variety | 98 | 32 | 130 |
| producer | 90 | 34 | 124 |
| originRegion | 74 | 30 | 104 |
| originCountry | 39 | 17 | 56 |
| process | 41 | 27 | 68 |
| tastingNotes | 5 | 36 | 41 |
| productType | 4 | 5 | 9 |

tastingNotes는 대부분 OCR 인용이 문서화되어 있어 유지율이 높고(36/41),
roast·variety·producer는 OCR/이미지 미확인이 많아 재분류율이 높다.

### 로스터리별 × 필드별 재분류표

| 로스터리 | originCountry | originRegion | process | producer | productType | roast | tastingNotes | variety | 합계 |
|---|---|---|---|---|---|---|---|---|---|
| (미표기: batch 파일 roastery null, 18개 상품) | 4 | 6 | 6 | 13 | 0 | 12 | 1 | 11 | 53 |
| 502커피로스터스 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 | 2 |
| 나무사이로 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| 딥블루레이크 | 4 | 9 | 5 | 8 | 0 | 10 | 0 | 8 | 44 |
| 로스터릭 | 2 | 4 | 1 | 4 | 0 | 9 | 0 | 7 | 27 |
| 루비아 커피 | 3 | 5 | 3 | 9 | 2 | 2 | 0 | 9 | 33 |
| 베르크커피 | 3 | 5 | 2 | 6 | 0 | 5 | 0 | 6 | 27 |
| 센터커피 | 2 | 3 | 1 | 5 | 0 | 3 | 0 | 3 | 17 |
| 아이덴티티 커피랩 | 3 | 4 | 2 | 6 | 1 | 6 | 0 | 5 | 27 |
| 에어리커피 | 0 | 0 | 1 | 1 | 0 | 2 | 0 | 0 | 4 |
| 카페도안 | 2 | 4 | 1 | 6 | 0 | 6 | 1 | 4 | 24 |
| 커피리브레 | 1 | 1 | 1 | 1 | 0 | 1 | 0 | 2 | 7 |
| 커피정경 로스터리 | 4 | 5 | 3 | 8 | 1 | 9 | 0 | 9 | 39 |
| 토치 커피 | 3 | 6 | 3 | 7 | 0 | 8 | 1 | 6 | 34 |
| 테라로사 | 4 | 7 | 3 | 7 | 0 | 9 | 1 | 7 | 38 |
| 프릳츠 커피 컴퍼니 | 2 | 3 | 2 | 3 | 0 | 3 | 0 | 2 | 15 |
| 필아웃커피 | 1 | 3 | 2 | 4 | 0 | 5 | 1 | 5 | 21 |
| 헬카페 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 |
| 호커스포커스 로스터스 | 0 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 3 |
| 히떼 로스터리 | 1 | 6 | 4 | 7 | 0 | 13 | 0 | 6 | 37 |
| **합계** | **39** | **74** | **41** | **90** | **4** | **104** | **5** | **98** | **451** |

스마트스토어 로스터리(커피정경·토치·로스터릭·히떼 등 이미지 위주 상세)에 재분류가 집중됨 —
사람 검증에서 드러난 문제(상세이미지 미확인)와 같은 방향.

### 유지 224건 내역

- 217건: evidence/evidenceSource에 전수 확인이 문서화됨
  (예: "원문(상품명+OCR) 확인했으나…", "(ocrNotes 비어 있음)", "detailText는 …만 존재", "rawObservations 빈 문자열")
- 7건: Judge(`judge: insufficient evidence`, 5건) / 도메인 리뷰(`coffee_domain_review`, 2건)의 전수 검토 결론

## 3. 사람 검증 6건 처리 내역

| # | 상품 | 판정 | 처리 |
|---|---|---|---|
| 1 | namusairo-1090 (batch-003) | process "블렌드"(HIGH) → 실제 상세표 "Natural Fermentation · Washed". 필드 혼동 오류 | golden process → **"Natural Fermentation · Washed" HIGH**로 정정, evidence 교체. diff는 기존대로 불일치(PARSER_MISS) 유지 |
| 2 | 커피정경 배합커피#4 율무 (batch-004) | origin/process/roast가 productName 근거 SOURCE_MISSING → 실제 상세이미지에 브라질·인도·콜롬비아·베트남 배합 + 다크 로스트 | originCountry → **"브라질 · 인도 · 콜롬비아 · 베트남" HIGH**, roast → **Dark(원문: 다크 로스트) HIGH**로 정정. process는 사람 검증에서 가공법 표기 미확인 → null/SOURCE_MISSING 유지하되 evidence를 사람 검증 근거로 교체. diff 2건 → 불일치(NOT_IMPLEMENTED, 수집 시 detailImageUrls 미수집) |
| 3 | 로스터릭 콜롬비아 E.A 디카페인 (batch-005) | 상세이미지에 중강배전 → roast "정보 없음" 오류 | golden roast → **Medium-Dark(원문: 중강배전) HIGH**로 정정. diff → 불일치(NOT_IMPLEMENTED) |
| 4 | identity-13718237904 (batch-002) | 상세이미지에 라이트 로스트. golden UNKNOWN | 변경 없음 (golden roast 이미 UNKNOWN — 정직한 판정) |
| 5 | werk-170 (batch-005) | productType=blend / process=null이 규칙상 맞음 | 변경 없음 (golden 유지) |
| 6 | fillout-13684373989 (batch-002) | 상세이미지에 라이트 로스트 + 노트(히비스커스·레드커런트·감초). golden UNKNOWN | 변경 없음 (golden roast·tastingNotes 이미 UNKNOWN — 정직한 판정) |

#2·#3의 정정 근거 evidenceSource는 `…#evidence.detailImageUrls` 형식으로 기록하되,
evidence 텍스트에 "수집 시 detailImageUrls 미수집 — 사용자 사람 검증(2026-09-25)이 실제 상세이미지 확인"을 명시.

## 4. 상품 혼동 확인 결과 (커피정경 배합커피#4 율무)

사용자 제보: 라이브 페이지에서 탭 제목 "#2 경주" vs 본문 "#4 율무" 불일치 → 수집 시 상품 혼동 여부 확인 요청.

audit-input 검증 결과 — **수집 데이터 내 혼동 증거 없음**:

- `snapshotRecord.productUrl` = `https://smartstore.naver.com/coffeejg/products/13736416283`,
  `productName` = "배합커피#4 율무" → URL의 상품 ID와 상품명 일치
- `evidence.detailCache.file` = `13736416283-744a968877105f8449a392bdcad89b003dc256d1.json`
  → 같은 상품 ID(13736416283) 참조 (파일 자체는 audit-input에 미포함)
- `priceOptions`에 200g 옵션(`…/products/13736426450`)과 1kg 옵션(`…/13736416283`)이 있으나,
  스냅샷 454건에 13736426450 상품은 없음
- OCR은 썸네일 1건에만 실행 (노트 5개 추출). detailText·detailImageUrls는 수집되지 않음 ("", [])

결론: 수집된 모든 아티팩트가 일관되게 상품 13736416283 = "배합커피#4 율무"를 가리킴.
탭 제목 불일치는 라이브 페이지(판매자 측 탭 타이틀 또는 별도 탭)의 이상으로 보이며,
**golden을 UNKNOWN으로 되돌리지 않음**. 단, priceOptions에 데이터셋 외 상품 ID(13736426450)가
섞여 있다는 점은 기록함.

## 5. 관찰 및 후속 제안

1. **OCR 미인용이 재분류의 88%를 차지** (257+107+33=397/451). 리뷰어가 OCR 출력을
   실제로 봤더라도 evidence에 문서화하지 않으면 새 기준에서 SOURCE_MISSING 불가.
   배치 11 이후 리뷰 지침에 "확인한 출처를 evidenceSource에 전부 기재"를 명시할 것.
2. **상세이미지 135건**(이미지+OCR 107, 이미지 단독 28)이 미확인 상태였음.
   스마트스토어 상품의 상세이미지는 수집기가 가져오지 않는 경우가 많아
   (커피정경·로스터릭 2건 모두 detailImageUrls 비어 있음) 구조적 한계.
   → "[3] 가설(상당수의 roast 누락은 SOURCE_MISSING이 아니라 NOT_IMPLEMENTED)"을 뒷받침.
   이번에 NOT_IMPLEMENTED로 전환된 diff 3건(커피정경 originCountry·roast, 로스터릭 roast)이 실증 사례.
3. **evidenceSource의 `rawTexts` 표기 55건+**: 454개 파일 중 `rawTexts` 키를 가진 파일이 0개.
   전부 `rawObservations`를 가리키는 것으로 해석했으나, 경로 검증(다른 에이전트 담당)에서
   broken path로 잡힐 것. 이번 재분류에서는 rawTexts≡rawObservations로 처리함.
4. `review` 하위 객체(Reviewer A/B·Judge·QA·도메인 기록)는 **판정 이력으로 원본 유지**,
   최상위 `golden`만 수정함. 배치 summary의 sourceMissing/unknown 건수·비율은 재계산했고,
   batch-004(diffMismatchCount 57→59, mismatchCountExclStatus 49→51, NOT_IMPLEMENTED 2→4),
   batch-005(mismatchCountExclStatus 49→50, NOT_IMPLEMENTED 4→5)의 diff 통계도 갱신.
   revisionNotes에 이번 변경을 추기.
