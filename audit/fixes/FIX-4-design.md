# FIX-4 설계 — overlap dedup(removeOverlappingNotes)으로 사라지는 실제 노트 (구현 금지, 설계만)

## 현황
`removeOverlappingNotes` (src/services/tastingNotes.js:339)는 구체 노트가 있으면 일반 노트를 삭제한다.
golden 감사에서 실제로 손실된 경우 8건/4개 토큰 (산출: 배치 golden의 droppedByNormalizer reason=overlap-removed):

| 원문 토큰 | 매핑 | 삭제 이유 | 비교 대상 (comparable) | 상품 |
|---|---|---|---|---|
| 카카오 ×3, CACAO ×1 | 초콜릿 | 다크초콜릿 존재 | 다크초콜릿 등 | toch-10130602320, coffee502-10, werk-170, werk-545 |
| 초콜릿 ×2 | 초콜릿 | 다크/밀크초콜릿 존재 | 다크초콜릿/밀크초콜릿 | coffee502-93, lubia-11575853258 |
| Assam Tea ×1 | 차 | 녹차 존재 | 녹차 등 | coffeejg-13685877332 |

## 문제 분석
1. **'Assam Tea' → '차' → 삭제**: Assam은 홍차 계열인데 '녹차'가 있다는 이유로 generic '차'가 삭제됨. 원문의 구체 정보(Assam=홍차)가 완전히 소실. 이건 dedup 로직 문제가 아니라 **사전 매핑 오류** — 'Assam Tea'는 '홍차'로 매핑돼야 한다.
2. **'카카오' → '초콜릿' → 삭제**: 카카오는 초콜릿의 원료로, 맛 표현으로는 구분되는 경우가 많다. '다크초콜릿'이 있으면 '초콜릿'을 지우는 규칙 자체는 합리적이나, 원문이 '카카오'라고 명시했을 때 '카카오'라는 정보가 사라진다.
3. **'초콜릿' → 삭제**: 원문이 plain '초콜릿'인데 구체 변형이 있으면 삭제. 정보 손실은 경미 (구체 변형이 상위 개념을 포함).

## 최소 변경안 (우선순위 순)
### (a) 'Assam Tea' → '홍차' alias 추가 (사전 수정, dedup 로직 변경 없음)
- 효과: coffeejg-13685877332의 'Assam Tea'가 '홍차'로 살아남음 (녹차가 있어도 '차' 삭제 규칙에 안 걸림).
- 위험: 낮음. 기존 '차' 매핑에 의존하던 상품이 있으면 표시 변경 — audit:data 전후 비교로 확인 필요.

### (b) '카카오'를 별도 라벨로 분리 (사전 수정, dedup 규칙 추가)
- '카카오'/'cacao'를 '초콜릿'이 아닌 독립 라벨 '카카오'로 매핑하고, dedup 규칙에 `다크초콜릿/밀크초콜릿이 있으면 '카카오'는 유지` (또는 카카오 계열 별도 처리).
- 효과: 4건 복구.
- 위험: 중간. canonical 어휘에 새 라벨 추가로 golden comparable 재생성 필요 (compute-comparable.mjs 재실행). 표시 어휘가 바뀌므로 사용자 노출 문구 변경.

### (c) dedup를 "원문 보존" 모드로 (로직 변경 — 비추천)
- 삭제 대신 `원문 토큰`을 별도 필드로 보존. 표시 계층 변경이 커서 스코프 밖.

## 권장
(a)는 FIX-1(alias 추가) 작업에 포함 가능. (b)는 별도 결정 필요 (라벨 체계 변경이므로).

## 검증 계획 (구현 시)
1. (a)(b) 적용 후 `npm run tasting-notes:test` + `npm run audit:test` 통과.
2. `npm run audit:data -- <적용본> --before <적용전>` 으로 "맞다가 틀려진 값" 0건 확인.
3. golden comparable 재생성 시 diff 재계산 (recompute-tastingnotes.py)으로 match 수 변화 확인.
