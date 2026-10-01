# 커피 품종 17종 콘텐츠 조사 보고서

- 작업 브랜치: `muse/variety-research` (main 대상 draft PR)
- 산출물: `research/varieties/varieties.json` (17품종 × 6칸), 본 보고서
- 조사일: 2026-10-01
- 목적: BeanPick 아이폰 웹앱 "빈픽 추천 등급" 품종 설명 카드의 조사 자료. 사전식 설명이 아니라 일반 커피 애호가가 읽는 "세계에서의 위상" 중심 콘텐츠.

## 조사 방법

- 3개 리서치 에이전트에 품종을 나누어 병렬 조사 (geisha·typica·bourbon·sl28·chiroso / sidra·pink-bourbon·pacamara·mocha·ethiopian-landrace / sl34·eugenioides·wush-wush·laurina·catuai·castillo·maragogype).
- `browser.deep_research`는 서브에이전트 환경에서 지원되지 않아, 웹 검색 + 페이지 원문 확인으로 교차 검증했다. URL은 검색 결과가 돌려준 Full URL을 그대로 복사했으며 짐작으로 만든 URL은 없다.
- 권장 출처 우선순위: World Coffee Research Varieties 카탈로그·Cup of Excellence·Best of Panama 경매 공식 결과·World Barista Championship 기록·SCA·각국 커피협회 > Perfect Daily Grind·Barista Hustle·Sprudge 등 업계 매체 > 블로그·쇼핑몰 문구(보조로만).
- status 기준: verified=1차/공신력 출처로 확인, weak=업계 매체 1곳뿐이거나 간접 추론, none=근거 못 찾음(빈 문자열). 해마다 바뀌는 숫자(경매가·점유율·대회 결과)에는 연도를 붙였고, 확인할 수 없는 연도는 "(연도 미표기/미상)"으로 명시했다.
- 품종별 "판매량" 통계는 17품종 전부에서 공개 자료를 찾지 못했다. 지어내지 않고 생산 점유율·경매가·대회 기록·재배국 수 같은 간접 지표를 썼으며, 간접 지표라는 사실을 각 production 칸 text에 명시했다.

## 품종별 칸 채움 현황

| 품종 | intro | reputation | production | distribution | specialty | trivia | v/w/n |
|---|---|---|---|---|---|---|---|
| geisha | v | v | w | v | v | v | 5/1/0 |
| typica | v | w | v | w | w | w | 2/4/0 |
| bourbon | v | w | w | w | w | w | 1/5/0 |
| sl28 | v | v | w | w | v | v | 4/2/0 |
| chiroso | v | w | w | w | w | w | 1/5/0 |
| sidra | w | w | w | w | w | w | 0/6/0 |
| pink-bourbon | w | w | w | w | w | w | 0/6/0 |
| pacamara | v | v | w | w | w | w | 2/4/0 |
| mocha | w | w | w | w | w | w | 0/6/0 |
| ethiopian-landrace | v | w | w | w | w | w | 1/5/0 |
| sl34 | v | v | w | w | w | v | 3/3/0 |
| eugenioides | w | w | w | w | w | w | 0/6/0 |
| wush-wush | w | v | w | w | w | w | 1/5/0 |
| laurina | v | w | w | w | w | w | 1/5/0 |
| catuai | v | v | w | v | w | v | 4/2/0 |
| castillo | v | v | w | w | w | v | 3/3/0 |
| maragogype | v | v | w | w | w | v | 3/3/0 |
| **합계** | **12/5/0** | **8/9/0** | **1/16/0** | **2/15/0** | **2/15/0** | **6/11/0** | **31/71/0** |

(v=verified, w=weak, n=none. 전체 102칸 중 verified 31, weak 71, none 0)

## 출처가 서로 다르게 말한 내용과 채택

1. **geisha, Best of Panama 첫 출품 연도**: GCR 인터뷰·The Business Year 등은 2004년, WCR 카탈로그는 2005년으로 기록 → text에 "(WCR은 2005년으로 기록)"을 병기했다. 별도 확인한 GCR 2026년 3/4월호도 2004년·94.1점으로 기록한다.
2. **geisha, 2004년 경매가**: 1차 증언(Rachel Peterson·Wilford Lamastus)은 파운드당 21달러로 일치, Wikipedia는 파운드당 350달러 → 21달러를 채택했다. 별도 확인한 GCR 2026년 3/4월호도 2004년 US$21/lb, 2013년 US$350.35/lb로 기록하므로 Wikipedia는 2013년 기록을 2004년과 혼동한 것으로 판단했다.
3. **bourbon·typica 관계**: PDG(2026)는 "버번=티피카의 자연 돌연변이"라고 서술하나 WCR은 버번을 독자적 유전 그룹으로 분류 → WCR 서술을 따랐다.
4. **sl28 선발 연도**: Daily Coffee News는 1931년 발표, Sweet Maria's는 1935년 선발 → "1930년대 초"로 서술하고 두 기록을 sources에 병기했다.
5. **chiroso 계통**: 현지 통념 '카투라 돌연변이' vs Montagnon et al.(2021) 핵 DNA 연구의 "에티오피아 재래종·카투라/버번과 무관" 결론 → 후자를 주로 쓰되 확정 표현을 피했다. 이름 유래도 복수설(아치라 과자설·'치로' 속어설·'호하 치로사'설)을 병기했다. WCR 카탈로그에 Chiroso 항목이 없어 등록 주장은 기재하지 않았다.
6. **sidra 계통**: Bourbon×Typica 교배설(Royal Coffee, Cafe Imports) vs 에티오피아 재래종 유사 유전자 검사 결과(PDG) vs WCR "명확한 유전 정체성이 없을 수 있음" → 확정 표현을 피하고 3개 주장을 모두 sources에 남겼다.
7. **pink-bourbon 계통**: 종래 레드×옐로버번 교배설 vs 2023년 Café Imports/RD2 Vision 유전자 검사 "버번과 무관·에티오피아 재래종" → 후자는 과학적 검증이 끝나지 않았다는 PDG의 단서를 함께 적고 양쪽을 모두 기재했다. 명칭 변경 논쟁은 trivia에 넣었다.
8. **mocha 기원**: 레위니옹(부르봉섬) 버번 돌연변이설 vs 예멘 기원설(Belco Coffea Diversa) → 양쪽을 모두 기재했다.
9. **sl34 계통**: 전통 French Mission Bourbon설 vs WCR 유전자 분석(Typica 계통, 기존 이야기가 틀렸을 가능성) → 양쪽을 모두 text에 반영했다.
10. **laurina 발견 시기**: 43factory "16세기" vs Royal Coffee "1770s~19세기 초" vs XLIII "1810년경" → 1770s~1810년 범위로 기술하고 16세기설은 채택하지 않았다.
11. **laurina 카페인 수치**: 특허·PDG "0.6~0.7%" vs 일부 판매자 "0.3~0.5%" → text는 "약 0.6% 안팎"으로 서술하고 상충 주장은 sources에 별도 claim으로 보존했다.
12. **castillo 지역 계열 수**: Cenicafé(2021) "General+7개" vs Daily Coffee News(2019) "16개 변형" → trivia에 불일치를 명시하고 두 주장을 모두 sources에 기재했다.
13. **catuai 점유율**: 블로그의 "브라질 생산의 절반 가까이" 주장은 WCR 원문(온두라스 문맥·연도 미표기)의 확대 해석으로 판단 → WCR 기준 서술만 채택했다.

## 확인 못 한 항목

- 17품종 전부: 품종별 판매량·생산량·국제 생두 시세(비경매 일반 거래) 공개 통계 없음 → production 칸은 전부 간접 지표로 작성.
- geisha: 비경매 일반 거래 생두 시세 자료 없음 (BOP 경매가만 확인).
- typica: WBC 우승 커피 사용 기록 없음, 대표 향미 노트의 1차 출처 부재.
- bourbon: Best of Panama·WBC 공식 기록 없음, 옐로우 버번의 정확한 기원 연도·경위를 뒷받침할 신뢰 출처 없음.
- sl28: 품종별 경매가·재배면적 없음 (케냐 경매는 AA/AB 등급 단위로만 공표).
- chiroso: CoE·BOP 공식 결과 페이지 직접 조회 불가 → 업계 매체 복수 보도로 대체. WBC 2024 우승자(Mikael Jasin) 사용 원두가 치로소인지는 단정 불가 → 미기재. Cenicafé/FNC 공식 입장 미확인.
- sidra·pink-bourbon·mocha: 국제 가격대 공개 지표 없음 (sidra는 2021년 에콰도르 CoE 경매 20위 $29/lb 기록만 확인).
- sl34: 단독 로트 경매가 공개 기록 없음. 96% 소농 조사 수치는 2010년 논문 기준이라 이후 변화(Ruiru 11·Batian 보급)는 별도 서술.
- wush-wush: WBC 사용 기록을 찾지 못함 → reputation은 Coffee Review 점수(2020·2021·2022·2026년 95점) 기반.
- eugenioides: WBC 2021 사용 기록은 Sprudge·PDG 보도만 확인, 공식 기록은 미열람.
- laurina: WCR 카탈로그 전용 페이지 없음 → intro는 유럽특허 EP0606759 + Royal Coffee 기반.
- catuai: WBC 세계 대회 우승 기록 없음 (2009년 영국 바리스타 챔피언십 시그니처 드링크 사용 수준).
- castillo·maragogype: 대회 사용 공식 기록 없음. castillo 단독 품종 생산 비중·국제 시세 통계 없음.
- catuai 온두라스/과테말라 점유율 수치의 원자료 연도 미표기 → "(연도 미표기)"로 명시.

## 편집자 메모 (합본 시 직접 수정한 부분)

- geisha.production의 파나마 생산 비중(0.1%·약 10만 자루): 출처 GCR 기사가 2026년 3/4월호임을 확인해 year 2026 부여.
- geisha.distribution의 코나 게이샤 소매가: 개인 블로그(Substack) 단독 출처를 생산자(그린웰 팜) 자사 블로그 언급(파운드당 100달러·매진)으로 교체. 규칙상 블로그는 보조로만 쓰지만, 생산자 본인의 자사 가격 언급은 1차 진술로 판단.
- chiroso.distribution(영국 £22/250g·미국 $25/4oz), laurina.production(코나 500파운드 미만), maragogype.distribution(£24.5/225g): 소매가·추산치는 확인 연도(2026년 10월)를 명시.
- sl34.production의 소농 조사 96%: 논문(Kirumba & Pinard, AAAE/AEASA 2010)을 별도 확인해 year 2010 부여. "케냐 수출의 최대 80% SL 계열" 추산은 연도 미상임을 명시.
- bourbon.production의 "브라질 재배면적 97.55%"는 로스터 사이트의 WCR 인용 주장임을 claim에 그대로 노출 (2차 인용이므로 확대 해석 금지).
- sl28·sl34.production의 "한때 케냐 커피의 90%"는 역사적 회고 서술이라 연도를 붙이지 않음.

## 완료 조건 체크

- [x] 17개 × 6칸 모두 존재 (none 0건, 전 칸 작성)
- [x] 비어 있지 않은 모든 text에 sources 1개 이상 (스크립트 검증)
- [x] `node -e "JSON.parse(require('fs').readFileSync('research/varieties/varieties.json','utf8'))"` 오류 없이 읽힘
- [x] 새 파일만 생성 (`research/varieties/` 안에만 작성, 기존 파일 무수정)
- [x] draft PR 링크 (아래 최종 보고에 기재)
