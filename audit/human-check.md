# 사람 검증 샘플 (배치 1~5)

- 추출: 2026-09-25, A/B등급 상품 중 무작위 10건 (seed=20260930)
- 방법: productUrl의 실제 페이지를 보고 golden 값이 맞으면 O, 틀리면 X에 표시
- roast의 "(원문: …)"은 5단계 enum 판정 근거 라벨
- "증거 부족(UNKNOWN)": 해당 필드 원문을 다 확인하지 못한 상태 (증거 부족)
- "원문에 없음": 해당 필드가 있을 수 있는 원문 전부를 확인했으나 정보 없음 (SOURCE_MISSING)

| # | 상품명 | productUrl | originCountry | process | roast | tastingNotes | O | X |
|---|---|---|---|---|---|---|---|---|
| 1 | 피크닉 | https://namusairo.com/product/피크닉/1090/category/91/display/1/ | 콜롬비아 · 에티오피아 | 블렌드 | Medium | 벚꽃, 체리, 파인애플, 쥬시 |  |  |
| 2 | [프릳츠] Herbazu Villa Sarchi Semi Washed | https://fritz.co.kr/product/detail.html?product_no=1290&cate_no=48&display_group=1 | 코스타리카 | 세미 워시드 | 원문에 없음 | 감귤, 시럽, 캐슈넛, 마일드한커피 (원문: 감귤, 시럽, 캐슈넛, 마일드한 커피) |  |  |
| 3 | 배합커피#4 율무 | https://smartstore.naver.com/coffeejg/products/13736416283 | 원문에 없음 | 원문에 없음 | 원문에 없음 | Oats, Job's Tears, 아몬드, 브라운슈가, 밀크초콜릿 (원문: Oats, Job's Tears, Almond, Brown Sugar, Milk Chocolate) |  |  |
| 4 | 콜롬비아 E.A 디카페인 | https://smartstore.naver.com/rick/products/12522832196 | 콜롬비아 | E.A (원문: E.A (ethyl acetate)) | 원문에 없음 | 호박, 캐러멜, 귤 |  |  |
| 5 | 에티오피아 바샤 베켈레 마타란초 내추럴 | https://smartstore.naver.com/identity_coffeelab/products/13718237904 | 에티오피아 | 내추럴 | 증거 부족(UNKNOWN) | Green grape, Strawberry candy, Tropical fruits, Red cherry |  |  |
| 6 | 베르크 하우스 블렌드 | https://werk.co.kr/product/베르크-하우스-블렌드/170/category/1/display/2/?icid=MAIN.product_listmain_1 | 원문에 없음 | 원문에 없음 | 원문에 없음 | 다크초콜릿, 헤이즐넛, 카카오 (원문: 다크 초콜릿, 헤이즐넛, 카카오) |  |  |
| 7 | 케냐 키앙고이 SL28 워시드 원두 | https://smartstore.naver.com/filloutcoffee/products/13684373989 | 케냐 | 워시드 | 증거 부족(UNKNOWN) | 증거 부족(UNKNOWN) |  |  |
| 8 | (토치커피) 글램 앤 모어 블렌드 ( 요청불가) | https://smartstore.naver.com/toch/products/10130617351 | 원문에 없음 | 증거 부족(UNKNOWN) | 원문에 없음 | 블루베리, GRAPE, POMEGRANATE, CRANBERRY, JUICY (원문: BLUEBERRY, GRAPE, POMEGRANATE, CRANBERRY, JUICY) |  |  |
| 9 | 콜롬비아 라 에스페란자 부에노스 아이레스 게이샤 워시드 | https://smartstore.naver.com/toch/products/13663022224 | 콜롬비아 | 워시드 (원문: Washed) | 원문에 없음 |  |  |  |
| 10 | 과테말라 엘 모리토 게이샤 허니몰라세스 공동발효 워시드 원두 | https://smartstore.naver.com/filloutcoffee/products/13622545821 | 과테말라 | 허니몰라세스 공동발효 워시드 | 원문에 없음 | 포도, 자두, 초콜릿 |  |  |

검증자: ______  날짜: ______
