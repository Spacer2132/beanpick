# Regression Report — docs/products.json (2026-09-26)

생성: `npm run audit:data -- docs/products.json` (수집기 미실행, 앱 표시 함수로 displayed 계산).
golden 기준: audit/golden-products.json (454건). --before 없이 현재 상태 스냅샷.
A1 반영: FALSE_POSITIVE 별도 집계 (golden SOURCE_MISSING + 표시값 있음).

- 대상: /home/hatch/workspace/beanpick/docs/products.json
- 상품 수: 461 (golden 커버 433, NEW 28, GONE 21)

## 필드별 Correct/Wrong/Missing (golden UNKNOWN·UNMAPPED_LABEL·current_echo 제외)

| 필드 | Correct | Wrong | Missing | FALSE_POSITIVE | Skip |
|---|---|---|---|---|---|
| originCountry | 275 | 10 | 15 | 3 | 130 |
| process | 227 | 25 | 15 | 28 | 138 |
| producer | 80 | 34 | 3 | 94 | 222 |
| roast | 161 | 5 | 62 | 1 | 204 |
| tastingNotes | 127 | 36 | 8 | 2 | 260 |
| variety | 180 | 18 | 39 | 1 | 195 |

## NEW (golden에 없음, 회귀 아님, 28)
- identity-13771382979
- identity-13771374470
- identity-13771378889
- identity-13651036889
- fillout-13774562980
- centercoffee-418
- centercoffee-417
- centercoffee-415
- coffeelibre-8156
- coffeelibre-7268
- coffeelibre-7252
- coffeelibre-8162
- coffeelibre-8165
- coffeelibre-8153
- coffeelibre-8159
- deepbluelake-579
- deepbluelake-580
- deepbluelake-522
- 로스터릭-에티오피아구지아나소라케베네베샤g1내추럴
- 로스터릭-니카라과라에스페란사카를로스레드카투아이워시드
- ... 외 8건

## GONE (products.json에 없음, 회귀 아님, 21)
- coffeelibre-8132
- momos-7418
- coffeelibre-8144
- centercoffee-408
- momos-7422
- fritz-1290
- fillout-13741415128
- coffeelibre-8150
- fritz-2177
- centercoffee-411
- coffeelibre-8138
- fritz-2213
- centercoffee-414
- coffeelibre-8147
- 히떼로스터리-낙성대
- fritz-1202
- werk-562
- 로스터릭-에티오피아구지함벨라비샨푸구쿠루메내추럴
- coffeelibre-8135
- momos-7407
- ... 외 1건
