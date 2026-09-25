# BeanPick Phase 0 보고서 — 이해와 기준선

- 작성일: 2026-09-25
- 기준 스냅샷: `audit-input/snapshot-products.json` (454건, sha256 `ac7739a73376f125a8a200796391a128b206a4da50582fbfa8e350723e6d0b81` = manifest 주장과 일치 ✅, 내가 `sha256sum`으로 직접 검증)
- 절대 규칙 준수: production 코드 수정 없음 (읽기만), 새 파일은 `audit/` 아래에만, `.env` 미열람, 네트워크 접속 없음, push·merge·배포 없음
- 스펙 지시대로 **Phase 0 완료 후 정지한다. Phase 1은 승인 없이는 시작하지 않는다.**
- **갱신 이력 (2026-09-25 17:44)**: 사용자가 재추출한 `audit-input.zip`으로 교체. "공유 파일 5개에 69건 혼재"는 추출 스크립트 버그로 확정 → 해결됨. 스냅샷 데이터는 동일(sha256 불변), 증거 커버리지 수치(A 76 / B 283 / C 95) 불변. `audit/evidence-coverage.md` 전면 갱신.

## 산출물 (Phase 0)

| 파일 | 내용 |
|---|---|
| `audit/pipeline-map.md` | 파이프라인 전 구간 코드 추적 (스마트스토어/공식몰 경로 분리, 파일·함수·fallback·캐시·실패 시 동작) |
| `audit/evidence-coverage.md` | manifest 커버리지 재계산 검증 + 로스터리별 증거 표 + 판정 가능성 등급 A/B/C |
| `audit/baseline-metrics.json` | 454건 전수 재계산 수치 (재계산 스크립트 `audit/tools/baseline-compute.mjs`) |
| `audit/baseline-report.md` | 기준선 통계 + 스펙 §2 정정표 + "없음" 정의 |

## 1. 증거 커버리지 표와 CASE 1/2 판정 가능 수 추정

manifest 커버리지 7개 수치 전부 재계산 일치(✅). 로스터리별 등급표는 `evidence-coverage.md` §7-1에 전체 기재.

| 등급 | 조건 | 건수 | 의미 |
|---|---|---|---|
| A | 상세 본문 텍스트 있음 | **76** (16.7%) | 독립 판정 가능 (CASE 1/2/3) |
| B | 본문 없음 + 관측/OCR/이미지 URL 있음 | **283** (62.3%) | 제한적 판정 |
| C | 스냅샷 외 증거 없음 | **95** (20.9%) | UNKNOWN 확정 (추정 없음) |

**CASE 1/2 판정 가능 수 추정: A 76건 전건 + B 283건 중 관측 텍스트(213개 관측) 보유분 위주로 약 130~150건 → 총 약 210~230건(46~50%)이 의미 있는 판정 가능. 나머지 ~224건은 B-제한(필드별 CASE 3 대량) 또는 C-확정 UNKNOWN.**

등급별 로스터리 분포 (주요 행):

| Roastery | Total | A | B | C | 공유파일 매핑 |
|---|---|---|---|---|---|
| 에어리커피 | 82 | 19 | 13 | **50** | 0 |
| 카페도안 | 53 | 24 | 29 | 0 | 0 |
| 호커스포커스 로스터스 | 48 | 2 | 31 | **15** | 9 |
| 루비아 커피 | 36 | 8 | 27 | 1 | 26 |
| 필아웃커피 | 32 | 0 | 32 | 0 | 0 |
| 나무사이로 | 29 | 0 | 29 | 0 | 0 |
| 테라로사 | 15 | 0 | 15 | 0 | 0 |
| 커피리브레 | 15 | 0 | 2 | **13** | 5 |
| 모모스커피 | 14 | 0 | 0 | **14** | 0 |
| 말릭커피 | 13 | 13 | 0 | 0 | 3 |

C등급 집중: 모모스 14/14(100%), 커피리브레 13/15(87%), 에어리 50/82(61%), 호커스포커스 15/48(31%). **이는 파이프라인 결함이 아니라 증거 부재이므로 통계 분리 필수.**

추가로 확인된 증거 품질 문제 3건 (증거, Phase 1 주의점):
1. **상세 캐시 233건 중 본문 있는 것은 76건뿐, 157건은 가격 옵션만** (`status:"success"`인데 `detailText:""`, 이미지 URL도 없음 — `products/hocuspocus-5935682761.json` 실측). `hasDetailCache=true`를 "증거 있음"으로 세면 안 되고 `EVIDENCE_UNAVAILABLE`(본문 기준)로 재분류 필요.
2. **OCR 항목은 전부 `gemini|source-notes-v4` 340개 (제품 파일 내 paddle 0개)**. gemini 출력은 이미지 원문이 아니라 모델이 이미 뽑은 노트 목록 JSON (`[{"text":"Apple","group":"","process":"Washed","scope":"product"}]`) — 3개 샘플로 확인. "BeanPick 현재 추출값"이므로 Golden HIGH 근거로 사용 금지.
3. ~~공유 파일 5개 / 74개 상품~~ **→ 재추출본에서 해결됨 (2026-09-25 17:44)**: 454개 파일이 454개 상품 ID와 1:1 매핑, `id`=`snapshotRecord.id`=manifest ID 불일치 0건, manifest 플래그-파일 내용 전수 대조 불일치 0건. 이전 "69건 혼재"는 추출 스크립트 버그였음(한글 ID가 파일명에서 지워져 덮어쓰기). Phase 1에서 파일 단위 원문 인용 가능. 단, `hasEvidenceBeyondSnapshot=true`이나 실질 증거가 없는 빈 껍데기 2건(`hocuspocus-11840045264`, `루비아커피-스트로베리초콜릿케이크`)은 여전히 실질 C등급.

## 2. 스펙 §2 사실 정정 (454건 기준 재계산)

| 스펙 §2 주장 (461건 기준) | 재계산 (454건) | 판정 |
|---|---|---|
| 461건 / 품절 155 / 판매 중 306 | **454 / 품절 154 / 판매 중 300** | ❌ 정정 |
| 스마트스토어 333 / 공식몰 128 | **328 / 126** (productUrl 호스트로 판정 — `mall` 필드 없음) | ❌ 정정 |
| 로스터리 21곳 | **21** | ✅ 유지 |
| 판매 중 컵노트 없음 100 (호커스포커스34, 필아웃14, 말릭9, 에어리8, 모모스6, 토치6) | **98 (35, 13, 8, 8, 5, 6)** | ❌ 정정 (모모스 6→5, 호커스포커스 34→35 등) |
| 산지 미판별 114 (블렌드 제외 54) | **114 (블렌드 제외 58)** | △ 전체 유지, 제외분 54→58 |
| 가공 미판별 100 | **raw 328 / displayed 103** — 기준 불명확. raw 기준이면 328건 전부 빈 문자열 | ❌ 정정 |
| `roastLevel === '확인 필요'` 434 | **427** (실제 단계값 27건은 전부 공식몰) | ❌ 정정 |
| naverShoppingSearch.cjs ~1767행 origin: source.roasterName, ~1769행 roastLevel: '확인 필요' | **정확히 1767행 / 1769행** (`normalizeSmartStoreCategoryItem`). 후속 `applySmartStoreDetailInfo`(585~614행)는 가격/옵션/용량만 반영하고 origin/process/roastLevel을 포함하지 않아 **고정값이 products.json까지 그대로 유지** — 코드 추적 확정 | ✅ 사실 확정 |
| CI는 10종 중 6종 실행 (빠진 map/officialmall/smartstore/contract) | `.github/workflows/publish-iphone-snapshot.yml` 60~67행: tasting-notes, core-features, dataquality, iphone-webapp, history, safety-guards만 실행. **빠진 4종 확인**. `package.json`의 `verify`는 10종 전부 포함하지만 워크플로에서 미사용 | ✅ 사실 확정 |
| tastingNotes.js vs .cjs는 export 외 동일 | **522행 중 1행 차이** (export{} vs module.exports) — 수동 동기화 구조의 드리프트 리스크만 기록 | ✅ 사실 확정 |

### 핵심 분류 정정 (파이프라인 실측)
- **스마트스토어 산지·가공·로스팅은 PARSER_MISS가 아니라 NOT_IMPLEMENTED**: 328건 전체가 수집 단계에서 `origin=roasterName`, `process=''`, `roastLevel='확인 필요'` 고정 대입. 상세 단계가 이 세 필드를 덮어쓰지 않음. Golden diff의 failureReason은 이 세 필드에 대해 `NOT_IMPLEMENTED`로 분류하고 "파서가 놓친 것" 통계와 분리.
- **origin=로스터리명 328/454(72.2%)은 사용자에게 보이지 않는다**: displayed에서 로스터리명 노출 0건 — `findCountryDisplay`(coreFeatures.js:591~592) 가드가 구조적으로 건너뛰기 때문. displayed 산지 정확도 340/454(74.9%). raw 기준만 재면 스마트스토어 산지 정확도가 0%에 가깝게 왜곡됨 — 스펙 §3-1 가설을 실측으로 확정. 등급 제안: **P2** (사용자 보이는 오동작 0건이지만 raw 지표 72%p 왜곡 + 조용히 깨질 수 있는 구조).
- **디카페인 판정 28건 중 origin이 좌우한 건 0건.**
- 부수 발견: `COUNTRY_DISPLAY_RULES`에 부룬디 항목 누락 (`NOMAD COFFEE … Burundi Gahahe Washed`) — 표시 사전 커버리지 문제.
- `audit-input/wiki/` 없음, `.wiki/`도 clone에 없음 (`.gitignore` 명시) — 사건 기록 없이 진행, 추측하지 않음.

## 3. 기준선 핵심 숫자 (displayed 기준, raw 병기)

| 필드 | raw 없음 | displayed 없음 |
|---|---|---|
| 산지 | 328 (로스터리명 고정 328) | **114** (블렌드 제외 58) |
| 가공 | 328 (전부 빈 문자열) | **103** (판매 중 84) |
| 품종 | 420 | **324** (이름 규칙으로 107건 복구) |
| 로스팅 | 427 (`확인 필요`) | **427** |
| 컵노트 | 188 | **188** (판매 중 98 — 호커스포커스35/필아웃13/말릭8/에어리8/토치6 = 전체의 71%) |

상품 유형: single 314 / blend 59 / decaf 28 / other 53 (dripbag·capsule·ground·goods 0 — 코드에 유형 분류 함수 없어 우선순위 규칙 문서화 적용).

## 4. Phase 1 계획

- **배치**: 25건 단위 × 19배치 (454건). C등급(UNKNOWN 확정 95건)은 판정 없이 배치 파일에 `UNKNOWN`으로 기록만 하고 검토 리소스를 A/B에 집중. **실질 판정 대상 ≈ 359건(A 76 + B 283).**
- **배치 구성**: 로스터리가 섞이도록 셔플하되(결정적 seed 20260925, 라운드로빈 혼합 — `audit/golden/batches.json`), C등급은 건너뛰지 말고 명시적으로 `EVIDENCE_UNAVAILABLE`/`UNKNOWN` 기록. 재추출본에서 파일 1:1 매핑이 해결되어 모든 상품에 파일 단위 원문 인용 가능(`audit-input/products/<id>-<hash>.json`).
- **공통 입력**: `audit/golden/current-values.json` — 상품별 current.raw/displayed를 실제 앱 함수로 계산한 값. 배치 코디네이터 전원이 동일 값을 사용.
- **판정 프로토콜**: `audit/PHASE-1-PROTOCOL.md` (Reviewer A/B 독립 판정, B는 current 블라인드·다른 순서, Judge, Quality Auditor, Coffee Domain Reviewer, diff는 displayed 기준).
- **판정자 구성**: Reviewer A (BeanPick current 값 제공, 상품 순서 셔플), Reviewer B (current **숨김**, 다른 순서). 핵심 필드(origin·process·variety·roast·tastingNotes·productType) A≠B 시 Judge가 원문 재독. Batch마다 Quality Auditor (증거 없는 HIGH, 로스터리↔산지·국가↔지역·가공↔로스팅 혼동, AI 생성 컵노트, 없는 품종 생성, 굿즈를 커피로, 블렌드를 싱글로, 품절을 종료로) + Coffee Domain Reviewer (게이샤=품종, 구지=지역, 무산소=가공 수식어 등).
- **결정적 추출 먼저**: 상품명·상세 텍스트 명시값(국가명, Washed/내추럴 등)은 스크립트로 후보 뽑고 AI 판정자는 검증+애매 판정.
- **스마트스토어 산지/가공/roastLevel은 NOT_IMPLEMENTED로 선분류** — CASE 1 버그 후보 통계에서 제외하고 별도 표기.
- **예상 판정 불가 비율**: 확정 UNKNOWN 95건(20.9%) + B등급 내 필드별 CASE 3 대량 예상 (OCR만 있는 상품의 산지/가공/품종/로스팅, 상세 이미지 URL만 있는 상품). 필드별 추정: 산지 ~15%, 가공 ~30%, 품종 ~50%, 로스팅 ~70%, 컵노트 ~25%가 최종 UNKNOWN/CASE 3 예상.
- **출력**: `audit/golden/batch-NNN.json` (배치마다 즉시 저장), 최종 `audit/golden-products.json`. 원문 인용+출처+confidence 필수 보존.

## 5. 추가로 필요한 자료 (사용자가 로컬에서 더 뽑아줄 수 있는 것)

1. **상세 이미지 원본 (또는 더 많은 상세 본문 텍스트)**: 이미지 URL만 있는 77건 중 텍스트 증거가 없으면 CASE 3/OCR_MISS? 처리. 특히 판매 중 컵노트 없음 98건이 집중된 호커스포커스(35)·필아웃(13)·말릭(8)·에어리(8)·토치(6)의 상세 이미지/본문.
2. **스마트스토어 상세 본문 재추출**: 157건(가격 옵션만 있는 캐시)에 대해 로컬에서 본문이 실제로 있는지 — 네이버가 본문을 안 주는지, 수집이 놓치는 건지 구분 필요. 이게 Phase 1의 CASE 1/2 판정 가능 수를 크게 바꿈 (현재 ~210~230건 → 최대 ~360건).
3. **공유 파일 5개(`_-_.json` 등)에 매핑된 69건의 개별 증거** (있다면): 현재 manifest 플래그와 파일 내용이 불일치.
4. `.wiki/` 사건 기록 (있다면): clone에 없어 과거 사건 반영 못 함.

## ⛔ 정지

Phase 0 완료. **승인 없이는 Phase 1을 시작하지 않는다.** 승인 시 위 4번 계획대로 진행한다.
