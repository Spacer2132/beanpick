# PHASE-1 중간 보고 5 — status 템플릿 라벨 오판정 정정 (2026-09-25 23:10 KST)

INTERIM-4 §8-1의 후속. 배치 1~15의 status=soldout HIGH이면서 isSoldOut=false이고
템플릿 근거인 항목을 전수 정정했다.

## 1. 정정 대상 확정

### b2 원본 검증 (evidence 파일이 저장소에 없어 원본 대조)
`audit-input/products/namusairo-1135-91f47443.json` ·
`namusairo-1096-e3f46c5b.json`의 SOLD OUT 문맥:

> …할인가가 적용된 최종 결제예정금액은 주문 시 확인할 수 있습니다.
> **SOLD OUT** 장바구니 관심상품 바로구매하기 예약주문하기 정기배송 무이자 할부혜택…

b3~15 namusairo 21건의 템플릿과 바이트 단위 동일 순서 → **정정 진행**.

### 전수 스윕 결과 (배치 1~15, status=soldout 103건 중)
수집 플래그(isSoldOut=false)와 충돌하면서 "원문 우선"으로 soldout HIGH를 준 항목 **11건**.
전부 구매 버튼 영역 템플릿 라벨로 판정 (원본 문맥 대조):

| 배치 | 상품 | 템플릿 문맥 |
|---|---|---|
| b2 | namusairo-1135 · namusairo-1096 | 결제예정금액 안내 / SOLD OUT / 장바구니 / 관심상품 / 바로구매하기… |
| b2 | deepbluelake-571 | BUY NOW / ADD TO CART / SOLD OUT / WISH LIST |
| b2 | coffee502-9 | 결제예정금액 안내 / SOLD OUT / 바로 구매하기… |
| b2 | werk-572 | 장바구니 담기 / 바로 구매하기 / 예약주문 / SOLD OUT |
| b6 | namusairo-1132 · namusairo-1137 | namusairo 템플릿 (위와 동일) |
| b6 | deepbluelake-572 | deepbluelake 템플릿 (위와 동일) |
| b6 | coffee502-154 | coffee502 템플릿 (위와 동일) |
| b6 | werk-568 | werk 템플릿 (위와 동일) |
| b6 | fritz-982 | 장바구니 / 구매하기 / 정기배송 신청하기 / 품절 Sold out |

나머지 92건은 isSoldOut=true (수집 플래그) 근거의 정상 판정 — 손대지 않음.
대조군: b13 namusairo-1146은 isSoldOut=true + 동일 템플릿 문구 → 진짜 품절로 유지.
즉 이 문구로는 품절/판매 중을 구분할 수 없고 유일한 근거는 수집 플래그다.

### 정정 (전후 값)
11건 전부: `soldout / HIGH` → **`active / MEDIUM / collector_flag`**.
evidence에 템플릿 라벨 제외 사유(`regression-rules §9.2`)와 정정 표기 기록.
diff.status는 `match:true`로 재계산 (displayed=active와 일치).
summary 재계산 — status는 정확도 통계에서 제외되므로 mismatch/UNKNOWN 수치 변동 없음.

## 2. 규칙 명문화 (`regression-rules.md` §9.2)

- Cafe24 구매 버튼 영역(장바구니·바로구매하기와 함께 나오는 부분)의 `"SOLD OUT"` 라벨은
  status 근거로 쓰지 않는다.
- status는 isSoldOut 플래그를 기준으로 MEDIUM/`collector_flag`로 판정한다.
- 원문 우선 원칙은 이 템플릿 라벨이 아닌, **본문에 따로 적힌 품절 안내**에만 적용한다.

## 3. 5번째 자동 검사 (2026-09-25 23:40 KST, 데이터 기반으로 교체)

`quality-auditor-checks.py`의 (5)를 데이터 기반으로 교체. FAIL 조건:
**golden status.value ≠ current-values.json의 isSoldOut**(soldout↔true, active↔false).
단, `status.overrideExcerpt`에 구매 버튼 영역이 아닌 본문 품절 안내의 원문 발췌가 있으면 예외
(발췌에 템플릿 마커가 섞여 있으면 예외 무효).

검증 3건 (실행 출력 첨부):
1. 현재 배치 1~15 → 위반 0건
2. 정정 전(커밋 81f61e3) b2·b6 → 11건 전부 FAIL
3. evidence 문구를 `isSoldOut=False`(대문자)로 바꾼 변형 → 11건 전부 FAIL (evidence 문구 무관)

구 검사(정적 문구 매칭)는 evidence 문구 변형에 통과하는 실측 결함이 있어 교체됨.

## 4. 독립성 검사 보강 — 유사 문구 (difflib ≥ 0.8)

(4) 검사는 완전 동일 문구만 잡았으므로, ratio ≥ 0.8(완전 동일 포함) 비율을 함께 계산·출력.
실측:

| 버전 | 배치 | 유사(≥0.8) 비율 |
|---|---|---|
| 오염 (dee8386) | b11 | 96% |
| 오염 (dee8386) | b12 | 98% |
| 오염 (dee8386) | b13 | 79% |
| 오염 (dee8386) | b14 | 70% |
| 오염 (dee8386) | b15 | 99% |
| 정상 | b9 | 21% |
| 정상 | b10 | 40% |
| 정상 (재판정) | b11 | 23% |
| 정상 (재판정) | b12 | 16% |
| 정상 (재판정) | b13 | 15% |
| 정상 (재판정) | b14 | 15% |
| 정상 (재판정) | b15 | 13% |

오염 버전 최소 70% vs 정상 버전 최대 40% → **FAIL 기준 50%**로 확정.
(b10 정상 40%를 넘지 않으면서 오염을 확실히 가르는 값.)

## 5. 완료 기준 검증

- [x] 배치 1~15의 soldout HIGH + isSoldOut=false + 템플릿 근거 항목: **0건**
- [x] 검사 5종, 배치 1~15 전체 **위반 0건** (exit 0) — 실행 출력:
```
  [batch-009] 유사 문구(≥0.8): 36/171=21% OK
  [batch-009] 독립성: evidence 동일 21/171=12%, golden 바이트동일 0건 OK
  [batch-010] 유사 문구(≥0.8): 64/162=40% OK
  [batch-010] 독립성: evidence 동일 3/162=2%, golden 바이트동일 0건 OK
  [batch-011] 유사 문구(≥0.8): 42/181=23% OK
  [batch-011] 독립성: evidence 동일 21/181=12%, golden 바이트동일 0건 OK
  [batch-012] 유사 문구(≥0.8): 32/198=16% OK
  [batch-012] 독립성: evidence 동일 21/198=11%, golden 바이트동일 0건 OK
  [batch-013] 유사 문구(≥0.8): 28/181=15% OK
  [batch-013] 독립성: evidence 동일 19/181=10%, golden 바이트동일 0건 OK
  [batch-014] 유사 문구(≥0.8): 30/198=15% OK
  [batch-014] 독립성: evidence 동일 18/198=9%, golden 바이트동일 0건 OK
  [batch-015] 유사 문구(≥0.8): 24/181=13% OK
  [batch-015] 독립성: evidence 동일 0/181=0%, golden 바이트동일 0건 OK
위반 0건 (검사 대상: 15개 배치 파일)
```
- [x] [4] 오염/정상 측정표 (위 §4)
- [x] 정정 상품 목록 전후 값 (위 §1)
- [x] INTERIM-4 §8-1에 "b6 누락, INTERIM-5에서 정정" 표기

## 다음 단계

배치 16~19 판정 — **사용자 승인 대기**.

> status golden은 템플릿 라벨로 품절을 구분할 수 없어 수집 플래그와 같아지므로, BeanPick status 정확도 검증에는 쓸 수 없다.
