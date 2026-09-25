# FIX-1: 정규화 사전 alias 추가 (초안 — Reviewer 검증 전)

> **시뮬레이션 추정치**: 아래 "효과" 수치는 실제 발행이 아니라
> `audit/tools/simulate-renormalize.mjs`로 발행 경로를 흉내 낸 시뮬레이션 결과다.
> 다음 실제 발행에서 새 정규화기가 적용되면 아래와 같이 반영될 것으로 추정한다.

## 1. 변경 요약

- `src/services/tastingNotes.js` / `src/services/tastingNotes.cjs`의 `NOTE_RULES`에 실제 맛/향 노트 alias 추가.
  두 파일은 export 구문(`export {` vs `module.exports = {`) 외 diff 0임을 확인.
- 기존 33개 라벨에 alias 56개 추가 + 신규 라벨 43개 추가.
- 선별 기준: 과일·꽃·초콜릿·견과·향신료·차·음료 등 실제 맛/향만.
  질감·서술·평가어('무거운 질감','향긋한','톡 쏘는','깔끔한 여운','Mellow','클린' 등)와
  generic 토큰('과일','꽃','사탕','설탕','와인','잼')은 추가 금지.
- `audit/fixes/dict-miss-list.json` 177개 distinct miss 토큰 중 123개 해소,
  54개는 기준상 스킵(사유는 §5).

### 1.1 기존 라벨 alias 추가 (33개 라벨, 56개)

- 검은딸기 += 블랙베리 / 계피 += 시나몬 / 구운빵 += 토스트 / 꿀풀 += 허니서클
- 다크초콜릿 += 다크초콜렛, 초콜렛 / 딸기 += 딸기잼 / 레몬 += sitron
- 말린자두 += 건자두 / 망고스틴 += mangosteen / 멜론 += 메론 / 밀크초콜릿 += 밀크초코
- 베르가못 += bergamott / 복숭아 += 황도
- 브라운슈가 += 흑설탕, 흑당, 황설탕, 블랙 슈가 / 사과 += 홍옥
- 살구 += 건살구, 살구잼, orejones(스페인어 건살구) / 스파이스 += 향신료
- 시트러스 += sitrus / 요구르트 += 락틱 / 자두 += plomme(노르웨이어 자두)
- 자스민 += 재스민 / 장미 += 장미꽃잎 / 천도복숭아 += 넥타린
- 체리 += kirsebær(노르웨이어 체리)
- 초콜릿 += 초콜, fudge, 퍼지, 초코브라우니, sjokolade(노르웨이어 초콜릿)
- 카다몬 += 카다멈 / 캐러멜 += karamell(노르웨이어 캐러멜)
- 크리미 += cream, 크림, sweet cream / 패션프루트 += 패션프룻
- 플로럴 += 꽃향기, 꽃 향, 꽃내음, 꽃향, white flower, 화이트 플라워, elegant florals
- 허브 += herbs / 호박 += 단호박
- 홍차 += assam, 아쌈, 아쌈 티, 아삼, 아삼블랙티, sort te(노르웨이어 홍차)

### 1.2 신규 라벨 43개

- fruit: 감귤(귤/만다린/탠저린 계열), 핵과류, 키위, 스타프룻, 비파, 감,
  수박, 석류, 엘더베리, 블랙체리, 레모네이드, 레몬그라스, 금귤, 루바브
- floral: 바이올렛, 벚꽃, 목련, 라일락, 캐모마일, 금목서, 아카시아,
  커피꽃, 얼그레이, 우롱차
- spice: 타마린드, 로즈마리, 리코리스
- sweet: 토피, 사탕수수, 시럽, 연유, 크림브륄레, 머랭, 태피, 솜사탕, 콜라
- green: 유칼립투스
- nutty: 옥수수, 오트, 군밤, 군고구마, 피스타치오
- body: 샴페인

### 1.3 되돌린 alias (테스트 계약)

- 와이니 += white wine, 화이트 와인, red wine, 레드와인 → **제외(되돌림)**.
- 사유: `scripts/test-tasting-note-evidence.cjs`가 '화이트 와인'을 의도적으로
  미인식 증거(pending)로 고정하고 있다. 기존 테스트 수정 금지 규칙에 따라
  alias를 뺐다. 와인 노트 추가는 별도 결정이 필요.

## 2. 시뮬레이션 방법 (시뮬레이션 추정치)

- `audit/tools/simulate-renormalize.mjs <입력> <출력>`:
  각 상품의 `tastingNoteEvidence[].text`(reviewReason 제외)를
  `normalizeTastingNotes(texts, { limit: 5, explicitEvidence: true })`로 다시 정규화해
  `product.tastingNotes`에 저장. 이 호출 형태는
  `electron/githubPublisher.cjs` `preservePreviousTastingNotes`의 실제 발행 경로와 동일.
- `docs/products.json` → `/tmp/simulated-products.json` (tastingNotes 변경 115/462 상품).
- `npm run audit:data -- /tmp/simulated-products.json --before docs/products.json` 로 전후 비교.

## 3. 시뮬레이션 전후 비교 (시뮬레이션 추정치)

| 항목 | 건수 |
|---|---|
| 복구된 값 | 21 (golden 커버 18 + current_echo 3) |
| 사라진 값 | 0 |
| 맞다가 틀려진 값 | 0 |
| 새로 생긴 거짓양성 | 0 |
| 해소된 거짓양성 | 0 |
| 바뀐 상품 | 21 |

- `audit:data` exit 0 (회귀 0건).
- 복구된 golden 커버 18건: cafedoan-13246237051(토피), cafedoan-13094420210(키위·건살구),
  cafedoan-12900247002(허니서클), cafedoan-12844471045(태피·락틱·크림),
  cafedoan-12769121036(향신료), cafedoan-11754531954,
  namusairo-30(엘더베리), namusairo-1090(벚꽃), namusairo-345(피스타치오·크림브륄레),
  namusairo-42, coffee502-9(토스트), coffee502-10(블랙 슈가),
  coffee502-121(감귤), coffee502-178(사탕수수), werk-572(홍옥·시나몬),
  werk-575(황도), werk-558(건자두), werk-545(군고구마).
- current_echo 복구 3건: cafedoan-13627490056, cafedoan-13627488760, cafedoan-9628182790.

### 3.1 정적 베이스라인 참고 (발행 전 스냅샷 기준, tastingNotes)

| 조합 | Correct | Wrong | Missing |
|---|---|---|---|
| 구 사전 + 구 도구 (기존 regression-report.md) | 127 | 36 | 8 |
| 구 사전 + 신 도구(§4 수정) | 127 | 36 | 8 (동일 — 도구 수정이 기존 수치에 영향 없음) |
| 신 사전 + 신 도구 (정적) | 114 | 49 | 8 |

- 정적 13건 Correct→Wrong은 전부 "발행 대기 복구"다: 새 comparable이 복구 노트를
  기대하지만 구 발행 데이터에는 아직 없어 Wrong으로 찍힌 것.
  시뮬레이션(§3)에서 이들이 전부 복구됨을 확인 (맞다가 틀려진 값 0건, exit 0).

## 4. 감사 도구 수정 (원인 분석 결과)

시뮬레이션 초기 "맞다가 틀려진 값" 16건이 발생했다. 전수 분석 결과 16건 모두
golden `value`(HIGH)에 명시되고 golden `droppedByNormalizer`에
`dictionary-miss`로 기록된 진짜 복구였다 (예: evidence "TOFFEE" → 토피).
원인은 `audit/tools/audit-data.mjs`가 golden에 캐시된 `comparable`
(구 사전 기준)을 그대로 써서 새 alias 복구를 오판한 것이다.
alias를 빼는 것은 golden의 HIGH 판정과 FIX-1 목표에 반하므로, 원인을 고쳤다:

- `fieldsEqual`의 tastingNotes 분기: 캐시된 `comparable` 대신
  `goldenRec.raw`를 **현재 정규화기**로 항상 재계산.
- 구 사전 기준으로 재계산 결과가 캐시와 454건 전부 일치함을 별도 검증
  (`git show HEAD:...` 구 파일로 전수 비교, mismatch 0) → 기존 리포트 수치 무영향 (§3.1 표 확인).

## 5. 스킵한 miss 토큰 54개 (추가 안 함)

- generic: 꽃, 사탕, 설탕, 과일, 와인, 잼
- 질감·바디: 무거운 질감, 무거운 바디, 부드러운 촉감, sticky mouthfeel, 고소함
- 서술·평가: 향긋한, 톡 쏘는, Mellow, 클린, Fruity, Crisp Finish, 달콤한,
  과일류 향미, 향기로운 과일 향기, 빨간 & 보랏빛 과일, 노란 과일, 보랏빛,
  잘 익은 과일의 산미, 부드러운 산미와 단맛, 농축된 단맛, 짙은 단맛의 여운이 남는 커피,
  깔끔한 여운, 깔끔한 뒷맛, 깔끔함, 깊은 여운, 깊고 진한 풍미, 부드럽다,
  버터처럼 부드럽다, 풍부하고 편안한, 깨끗하고 달다, 복합미, 게샤 플레이버,
  클래식, 여름, bright acidity, gentle acidity,
  기분 좋은 산도감의 조화로운 균형감, 잔잔한 산도감이 매력적인 디카페인,
  루이보스 티의 여운, 사탕 후미, 락 캔디, 구미베어
- 불명확·특이: 구운디(오타/OCR 의심), 땅콩크래커, 샬롯(향신 채소, 커피 노트로 채택 보류),
  Job's Tears(율무, 영어 대응만으로 채택 보류), leskende/Fyldig og søt(노르웨이어 서술어)

## 6. 테스트 출력 요약 (전부 통과)

- tasting-notes:test — 67/67 checks passed
- core-features:test — 핵심 기능 계약 테스트 통과
- dataquality:test — 데이터 품질 검증 통과
- iphone-webapp:test — 통과
- history:test — 통과
- safety-guards:test — 통과 (게시 가드·타임아웃 하한 유지)
- map:test — 실데이터 462개 전수 검증 통과
- contract:test — 통과
- audit:test — ALL PASS
- `npm run audit:data -- /tmp/simulated-products.json --before docs/products.json` — exit 0

## 7. Reviewer에게 (검증 요청)

1. §1.1·§1.2 alias 중 서술형·질감어가 섞이지 않았는지 (특히 '시럽','콜라','샴페인','감','밤' — 1~2음절 짧은 alias의 오매칭 여부).
2. §5 스킵 목록에서 살려야 할 실제 노트가 있는지 ('샬롯' 보류 판단).
3. §4 도구 수정이 정당한지 (구 사전 454건 일치 검증 기록 있음).
4. 사라진 값 0건, 새로 생긴 거짓양성 0건 재확인.

## 산출물

- `src/services/tastingNotes.js`, `src/services/tastingNotes.cjs` (미커밋)
- `audit/tools/simulate-renormalize.mjs` (신규)
- `audit/tools/audit-data.mjs` (comparable 재계산 수정, §4)
- `/tmp/simulated-products.json` (시뮬레이션 산출물, 임시)

## 8. Reviewer 판정 — 승인 (커밋 가능, 2026-09-26)

별도 Reviewer Agent가 §7의 4개 검증 요청을 독립 재실행으로 전부 확인:

1. **alias 선별 PASS** — 추가분 전수 점검, 서술형·질감어·generic 혼입 없음. '감'·'밤' 오매칭 실증 테스트: golden raw/value 541건 + evidence 전체 코퍼스에서 오탐 0건, 적대적 케이스('감미로운','감칠맛','감자','민감','밤하늘','초코밤','야간') 전부 미매칭.
2. **'샬롯' 보류 타당 PASS** — 향신 채소로 커피 노트로서 이례적, OCR 노이즈 가능. 'Job's Tears' 보류도 타당.
3. **와인 alias 제외 타당 PASS** — `scripts/test-tasting-note-evidence.cjs:177`이 `getPendingTastingNotes(...) == ['화이트 와인']` 고정. 테스트 수정 금지 규칙 하에서 제외는 올바른 판단.
4. **audit-data.mjs 도구 변경 정당 PASS** — 454/454 일치 독립 재현 (구 정규화기 + 신 도구 = 기존 수치 동일). comparable은 (golden raw, 정규화기)의 순수 함수이며 캐시는 stale 파생물. 단, 향후 정규화기 **재매핑**(기존 매핑 변경) 시에는 도구가 오매핑을 잡아내지 못하므로 휴먼 리뷰 필요 — 코드 주석에 명시됨.
5. **독립 재실행 PASS** — 8개 스위트 전부 통과 (tasting-notes 67/67, core-features, dataquality, iphone-webapp, history, safety-guards, map 462개 전수, contract) + audit:test ALL PASS.
6. **시뮬레이션 독립 재현 PASS** — `/tmp/reviewer-sim.json`: 복구 21건(golden 커버 18 + current_echo 3: cafedoan-13627490056, cafedoan-13627488760, cafedoan-9628182790), 사라진 값 0, 맞다가 틀려진 값 0, 새 거짓양성 0, 해소된 거짓양성 0 → exit 0. 호출 형태가 `electron/githubPublisher.cjs:301 preservePreviousTastingNotes`의 실제 발행 경로와 일치함을 코드 대조로 확인.
7. **무관 상품 변화 없음 PASS** — 복구 21건 전부 tastingNotes 필드만, 다른 필드 등급 변화 0건.

참고 의견 (반려 사유 아님): '루이보스 티의 여운'은 추후 alias 후보로 메모. "시뮬레이션 추정치" 표기 적절 — 실제 발행 후 수치 확정 필요.

**최종 판정: 승인. 수정 지시 없음.**
