# BeanPick Phase 1 결과 정리 4 — [4] 원래 의미 반영 (배치 1~10)

- 작성: 2026-09-25
- 배경: [4]의 "OCR 순환 83건"은 내 오해석이었다. 원래 의미는 **OCR 순환(circularity)** —
  golden과 current가 같은 OCR 출처를 공유해 정확도 측정이 순환 논리가 되는 문제.
  내가 찾은 "OCR 텍스트 교차 반복"은 별도 발견으로 유지한다.

## [A] OCR 순환 — evidenceKind 도입

### 대상 확정
`tastingNotes` 중 `evidenceSource`가 OCR 단독(`evidence.ocr`/gemini)이고
`confidence=MEDIUM`인 건 → **82건** (사용자 실측과 일치).

### text_confirmed 판정
`detailText`/`rawObservations` 텍스트에 OCR 노트가 그대로 있는지 전수 대조
(공백 제거·소문자 정규화 후 부분 문자열 매칭, 노트의 절반 이상 일치 기준).
결과: **82건 전부 `current_echo`**, `text_confirmed` 0건.
텍스트 원천이 있는 일부 상품도 그 텍스트는 페이지 보일러플레이트(네비게이션·상품 목록)라
노트와 무관했다. 노트는 상세이미지에만 있고 OCR이 유일한 추출 경로인 구조.

→ 82건 전부에 `evidenceKind: "current_echo"` 추가 완료.

### tastingNotes 정확도 재계산 (golden vs current displayed, 토큰 집합 비교)

| 구분 | 정확도 |
|---|---|
| 전체 (평가 가능 146건) | 27/146 = **18.5%** |
| current_echo 제외 (64건) | 11/64 = **17.2%** |
| 제외된 current_echo 82건의 내부 일치율 | 16/82 = 19.5% |

주: "항상 일치"가 아닌 이유 — golden은 OCR 원문 영어(`ROASTED ALMOND`)를,
displayed는 번역·정규화된 값(`볶은아몬드`)을 담는 경우가 많다
(예: toch-10130602320). 출처는 같지만 파이프라인 단계가 달라 문자열 일치가 낮다.
그럼에도 **독립 정확도가 아니라 파이프라인 일관성을 재는 것**이므로 통계 제외는 정당하다.

### 회귀 하네스 규칙
`audit/regression-rules.md` §9에 명시: current_echo는 정확도·정밀도·재현율에서 제외,
**"기존 값 사라짐" 감지에만** 사용 (displayed에서 노트가 통째로 사라지면 알림).

## [B] OCR 교차 반복의 영향 확인

### imageUrl 구분
실질 교차 블록 5개(로스터리 교차, 빈 `"[]"` 블록 제외) — **전부 상품별 imageUrl이 다름**.
동일 이미지를 공유한 사례 0건 → **모델 반복 출력 또는 OCR 캐시 오염** (공유 이미지 아님).

| 블록 | 상품 | imageUrl |
|---|---|---|
| Jasmine/Peach/Honey/Black Tea | 4 (cafedoan·아이덴티티) | 4개 전부 다름 |
| Peach/Jasmine/Earl Grey/Honey | 4 (cafedoan·아이덴티티) | 4개 전부 다름 |
| Jasmine/Peach/Honey/Black Tea (한글) | 3 (cafedoan·루비아) | 3개 전부 다름 |
| 복숭아/자스민/얼그레이/꿀 | 3 (cafedoan·루비아) | 3개 전부 다름 |
| 복숭아/얼그레이/자스민/꿀 | 3 (cafedoan·히떼) | 3개 전부 다름 |

### displayed 노출 여부
교차 블록 **전체 세트가 displayed에 노출된 상품: 0건**.
부분 겹침은 최대 1/4개 노트 (꿀·복숭아 — 일반 노트라 우연 범위).
→ **앱 표시 오염 없음. 수정 우선순위 낮음.**
단, golden 판정 시 CASE 3(UNKNOWN) 원칙은 유지 — 이미 b1 cafedoan-6199336952는
UNKNOWN으로 강등했고, 나머지 연루 상품의 golden tastingNotes도 OCR 단독 MEDIUM이면
[A]의 current_echo로 통계에서 제외된다.

## [C] 도메인 규칙 위반 — 잔여분 처리

### 질감어 5건 제거 (raw 보존)
| 상품 | 제거 | 제거 후 |
|---|---|---|
| toch-10130602320 | SWEET | ROASTED ALMOND, 다크초콜릿, CACAO, LONG AFTERTASTE |
| fritz-1290 | 마일드한커피 | 감귤, 시럽, 캐슈넛 |
| toch-10130617351 | JUICY | 블루베리, GRAPE, POMEGRANATE, CRANBERRY |
| cafedoan-11382491273 | 복합성, 달콤함 | 빨간&보랏빛과일, 플로럴, 노란과일, 클린 |

('클린'은 경계 사례로 유지 — clean cup은 커핑 용어로 볼 여지. 'Sweet mandarin'(b1)은
복합 향미 노트라 대상 아님.)

### decafMethod 분리 — 10건 + 1건
`process`에는 본래 가공만, 디카페인 가공법은 `decafMethod` 신설 필드로 분리.
normalized 표기 통일: `Mountain Water` / `Swiss Water` / `E.A` / `Sugarcane` / `Sugarcane E.A`.

| 상품 | process (변경 후) | decafMethod |
|---|---|---|
| malik-11068505354 | 내추럴 (HIGH) | Mountain Water (HIGH) |
| deepbluelake-571 | SOURCE_MISSING | Mountain Water (MEDIUM, OCR 전용) |
| 히떼로스터리-콜롬비아엑셀소디카페인 | SOURCE_MISSING | Mountain Water (HIGH) |
| centercoffee-133 | 내추럴 (HIGH) | Swiss Water (HIGH) |
| 로스터릭-콜롬비아e-a디카페인 | SOURCE_MISSING | E.A (HIGH) |
| fritz-982 | SOURCE_MISSING | UNKNOWN (원문에 가공법 미명시) |
| coffee502-178 | 내추럴 (HIGH) | Mountain Water (HIGH) |
| werk-545 | SOURCE_MISSING | E.A (HIGH) |
| toch-12166525780 | SOURCE_MISSING | Sugarcane E.A (HIGH) |
| 아이덴티티커피랩-콜롬비아엑셀소디카페인마운틴워터 | SOURCE_MISSING | Mountain Water (HIGH) |
| coffeejg-13698642367 | 써멀쇼크 (HIGH) | Sugarcane (HIGH) ← 자동 검사가 추가 발견 |

fritz-982의 기존 process '디카페인'(HIGH)은 가공방식이 아니므로 제거.
원문에 본래 가공 정보가 없는 7건은 process → SOURCE_MISSING (원문 확인·정보 없음).

### Quality Auditor 자동 검사 3종
`audit/tools/quality-auditor-checks.py` 신규:
1. 질감어 사전 (정확 일치 — 'Sweet mandarin' 같은 복합 노트는 제외)
2. process에 블렌드/디카페인/디카페인 공정어 포함
3. evidenceKind 누락된 OCR 단독 MEDIUM (tastingNotes)

배치 1~10 전체 실행 결과: **위반 0건** (초기 실행에서 coffeejg-13698642367 1건을
잡아내 분리 후 0건 달성 — 검사가 실제로 동작함을 증명).
프로토콜 §7에 자동 검사 3종 명시, 회귀 규칙 §9·§10 추가.

## 변경 파일
- `audit/golden/batch-001.json` ~ `batch-010.json` (evidenceKind 82건, 질감어 5건, decafMethod 11건)
- `audit/tools/quality-auditor-checks.py` (신규)
- `audit/regression-rules.md` (§9 current_echo, §10 decafMethod)
- `audit/PHASE-1-PROTOCOL.md` (§7 자동 검사 3종)
- `audit/PHASE-1-RESULTS-4.md` (본 파일)

## 다음 단계
- 배치 11~19 (204건)는 지시대로 **아직 진행하지 않음**
- 배치 11 시작 전: Judge 판정 기록 파일화 (RESULTS-3), OCR 스키마에 roast 추가 검토 (recommended-fixes)
