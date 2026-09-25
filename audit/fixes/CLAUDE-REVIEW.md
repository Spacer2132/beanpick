# Muse 산출물 독립 검증 (muse/audit-final · muse/fix-display)

작성: 2026-09-26. 대상 커밋: `43d718b`(audit-final), `2ee50c4`(FIX-1), `89e9cd1`(FIX-2).
측정 기준 스냅샷: `docs/products.json` (main `ddce8a6`, 462건).

## 1. 결론

| 항목 | 판정 | 이 브랜치 반영 |
|---|---|---|
| 감사 산출물(audit/) | 통과 | 반영 |
| FIX-1 컵노트 사전 추가 | 통과 (수정 1건 추가) | 반영 |
| FIX-2 '농장' 표시 억제 | **반려** | 코드 미반영, 문서만 보존 |
| audit-data.mjs comparable 재계산 변경 | **되돌림** | 고정 comparable + `--renormalize-golden` 으로 대체 |

## 2. FIX-1

### 발견·수정
- `샴페인` 규칙이 3곳에 추가돼 있었는데, 그중 2곳은 규칙 목록이 아니라 문자열 목록
  `COUNTRY_ALIASES`(‘태국’ 뒤)와 `NON_TASTE_ALIASES`(‘블랙’ 뒤)에 객체로 끼어 있었다.
  두 곳을 삭제하고 `NOTE_RULES`의 1곳만 남겼다. `.js`·`.cjs` 동일 적용, 두 목록의 비문자열 항목 0건 확인.

### 측정 (발행 경로 시뮬레이션: `simulate-renormalize.mjs`)
- 구 정규화기로 시뮬레이션하면 462건 중 변경 0건 — 시뮬레이션이 현재 발행 결과를 정확히 재현함을 확인.
- 신 정규화기: 115개 상품의 노트가 바뀜.
- `audit:data` (golden 커버 상품): 복구 21, 사라진 값 0, 맞다가 틀려진 값 0, 새 거짓양성 0.
  tastingNotes Correct 114 → 132, Wrong 49 → 32.

### golden comparable 갱신 (`--write-golden --accept-lost`)
- 127개 상품의 golden comparable이 새 사전으로 바뀜 (노트 추가 127).
- 소실 5건은 모두 더 구체적인 노트로 대체된 경우라 수용함:

| 상품 | 소실 | 추가 |
|---|---|---|
| deepbluelake-536 | 초콜릿 | 다크초콜릿, 옥수수 |
| deepbluelake-537 | 초콜릿 | 검은딸기, 다크초콜릿 |
| deepbluelake-538 | 초콜릿 | 검은딸기, 다크초콜릿 |
| 아이덴티티커피랩-콜롬비아엑셀소디카페인마운틴워터 | 구운향 | 군밤 |
| 루비아커피-과테말라안티구아shbep워시드미디엄로스트 | 초콜릿 | 밀크초콜릿 |

### 5개 제한으로 노트가 밀려나는 표시 변화 (462건 전체, 7건)
발행 단계가 노트를 최대 5개만 저장하므로 새로 인식된 노트가 기존 노트를 밀어낸다.

| 상품 | 빠짐 | 들어옴 | 성격 |
|---|---|---|---|
| namusairo-42 | 체리 | 블랙체리 | 구체화 |
| fritz-93 | 차 | 홍차 | 구체화 |
| 루비아커피-과테말라안티구아shbep워시드미디엄로스트 | 초콜릿 | 밀크초콜릿 | 구체화 |
| 아이덴티티커피랩-콜롬비아엑셀소디카페인마운틴워터 | 구운향 | 군밤 | 구체화 |
| terarosa-100531 | 부드러움 | 군밤 | 질감어 제거 |
| malik-5852778445 | 베르가못 | 감귤 | **밀려남** |
| 루비아커피-케냐키리냐가키이aatop워시드다크로스트 | 초콜릿 | 검은딸기 | **밀려남** |

## 3. FIX-2 반려 사유
- 462건 전체에서 농장 표시 42건이 사라진다 (Muse 보고는 golden 범위 22건만 집계).
- 사라지는 값에 실제 농장명이 포함된다: `라 노리아 로트 4`, `라 시리아 로트 3`, `Kotowa Las Brujas Lot 26-124`,
  `핀카 소피아 헤리티지 컬렉션 토르카자 FS10210425`, `산타 테레사 2000 라 밤바 레드` 등.
  원인: 로트 번호·"컬렉션"·"레드"·"허니" 등이 하나라도 들어 있으면 문자열 전체를 비운다.
- 억제 패턴에 `단체|숲|풍요로운 땅|다크우드|그리니` 같은 특정 상품명이 하드코딩돼 있어 golden에 과적합돼 있다.
- 후속: 찌꺼기 토큰만 잘라내는 방식이나 수집 단계의 `product.farm` 확보(FIX-3 계열)로 다시 설계.

## 4. 회귀 도구 변경
- Muse의 변경(golden comparable을 매번 현재 정규화기로 재계산)은 정규화기 회귀를 가린다.
  기본 비교를 golden에 고정된 comparable로 되돌리고 `--renormalize-golden` / `--write-golden` / `--accept-lost` 를 추가했다.
- `audit:test`에 (6) 고정 comparable 비교, (7) 재정규화 소실 감지 테스트를 추가. 15개 검사 모두 통과.

## 5. 테스트
통과: tasting-notes, core-features, dataquality, iphone-webapp, history, safety-guards, map, contract, smartstore, audit.
`officialmall:test`는 수정 전 코드(main)에서도 동일하게 실패한다 — 실제 쇼핑몰에 접속하는 테스트가 이 환경의
네트워크 정책에 막힘("Host not in allowlist"). 로컬 PC에서 다시 확인해야 한다.

## 6. 남은 검증 (로컬)
CLAUDE.md 기준으로 FIX-1은 실제 발행 성공과 `Update BeanPick iPhone snapshot (NNN products)` 커밋 확인까지 해야 완료다.
