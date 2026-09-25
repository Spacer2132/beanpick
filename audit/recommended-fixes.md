# BeanPick Phase 1 — recommended-fixes 후보 (발견 사항 기록)

- 작성: 2026-09-25
- 성격: **발견 사항 기록용**. production 코드 수정 금지. 수집기/OCR 개선의 다음 단계 제안 후보.
- 출처: 사람 검증 결과 (`audit/human-check.md`) + 배치 1~10 golden 판정.

---

## 1. roast 누락의 상당수가 SOURCE_MISSING이 아니라 OCR 범위 밖(NOT_IMPLEMENTED)일 가능성 (가설)

### 현상
스마트스토어 상품의 상세이미지에는 로스팅 표기가 흔하게 포함되어 있으나, BeanPick golden의 roast 필드는 대부분 UNKNOWN/SOURCE_MISSING으로 판정되었다.

### 근거
- 사람 검증 10건 중 6건을 확인했고, 그 중 **4건**에서 상세이미지 속 로스팅 표기를 사람이 직접 확인함:
  - 커피정경 배합커피#4 율무 → 다크 로스트 (golden은 SOURCE_MISSING → 판정 오류 확정, 별도 golden 수정)
  - 콜롬비아 E.A 디카페인 → 중강배전 (golden "정보 없음" 오류)
  - identity-13718237904 → 라이트 로스트 (golden UNKNOWN — 증거 기준상 정직하나, 이미지에는 있었음)
  - fillout-13684373989 → 라이트 로스트 (golden UNKNOWN — 증거 기준상 정직하나, 이미지에는 있었음)
- 현재 Gemini OCR 출력 스키마는 **테이스팅 노트만 추출**하도록 설계되어 있어, 이미지 속 로스팅 표기는 추출 범위 밖.

### 분류
`NOT_IMPLEMENTED` (OCR 수집 범위의 설계적 누락). "원문에 정보가 없다(SOURCE_MISSING)"는 사실이 아니라 **"수집이 해당 정보를 읽지 않는다"**는 문제. 배치 6~10 golden에서는 원본 이미지 내용을 확인하지 못한 상태에서 SOURCE_MISSING을 금지하고 UNKNOWN(EVIDENCE_UNAVAILABLE)으로 재분류함 — 이는 수집 누락을 감추지 않기 위한 임시 조치이며, 본질 해결은 아님.

### 제안
- OCR 스키마에 `roast` 필드를 추가한 뒤, 사람 검증에서 확인된 4개 상품 이미지(커피정경#4율무, E.A디카페인, identity-13718237904, fillout-13684373989)를 재추출하여 스키마 확장만으로 로스팅 회수율이 오르는지 검증.
- 회수율이 유의미하게 오르면, 배치 11 이후 golden의 roast UNKNOWN 상당수를 SOURCE_MISSING에서 NOT_IMPLEMENTED로 재분류하고 수집기 개선 티켓을 발행.
- 스마트스토어 상세가 이미지 위주이므로, 타 필드(originCountry, process 등)도 이미지 OCR 범위로 커버 가능한지 함께 검토.

---

## 2. fillout-13684373989 노트 누락 — OCR_MISS 확정 사례

### 현상
fillout-13684373989의 상세이미지에는 테이스팅 노트(히비스커스·레드커런트·감초)가 명시되어 있는데, BeanPick 표시에는 노트가 누락되어 있다.

### 근거
- 사람 검증 결과: 상세이미지에 히비스커스·레드커런트·감초 노트 존재 확인.
- golden은 해당 필드를 UNKNOWN으로 판정 — 증거 기준상 정직한 판정 (원본 이미지 내용을 golden 근거로 쓸 수 없었음).
- BeanPick 측(수집·표시 파이프라인)이 이미지 속 노트를 놓친 것은 OCR/수집 단계의 누락이므로 golden 판정과 별개로 `OCR_MISS` 분류로 확정 기록.

### 분류
`OCR_MISS` (수집/OCR 단계 누락). golden 판정 UNKNOWN은 유지 — golden은 "증거로 판정 가능한 것"만 기록하므로, 사람 검증으로 확인된 사실을 golden에 소급 반영하지 않는다.

### 제안
- 항목 1의 OCR 스키마 검증 시 이 상품을 함께 재추출: 스키마 확장(노트 외 정보)이 아닌, **기존 노트 스키마에서도 이 상품의 노트를 잡아낼 수 있는지** 확인. 잡아내지 못하면 OCR 모델/프롬프트 문제로 분류 전환.
- 이후 failure-taxonomy에 OCR_MISS 사례로 편입.

---

## 3. 정규화 사전 alias 추가 후보 — tastingNotes 표시 누락 (BeanPick 정규화기)

### 현상
`golden.raw`의 테이스팅 노트 중 BeanPick `normalizeTastingNotes`가 매핑하지 못해
`comparable`·`displayed` 양쪽에서 통째로 사라지는 노트가 있다.
정규화기를 거치기 전후를 비교하지 않으면 "완전 일치"로 보여 사각지대가 된다 (§6.2).

### 근거 (배치 1~12, 300건 실측, `audit/tools/compute-comparable.mjs`)
- `dropped_by_normalizer` 중 `dictionary-miss`: **175건 인스턴스 / 132개 distinct 노트 / 107개 상품**
- 대표 예시 (상품 수):
  - 한글 alias 비대칭: 꽃향기 8, 감귤 5, 블랙베리 5, 흑설탕 4, 건자두 3, 다크초콜렛 3, 얼그레이 2, 핵과류 2, 사탕수수 2, 카다멈 2, 타마린드 2, 수박 2, 꽃향 2, 꽃 향 2, 흑당 2, 블랙 슈가 2, 귤 1, 황설탕 1, 초콜렛 1, 시나몬 1, 토스트 2, 고소함 2
  - 영어 표기 변형/단복수: Earl Grey 4, Violet 3, Herbs 2, Kumquat 2, Mangosteen 2, Sweet mandarin 1, POMEGRANATE 1, Watermelon 1, Green tangerine 1, Tangerine 1, Sugarcane 1, Karamell 1, fudge 1, Lemongrass 1
  - 기타 언어 (우선순위 낮음): 노르웨이어 sjokolade / modne kirsebær / steinfrukt / bergamott, 스페인어 aromas cítricos de flor blanca 등
- 제외 (비노트·서술형 문장 — 사전 추가 대상 아님): 무거운 질감, 부드러운 촉감, 깊은 여운, 짙은 단맛의 여운이 남는 커피, 잘 익은 과일의 산미, 농축된 단맛, 깔끔한 뒷맛, 버터처럼 부드럽다, Crisp Finish 등
- 정당하게 버려진 것 (`texture`, 통계 제외): 달콤함 2, SWEET 1, 마일드한 커피 1, 부드러운 1, 풀바디 1, 좋은 균형감 1, 좋은 밸런스 1, 복합성 1 — 총 9건

### 분류
`DICTIONARY_GAP` (BeanPick 표시 어휘 사전의 alias 누락). golden 판정 오류가 아님.

### 제안 (수정 금지 — 후보 기록만)
- 한글 alias를 영어 원어와 대칭되게 보강 (꽃향기→플로럴, 감귤→귤, 블랙베리→검은딸기, 흑설탕→브라운슈가, 얼그레이→얼그레이 등)
- 영어 단복수/표기 변형 alias 추가 (Herbs→허브, Violet→제비꽃 등)
- 기타 언어는 별도 티켓으로 분리 (빈도 낮음)

---

## 4. overlap dedup으로 사라지는 실제 노트 — removeOverlappingNotes

### 현상
`normalizeTastingNotes`의 `removeOverlappingNotes`가 구체 노트와 함께 있으면 일반 노트를 삭제한다.
예: CACAO→초콜릿은 매핑되지만, 다크초콜릿이 함께 있으면 초콜릿이 통째로 삭제된다.
양쪽(comparable·displayed)이 같은 정규화기를 거치므로 불일치로 잡히지 않는다.

### 근거 (배치 1~12 실측, `dropped_by_normalizer` reason=`overlap-removed`, 10건 / 6상품)
- CACAO → 초콜릿 (다크초콜릿 공존 시 소멸): toch-10130602320
- 카카오 → 초콜릿: coffee502-10, coffee502-93, werk-170, werk-545 (4상품)
- Assam Tea → 차: coffeejg-13685877332 (구체 차 노트 공존 시 소멸)
- 초콜릿 → 초콜릿: coffee502-93, 루비아커피-100-에티오피아스칼렛
- 베리 / 베리류 → 베리: 루비아커피-100-에티오피아스칼렛 (구체 베리 공존 시 소멸)

### 분류
`NORMALIZER_DEDUP_LOSS` (BeanPick 정규화기의 중복 제거 규칙이 실제 노트를 삼킴).
golden 판정 오류가 아님 — golden raw에는 CACAO/카카오가 온전히 기록되어 있다.

### 제안 (수정 금지 — 후보 기록만)
- dedup 규칙 재검토: 일반 노트 삭제 대신 "구체 노트가 있으면 일반 노트는 표시에서만 제외" 같은
  비파괴 방식, 또는 원본 노트 보존 후 표시 단계에서만 dedup 적용
