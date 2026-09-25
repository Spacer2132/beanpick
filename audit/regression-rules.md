# 회귀 비교 규칙 (Regression Harness)

- 목적: `audit/golden/batch-*.json`의 `golden.value`(정규화 값)와 `current.displayed`(앱 실제 표시값)를
  비교할 때의 동등성 규칙. 표기 차이로 인한 오판을 막기 위한 것.
- `golden.raw`는 원문 표기를 그대로 보존하며, 비교에는 사용하지 않는다.
- 생성: 2026-09-25 (스키마 개정 #1). 구현: `audit/tools/schema-revision-1.py`.

## 1. 공통 정규화 (모든 문자열 필드)

1. 앞뒤 공백 제거, 내부 연속 공백 → 단일 공백.
2. 한글 토큰의 내부 공백 제거 (`다크 초콜릿` = `다크초콜릿`, `꽃 향` = `꽃향기`).
3. 영문은 대소문자 무시 (`Washed` = `washed`).
4. 구분자 `,` `·` `/` `|` `(` `)`는 비교 시 무시하고 토큰 집합으로 비교
   (`구지 샤키소` = `구지, 샤키소` = `구지·샤키소`). 순서는 무시.

## 2. 국가 (originCountry)

한/영 동일 국가로 취급:

| 정규화 값 | 동등 표기 |
|---|---|
| 에티오피아 | Ethiopia |
| 콜롬비아 | Colombia |
| 파나마 | Panama |
| 케냐 | Kenya |
| 과테말라 | Guatemala |
| 브라질 | Brazil |
| 코스타리카 | Costa Rica |
| 페루 | Peru |

## 3. 가공 (process)

| 정규화 값 | 동등 표기 |
|---|---|
| 워시드 | Washed |
| 내추럴 | Natural |
| 허니 | Honey |
| 무산소 | Anaerobic |
| 화이트 허니 | White Honey |
| 블랙허니 | Black Honey |
| 워시드 익스페리멘탈 | Washed Experimental |
| 워시드 드라이 퍼먼테이션 | Washed (Dry Fermentation) |
| 무산소 내추럴 | Anaerobic Natural |

수식어 결합(`내추럴 + 마운틴 워터`, `워시드 무산소` 등)은 토큰 집합 비교.
`블렌드`는 가공값이 아니라 제품 유형이므로 process 비교에서 제외.

## 4. 품종 (variety)

| 정규화 값 | 동등 표기 |
|---|---|
| 핑크 버번 | Pink Bourbon |
| 게이샤 | Geisha |

지역명(구지·예가체프·타라주 등)을 품종으로 기록하지 않는다.
`자생종`·`다품종` 같은 일반명은 품종이 아니다.

## 5. 로스팅 (roast)

5단계 enum: `Light` / `Medium-Light` / `Medium` / `Medium-Dark` / `Dark`.
원문 라벨 → enum 매핑 (golden.raw에 원문 표기 보존):

| enum | 원문 라벨 |
|---|---|
| Light | 라이트 로스트, 라이트, Light |
| Medium-Light | 중약배전, Light Medium |
| Medium | 미디엄 로스트, 미디엄, 중배전, Medium |
| Medium-Dark | 중강배전, 미디엄 다크 로스트 |
| Dark | 강배전, 다크 로스트, 다크, Dark |

(사용자 결정 2026-09-25: 중강배전=Medium-Dark, 중약배전=Medium-Light, confidence=HIGH)

### 5.1 미매핑 라벨 (UNMAPPED_LABEL, 2026-09-25 결정)

enum에 억지 매핑하지 마라. 매핑표에 없는 원문 라벨(예: `Well-done`)은:
- `roast.raw` = 원문 표기 그대로 보존 (예: `"Well-done"`)
- `roast.value` = null
- `roast.confidence` = HIGH (원문 표기 자체는 확실하므로)
- `roast.mappingStatus` = `"UNMAPPED_LABEL"`

정확도 통계에서는 UNKNOWN·SOURCE_MISSING과 **별도 범주**로 집계한다.
다른 미매핑 라벨이 나오면 같은 규칙을 적용한다.
(적용: b11 namusairo-828, b12 namusairo-27, b12 namusairo-522, b13 namusairo-345, b14 namusairo-41)

## 6. 테이스팅 노트 (tastingNotes)

### 6.1 비교 규칙 (2026-09-25 개정 — 번역·정규화 인식)

**golden raw 텍스트를 그대로 비교하지 마라.** golden은 OCR 영어 원문(ROASTED ALMOND),
displayed는 BeanPick 표시 어휘(볶은아몬드)인 경우가 많아 토큰 집합 비교는 과소 측정된다
(구방식 18.5% → 신방식 86.0%, 배치 1~10 실측). BeanPick 정확도로 보고하지 마라.

비교 절차:

1. `src/services/tastingNotes.js`의 `normalizeTastingNotes`를 **import**해서
   `golden.raw`(없으면 `value`)에 적용: `normalizeTastingNotes(raw, { limit: Infinity, explicitEvidence: true })`
   - production 코드는 수정하지 않는다. 함수 import만 사용한다.
   - 결과는 `golden.tastingNotes.comparable`에 기록 (비교 전용, `golden.value`는 유지).
2. `comparable` (BeanPick 표시 어휘) vs `displayed` (이미 표시 어휘)를 집합으로 비교. 순서는 무시.
3. 결과는 세 가지로 보고:
   - `matched`: 양쪽에 있는 노트
   - `missing_in_displayed`: comparable에만 있음 (예: malik 프루티블렌드의 '딸기·라즈베리·포도' —
     golden raw에 있으나 화면에 표시되지 않음)
   - `extra_in_displayed`: displayed에만 있음 (앱 파이프라인이 golden과 다른 출처에서 인식한 노트)
4. 정규화 결과가 없는 raw 노트는 `unmatched_pairs` 목록에 남긴다 — 번역 사전 alias 누락 후보.
   (예: 꽃향기, 감귤, 흑설탕, 블랙베리, 다크초콜렛, 얼그레이, 핵과류, 사탕수수, 카다멈 —
   한글 alias가 영어 원어 alias와 비대칭)
5. 질감·강도 서술(`쥬시`, `가득`, `Clean`/`깔끔한`, `SWEET` 등)은 노트가 아니다.

### 6.2 사각지대: 정규화기가 버린 노트 (2026-09-25 추가)

`comparable`·`displayed` 양쪽이 같은 정규화기를 거치므로, 정규화기가 버린 노트는
양쪽에서 똑같이 사라져 "완전 일치"로 보인다. 예: toch-10130602320 raw의 CACAO →
comparable·displayed 모두 없음 → 불일치로 잡히지 않음.

- 각 상품에 `golden.tastingNotes.droppedByNormalizer`를 기록:
  raw 노트 중 comparable에 매핑되지 않은 것. 항목별 `reason` 분류:
  - `overlap-removed`: 매핑은 됐으나 `removeOverlappingNotes` dedup으로 제거됨
    (예: CACAO→초콜릿이 다크초콜릿 공존 시 소멸). **실제 맛 노트 손실** → recommended-fixes 후보.
  - `dictionary-miss`: 사전에 없어 매핑 자체가 안 됨. **실제 맛 노트 손실** → recommended-fixes
    "정규화 사전 alias 추가" 후보 (단, 서술형 문장·비노트는 제외하고 별도 표기).
  - `texture` / `blocked-nontaste`: 질감어·비맛(국가 등) — 정당하게 버려진 것. 통계 제외.
- 통계에 네 번째 범주 `dropped_by_normalizer`를 추가:
  matched / missing_in_displayed / extra_in_displayed / **dropped_by_normalizer**.
  이 범주는 golden-vs-app 불일치가 아니라 **BeanPick 정규화기 자체의 손실**을 측정한다.

`current_echo` 필드는 이 통계에서도 제외 (§9).

## 7. 생산자 vs '농장' 행 (producer)

`golden.producer`와 `displayed.region`(= `formatProductDisplayInfo().farm`, 앱의 '농장' 행)을 비교.
farm은 상품명 기반 추론이므로 생산자와 다를 수 있다.

- 정규화 집합(괄호·구분자 분리, 공백 제거, 소문자)이 교차하거나,
  한쪽이 다른 쪽에 부분 문자열로 포함되거나,
  golden의 핵심 단어(5자 이상, `coffee`·`farm`·`finca` 등 제외)가 farm에 그대로 있으면 → 일치.
- `golden.producer`가 null(SOURCE_MISSING)인데 farm에 잔여 텍스트가 있으면 → FALSE_POSITIVE.
- `golden.producer`가 UNKNOWN이면 → 비교 불가 (EVIDENCE_UNAVAILABLE).

## 8. 비교 제외 필드

- `originRegion`, `productType`: 앱에 해당 표시가 없음 → `NOT_DISPLAYED_FIELD` (비교 제외).
- `status`: 수집 플래그(`isSoldOut`) 기준, `confidence=MEDIUM`, `evidenceSource=collector_flag`.
  원문에 반대 증거(본문 'SOLD OUT' 표기 등)가 있으면 원문 우선. 정확도 통계에서 제외.

## 9. evidenceKind: current_echo (OCR 순환)

`tastingNotes` 중 `evidenceSource`가 OCR 단독(`evidence.ocr`, gemini 출력)이고
`confidence=MEDIUM`인 필드는 `evidenceKind: "current_echo"`를 표기한다.
`evidence.ocr`은 BeanPick이 이미 추출한 값이라 golden과 current(displayed)의 출처가
같다 — 이 필드로 정확도/정밀도/재현율을 재면 순환 논리가 된다.

- 정확도·정밀도·재현율 통계에서는 **제외**.
- regression harness에서는 **"기존 값 사라짐" 감지에만** 사용:
  `golden.value`에 있던 노트가 `displayed`에서 통째로 사라지면 회귀 알림.
  (단, 번역 표기 차이는 §6.1 절차로 해소 후 판정)
- `detailText`/`rawObservations` 텍스트에 OCR 노트가 그대로 있으면 독립 증거로 인정 →
  `evidenceKind: "text_confirmed"` (통계 포함).

### 9.1 교차 반복 블록의 corroboration 인용 금지 (2026-09-25 결정)

`audit/PHASE-1-RESULTS-4.md` [B]에서 지목된 로스터리 교차 반복 블록 5개
(Jasmine/Peach/Honey/Black Tea, Peach/Jasmine/Earl Grey/Honey,
자스민/복숭아/꿀/블랙티, 복숭아/자스민/얼그레이/꿀, 복숭아/얼그레이/자스민/꿀)는
오염 의심(모델 반복 출력 또는 OCR 캐시 오염)이므로,
golden evidence에서 "교차 확인/상호 보강" 근거로 인용 금지.
해당 인용을 삭제하고 남은 근거로만 재판정한다.
(정정: b14 루비아커피-에티오피아예가체프코케g2, b15 cafedoan-12769121036,
b15 루비아커피-케냐키리냐가키이aatop)

### 9.2 status — 구매 버튼 영역 템플릿 라벨 (2026-09-25 결정)

Cafe24 구매 버튼 영역(장바구니·바로구매하기와 함께 나오는 부분)의 `"SOLD OUT"` 라벨은
status 근거로 쓰지 않는다. status는 isSoldOut 플래그를 기준으로
MEDIUM/`collector_flag`로 판정한다.
원문 우선 원칙은 이 템플릿 라벨이 아닌, **본문에 따로 적힌 품절 안내**에만 적용한다.

템플릿 예시 (로스터리별 표기 차이 있음, 공통점은 구매 버튼과 동일 영역):
- namusairo: "결제예정금액은 주문 시 확인할 수 있습니다. / SOLD OUT / 장바구니 / 관심상품 / 바로구매하기 / 예약주문하기 / 정기배송"
- deepbluelake: "BUY NOW / ADD TO CART / SOLD OUT / WISH LIST"
- coffee502: "…SOLD OUT / 바로 구매하기 / 예약주문 / REGULAR DELIVERY" (구매 버튼 영역)
- werk: "장바구니 담기 / 바로 구매하기 / 예약주문 / 정기배송 신청하기 / SOLD OUT"
- fritz: "장바구니 / 구매하기 / 정기배송 신청하기 / 품절 Sold out"

진짜 별도 품절 안내가 본문에 있으면 `status.overrideExcerpt`에 그 원문 발췌를 기록한다
(발췌에 위 템플릿 마커가 섞여 있으면 예외 무효 — 자동 검사 (5)가 감지).

(정정: b2 namusairo-1135·1096, deepbluelake-571, coffee502-9, werk-572,
b6 namusairo-1132·1137, deepbluelake-572, coffee502-154, werk-568, fritz-982 —
전부 soldout HIGH → active MEDIUM/collector_flag. INTERIM-5)

## 10. decafMethod (디카페인 가공법)

`process`에는 본래 가공(워시드/내추럴/허니 등)만 둔다.
마운틴 워터/스위스 워터/E.A/슈가케인 같은 **디카페인 가공법**은 `decafMethod` 필드로 분리한다.
본래 가공이 원문에 없으면 `process`는 UNKNOWN/SOURCE_MISSING.
`decafMethod` normalized 표기: `Mountain Water` / `Swiss Water` / `E.A` / `Sugarcane` / `Sugarcane E.A`.
