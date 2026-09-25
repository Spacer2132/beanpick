# OCR 순환(circulation) 스캔 — 파이프라인 오염 전수 조사

- 작성: 2026-09-25
- 대상: `audit-input/products/*.json` 454건 (OCR 있음 271건, OCR 엔트리 461개)
- 방법: OCR output JSON의 `text` 노트를 정규화(소문자·공백·구두점 정리) 후 상품별 출현 집계,
  + OCR output **전체 블록 md5 해시**의 상품 간 완전 중복 탐지
- golden 수정 없음 (스캔+보고)

## 핵심 결과

| 지표 | 값 |
|---|---|
| 노트 텍스트 단위 순환 (≥2개 상품에 동일 텍스트) | **91개 텍스트** (≥3: 53 / ≥4: 39 / ≥5: 32) |
| 순환 텍스트를 포함한 상품 | 153개 (33.7%) |
| 로스터리 교차 순환 (2개 이상 로스터리에 등장) | 66개 텍스트 / 143개 상품 |
| **완전 중복 OCR 출력 블록** (비어있지 않은 output이 바이트 단위 동일) | **10개 블록 → 29개 상품** |
| 완전 중복 블록 중 로스터리 교차 (캐시 충돌 의심) | **5개 블록 → 17개 상품** |

> "83건"은 당초 추정치 — 실측값은 위와 같다 (텍스트 단위 91 / 상품 단위 153).

## 로스터리 교차 완전 중복 블록 (캐시 충돌 확실)

동일 OCR output이 **서로 다른 로스터리**의 상품에 그대로 등장 — OCR 캐시 키 충돌 또는 재사용 오염:

| # | 상품 수 | 로스터리 | 공통 노트 블록 |
|---|---|---|---|
| 1 | 4 | cafedoan, 아이덴티티커피랩 | Jasmine / Peach / Honey / Black Tea (Washed) |
| 2 | 4 | cafedoan, 아이덴티티커피랩 | Peach / Jasmine / Earl Grey / Honey (Washed) ← **b9 대표 세트** |
| 3 | 3 | cafedoan, 루비아커피 | Jasmine / Peach / Honey / Black Tea |
| 4 | 3 | cafedoan, 루비아커피 | 복숭아 / 자스민 / 얼그레이 / 꿀 (Washed) |
| 5 | 3 | cafedoan, 히떼로스터리 | 복숭아 / 얼그레이 / 자스민 / 꿀 |

cafedoan의 OCR 출력이 다른 로스터리 3곳의 상품에 그대로 붙어 있다.
cafedoan이 원본 제공자인지 피해자인지 원본 이미지 없이는 판별 불가 — 모든 케이스 CASE 3(UNKNOWN) 처리 대상.

### 연루 상품 (17건)

- cafedoan: 10838004944, 11446555211, 11754520054, 11754674334, 11754693192, 12769087298, 12769099340, 12769121036, 12844471045, 13627475142, 13627489275, 13635190498
- 아이덴티티커피랩: 칠린블렌드, 키치블렌드
- 루비아커피: 에티오피아예가체프코케g2워시드다크로스트, 케냐키리냐가키이aatop워시드다크로스트
- 히떼로스터리: 럼동블렌드, 에티오피안플라워블렌드

### 동일 로스터리 내 완전 중복 (정당 가능성 높음, 5개 블록 → 12개 상품)

- cafedoan 3개 블록 (Peach/Jasmine/Earl Grey/Honey 계열) — 동일 로스터리 시리즈 상품이라 정당할 수 있음
- fritz 2건 (LAS CODORNICES CATURRA NATURAL) — 동일 로스터리, 정당
- namusairo 2건 (VERDANT DEEP 건자두/카카오/당밀) — 동일 로스터리, 정당

### 빈 output `[]` 136건

OCR 결과가 빈 배열인 상품 136건 — 오염이 아니라 "OCR 추출 결과 없음". golden에서는 UNKNOWN/SOURCE_MISSING 근거의 일부로만 사용.

## golden 유입 여부 (batch-001~010)

중복 블록 연루 29개 상품 중 배치 1~10에 들어간 것은 11건:

| 상품 | 배치 | tastingNotes 판정 | 순환 노트 유입 |
|---|---|---|---|
| cafedoan-13627475142 | 9 | UNKNOWN (OCR_CONFLICT) | 제외 확인 |
| cafedoan-6199336952 | 1 | MEDIUM | **유입** — 양측 출력의 공통 노트 5개를 채택 (b1 Judge, 당시 기준). 순환 의심 블록 포함 → 재검토 권장 |
| cafedoan-9127512497 | 5 | LOW | 제외 (충돌 명시) |
| fritz-1290 | 3 | MEDIUM | 제외 ("엉뚱한 상품의 OCR"로 명시) |
| fritz-2213 | 5 | HIGH | 제외 (타 상품 OCR로 판단) |
| namusairo-1096 | 2 | HIGH | 유입 — 동일 로스터리 VERDANT DEEP 블록, 정당 가능성 |
| 루비아커피-케냐키리냐가키이aatop워시드라이트로스트 | 9 | UNKNOWN (OCR_CONFLICT) | 제외 확인 |
| 아이덴티티커피랩-칠린블렌드 | 3 | UNKNOWN (OCR_CONFLICT) | 제외 확인 |
| 아이덴티티커피랩-키치블렌드 | 9 | UNKNOWN (OCR_CONFLICT) | 제외 확인 |
| 히떼로스터리-럼동블렌드 | 7 | UNKNOWN (OCR_CONFLICT) | 제외 확인 |
| 히떼로스터리-에티오피안플라워블렌드 | 6 | UNKNOWN (OCR_CONFLICT) | 제외 확인 |

**결론**: 순환 의심 노트가 golden tastingNotes HIGH로 확정된 사례는 없다. 유일한 예외는 b1 `cafedoan-6199336952`(MEDIUM, Judge 채택 시점에 충돌 블록이 순환 OCR인 줄 몰랐음) — domain-violations 후보는 아니나 재검토 권장.

## 텍스트 단위 순환 상위 (참고)

일반 향미 노트(Peach 28건, Jasmine 26건, Honey 25건, 복숭아 22건, 초콜릿 17건 등)가 다수 상품에 등장하는 것은 커피 노트로서 자연스러운 현상 — 단독으로는 오염 증거가 아님. 오염 판단은 **완전 중복 블록(위 표)** 기준.

## recommended-fixes 후보 (수정 금지 — 기록만)

1. OCR 캐시 키 충돌: cafedoan 이미지의 OCR 결과가 3개 로스터리에 재사용. 캐시 키(이미지 URL 정규화 또는 해시) 점검 필요.
2. Gemini OCR이 노트만 추출하므로 roast·process는 OCR 범위 밖 — [3] 항목의 NOT_IMPLEMENTED 가설과 연결.
3. b1 cafedoan-6199336952 MEDIUM 판정 재검토: 순환 블록 포함 상태에서 채택됨.
