import json

F = {
 'namusairo-522': 'audit-input/products/namusairo-522-84953835.json',
 'fillout-13684351661': 'audit-input/products/fillout-13684351661-0758a94d.json',
 '루비아커피-100-에티오피아스칼렛': 'audit-input/products/루비아커피-100-에티오피아스칼렛-84a97bf3.json',
 'hocuspocus-12301405254': 'audit-input/products/hocuspocus-12301405254-3a733d24.json',
 'cafedoan-12759206817': 'audit-input/products/cafedoan-12759206817-f7afcc24.json',
 'namusairo-28': 'audit-input/products/namusairo-28-794fbd26.json',
 'fillout-13752509968': 'audit-input/products/fillout-13752509968-90d12388.json',
 'lubia-9867970184': 'audit-input/products/lubia-9867970184-98855a8b.json',
 'hocuspocus-12523553689': 'audit-input/products/hocuspocus-12523553689-f00447de.json',
 'cafedoan-11754674334': 'audit-input/products/cafedoan-11754674334-7a64fb7a.json',
 'namusairo-27': 'audit-input/products/namusairo-27-b4874945.json',
 'fillout-13673422137': 'audit-input/products/fillout-13673422137-2901674a.json',
 '루비아커피-콜롬비아엘파라이소리치피치라이트로스트가향커피': 'audit-input/products/루비아커피-콜롬비아엘파라이소리치피치라이트로스트가향커피-07fd753c.json',
 'hocuspocus-13639352375': 'audit-input/products/hocuspocus-13639352375-d477e6e7.json',
 'cafedoan-5027185632': 'audit-input/products/cafedoan-5027185632-965de986.json',
 'namusairo-1093': 'audit-input/products/namusairo-1093-8a149a0f.json',
 'fillout-8427587166': 'audit-input/products/fillout-8427587166-d38c2955.json',
 '루비아커피-인도네시아수마트라만델링g1길링바사-웻훌-미디엄로스트': 'audit-input/products/루비아커피-인도네시아수마트라만델링g1길링바사-웻훌-미디엄로스트-e31ea3e5.json',
 'hocuspocus-13639350218': 'audit-input/products/hocuspocus-13639350218-91bc6241.json',
 'cafedoan-9628182790': 'audit-input/products/cafedoan-9628182790-3b34271e.json',
 'aerycoffee-11368384812': 'audit-input/products/aerycoffee-11368384812-51869f78.json',
 '로스터릭-에티오피아예가체프아리차g1워시드중강배전': 'audit-input/products/로스터릭-에티오피아예가체프아리차g1워시드중강배전-13620cc8.json',
}

def pn(i): return F[i] + '#snapshotRecord.productName'
def ro(i): return F[i] + '#evidence.rawObservations'
def ocr(i): return F[i] + '#evidence.ocr'
def dt(i): return F[i] + '#evidence.detailCache.detailText'

def fld(value, raw, confidence, evidence, evidenceSource, **kw):
    d = {'value': value, 'raw': raw, 'confidence': confidence, 'evidence': evidence, 'evidenceSource': evidenceSource}
    d.update(kw)
    return d

def sm(i, note, raw=None, src=None):
    return fld(None, raw, 'SOURCE_MISSING', note, src or ro(i))

B = {}

# 1. namusairo-522 몽상스 (역순 첫 번째)
i = 'namusairo-522'
B[i] = {'golden': {
 'productType': fld('single', '몽상스', 'HIGH', "원산지 'Kenya' 단일 산지 명시", ro(i)),
 'status': fld('soldout', 'SOLD OUT', 'HIGH', "본문 내 'SOLD OUT' 표기 (isSoldOut=false와 불일치하나 원문 우선 — batch-002 namusairo-1135 선례)", ro(i)),
 'originCountry': fld('케냐', 'Kenya', 'HIGH', "원문 '원산지 Kenya'", ro(i)),
 'originRegion': fld('키리냐가', '키리냐가 Kirinyaga', 'HIGH', "원문 '지 역 키리냐가 Kirinyaga'", ro(i)),
 'producer': fld('무티라 협동조합', '무티라 협동조합 Mutira Cooperative Society', 'MEDIUM', "원문 '농 부 무티라 협동조합' — 협동조합을 생산자로 판정", ro(i)),
 'process': fld('워시드', 'Fully Washed', 'HIGH', "원문 '가공법 Fully Washed'", ro(i)),
 'variety': fld('SL28 · SL34 · Ruiru11 · Blue Mountain', 'SL28, SL34, Ruiru11, Blue Mountain', 'HIGH', "원문 '품 종 SL28, SL34, Ruiru11, Blue Mountain'", ro(i)),
 'roast': fld(None, '웰던 Well-done', 'SOURCE_MISSING', "'Well-done'은 5단계 매핑표에 없음 — enum 강제 금지 (batch-011 교훈)", ro(i)),
 'tastingNotes': fld(['발렌시아오렌지', '카라멜', '밀크초콜릿'], ['발렌시아 오렌지, 카라멜, 밀크초콜릿, 달다'], 'HIGH', "향 미 '발렌시아 오렌지, 카라멜, 밀크초콜릿, 달다' — '달다'는 질감·강도 서술이므로 value 제외·raw 보존", ro(i)),
}}

# 2. fillout-13684351661 에티오피아 게뎁 초르소 워시드 원두
i = 'fillout-13684351661'
B[i] = {'golden': {
 'productType': fld('single', '에티오피아 게뎁 초르소 워시드 원두', 'HIGH', '단일 산지(에티오피아) 명시', pn(i)),
 'status': fld('active', 'active', 'MEDIUM', 'isSoldOut=False (수집 플래그)', 'collector_flag'),
 'originCountry': fld('에티오피아', '에티오피아', 'HIGH', "상품명 '에티오피아 게뎁 초르소 워시드 원두'", pn(i)),
 'originRegion': fld('게뎁', '게뎁', 'MEDIUM', "상품명 '게뎁' — 예가체프 게뎁 구역으로 추정하나 상품명 기반 추론이므로 MEDIUM (batch-011 상품명→지역 추론 주의)", pn(i)),
 'producer': fld('초르소', '초르소', 'MEDIUM', "상품명 '초르소' — 워싱스테이션으로 추정하나 상품명 기반 추론이므로 MEDIUM", pn(i)),
 'process': fld('워시드', '워시드', 'HIGH', "상품명 '워시드' 명시", pn(i)),
 'variety': sm(i, '원문(상품명) 확인했으나 품종 정보 없음', '에티오피아 게뎁 초르소 워시드 원두', pn(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음', '에티오피아 게뎁 초르소 워시드 원두', pn(i)),
 'tastingNotes': fld([], [], 'SOURCE_MISSING', 'OCR 출력 빈값 — 이미지 확인했으나 노트 정보 없음', ocr(i)),
}}

# 3. 루비아커피-100-에티오피아스칼렛
i = '루비아커피-100-에티오피아스칼렛'
B[i] = {'golden': {
 'productType': fld('single', '100% 에티오피아 스칼렛', 'HIGH', "'100% 에티오피아' — 단일 산지 명시", pn(i)),
 'status': fld('active', 'active', 'MEDIUM', 'isSoldOut=False (수집 플래그)', 'collector_flag'),
 'originCountry': fld('에티오피아', '에티오피아', 'HIGH', "상품명 '100% 에티오피아 스칼렛'", pn(i)),
 'originRegion': sm(i, "'스칼렛'은 제품 라인명 — 지역 정보 아님", '스칼렛', pn(i)),
 'producer': sm(i, '원문 확인했으나 생산자 정보 없음', '100% 에티오피아 스칼렛', pn(i)),
 'process': sm(i, '원문 확인했으나 가공 정보 없음', '100% 에티오피아 스칼렛', pn(i)),
 'variety': sm(i, '원문 확인했으나 품종 정보 없음', '100% 에티오피아 스칼렛', pn(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음', '100% 에티오피아 스칼렛', pn(i)),
 'tastingNotes': fld(['꽃향기', '베리', '열대과일', '초콜릿', '블루베리', '블랙커런트', '다크초콜릿', '베리류'],
   ['꽃향기', '베리', '열대과일', '초콜릿', '블루베리', '블랙커런트', '다크초콜릿', '베리류'], 'MEDIUM',
   '서로 다른 이미지 2종의 OCR 노트 병합 (batch-011 교훈): 이미지1 [꽃향기·베리·열대과일·초콜릿], 이미지2 [블루베리·블랙커런트·다크초콜릿·베리류]',
   ocr(i), evidenceKind='current_echo'),
}}

# 4. hocuspocus-12301405254 케냐 니에리 힐 AA TOP 워시드
i = 'hocuspocus-12301405254'
B[i] = {'golden': {
 'productType': fld('single', '케냐 니에리 힐 AA TOP 워시드', 'HIGH', '단일 산지(케냐) 명시', pn(i)),
 'status': fld('active', 'active', 'MEDIUM', 'isSoldOut=False (수집 플래그)', 'collector_flag'),
 'originCountry': fld('케냐', '케냐', 'HIGH', "상품명 '케냐 니에리 힐 AA TOP 워시드'", pn(i)),
 'originRegion': fld('니에리', '니에리 힐', 'MEDIUM', "상품명 '니에리 힐' — 상품명 기반 추론이므로 MEDIUM", pn(i)),
 'producer': sm(i, "'힐'은 지형명 — 생산자(농장) 정보 아님", '니에리 힐', pn(i)),
 'process': fld('워시드', '워시드', 'HIGH', "상품명 '워시드' 명시", pn(i)),
 'variety': fld(None, 'AA TOP', 'SOURCE_MISSING', "'AA'는 선별 등급이지 품종이 아님 (batch-011 피베리 선례와 같은 취지)", pn(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음', '케냐 니에리 힐 AA TOP 워시드', pn(i)),
 'tastingNotes': fld([], [], 'SOURCE_MISSING', 'OCR·텍스트 증거 없음 — 확인했으나 노트 정보 없음', pn(i)),
}}

# 5. cafedoan-12759206817 NOMAD COFFEE 노마드 커피 Colombia Inmaculada Fellow Farms Geisha Washed
i = 'cafedoan-12759206817'
B[i] = {'golden': {
 'productType': fld('single', 'NOMAD COFFEE 노마드 커피 Colombia Inmaculada Fellow Farms Geisha Washed', 'HIGH', '단일 산지(Colombia) 명시', pn(i)),
 'status': fld('soldout', 'soldout', 'MEDIUM', 'isSoldOut=True (수집 플래그)', 'collector_flag'),
 'originCountry': fld('콜롬비아', 'Colombia', 'HIGH', "상품명 'Colombia Inmaculada Fellow Farms'", pn(i)),
 'originRegion': fld('바예 델 카우카', '바예 델 카우카 Valle del Cauca', 'HIGH', "detailText '바예 델 카우카 Valle del Cauca 산지에 위치한 농장'", dt(i)),
 'producer': fld('인마쿨라다 펠로우 팜스', '인마쿨라다 펠로우 팜스 (Inmaculada Fellow Farms)', 'HIGH', "detailText '인마쿨라다 커피 팜스 Inmaculada Coffee Farms'", dt(i)),
 'process': fld('내추럴', '내추럴 (Natural)', 'HIGH', "detailText '게이샤, 내추럴' + OCR process 태그 NATURAL — 상품명 'Washed'와 충돌하나 본문 우선 (§6)", dt(i) + ', ' + ocr(i)),
 'variety': fld('게이샤', '게이샤 (Geisha)', 'HIGH', "상품명·detailText '게이샤' 명시", pn(i) + ', ' + dt(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음 (Roast Date만 있음)', None, dt(i)),
 'tastingNotes': fld(['플로럴', '꿀', '배청', '시트러스', '자두', '레드프룻', '초콜릿', '건포도', '밝은산미'],
   ['플로럴, 꿀, 배청', 'aromas cítricos de flor blanca', 'miel y pera en almíbar', 'acidez brillante e integrada', 'notas de ciruela y frutos rojos', 'chocolate y pasas sultanas'], 'MEDIUM',
   "detailText CUP NOTE '플로럴, 꿀, 배청'(본문) + OCR 스페인어 노트 추가분 — 본문 3종은 OCR도 확인(text_confirmed 성격)이나 OCR 단독 추가분(시트러스·자두·레드프룻·초콜릿·건포도·밝은산미) 포함으로 전체 MEDIUM; 'dulzura(단맛)'·'juicy mouthfeel'은 질감 서술로 제외; 동일 이미지 URL의 두 OCR 출력은 보완 관계(정면 충돌 아님)",
   dt(i) + ', ' + ocr(i)),
}}

# 6. namusairo-28 다크우드
i = 'namusairo-28'
B[i] = {'golden': {
 'productType': fld('blend', '다크우드', 'HIGH', "원산지 'Ethiopia · Guatemala' — 복수 산지 블렌드", ro(i)),
 'status': fld('soldout', 'SOLD OUT', 'HIGH', "본문 내 'SOLD OUT' 표기 (isSoldOut=false와 불일치하나 원문 우선 — batch-002 namusairo-1135 선례)", ro(i)),
 'originCountry': fld('에티오피아 · 과테말라', 'Ethiopia · Guatemala', 'HIGH', "원문 '원산지 Ethiopia · Guatemala'", ro(i)),
 'originRegion': sm(i, '원문 확인했으나 지역 정보 없음'),
 'producer': sm(i, '원문 확인했으나 생산자 정보 없음'),
 'process': sm(i, '원문 확인했으나 가공 정보 없음'),
 'variety': sm(i, '원문 확인했으나 품종 정보 없음'),
 'roast': fld('Dark', 'Dark', 'HIGH', "원문 '볶음도 Dark'", ro(i)),
 'tastingNotes': fld(['베리', '초콜릿', '감칠맛'], ['베리, 초콜릿, 농밀한 단맛, 감칠맛, 복합적'], 'HIGH',
   "향 미 '베리, 초콜릿, 농밀한 단맛, 감칠맛, 복합적' — '농밀한 단맛'(달콤함 변형)·'복합적'(복합성 변형)은 질감·강도 서술이므로 value 제외·raw 보존", ro(i)),
}}

# 7. fillout-13752509968 콜롬비아 비자 카로리나 핑크버번 워시드 원두
i = 'fillout-13752509968'
B[i] = {'golden': {
 'productType': fld('single', '콜롬비아 비자 카로리나 핑크버번 워시드 원두', 'HIGH', '단일 산지(콜롬비아) 명시', pn(i)),
 'status': fld('active', 'active', 'MEDIUM', 'isSoldOut=False (수집 플래그)', 'collector_flag'),
 'originCountry': fld('콜롬비아', '콜롬비아', 'HIGH', '상품명 명시', pn(i)),
 'originRegion': sm(i, "'비자 카로리나'가 지역인지 농장인지 확인 불가 — 상품명 기반 추론 금지 (batch-011 FALSE_POSITIVE 9건 교훈)", '비자 카로리나', pn(i)),
 'producer': sm(i, "'비자 카로리나'가 농장명인지 확인 불가 — 상품명 기반 추론 금지", '비자 카로리나', pn(i)),
 'process': fld('워시드', '워시드', 'HIGH', "상품명 '워시드' 명시", pn(i)),
 'variety': fld('핑크버번', '핑크버번', 'HIGH', "상품명 '핑크버번' 명시", pn(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음', '콜롬비아 비자 카로리나 핑크버번 워시드 원두', pn(i)),
 'tastingNotes': fld([], [], 'SOURCE_MISSING', 'OCR 출력 빈값 — 이미지 확인했으나 노트 정보 없음', ocr(i)),
}}

# 8. lubia-9867970184 콜롬비아 세로아줄 게이샤 내추럴 라이트 로스트
i = 'lubia-9867970184'
B[i] = {'golden': {
 'productType': fld('single', '콜롬비아 세로아줄 게이샤 내추럴 라이트 로스트', 'HIGH', '단일 산지(콜롬비아) 명시', pn(i)),
 'status': fld('active', 'active', 'MEDIUM', 'isSoldOut=False (수집 플래그)', 'collector_flag'),
 'originCountry': fld('콜롬비아', '콜롬비아', 'HIGH', '상품명 명시', pn(i)),
 'originRegion': fld('세로아줄', '세로아줄', 'MEDIUM', "상품명 '세로아줄' — 상품명 기반 추론이므로 MEDIUM", pn(i)),
 'producer': sm(i, "'세로아줄'은 지역명 — 생산자(농장) 정보 아님", '세로아줄', pn(i)),
 'process': fld('내추럴', '내추럴', 'HIGH', "상품명 '내추럴' 명시 + OCR process 태그 '내추럴'", pn(i) + ', ' + ocr(i)),
 'variety': fld('게이샤', '게이샤', 'HIGH', "상품명 '게이샤' 명시", pn(i)),
 'roast': fld('Light', '라이트 로스트', 'HIGH', "상품명 '라이트 로스트' — 5단계 매핑", pn(i)),
 'tastingNotes': fld(['꽃향기', '적포도', '복숭아', '블루베리'], ['꽃향기', '적포도', '복숭아', '블루베리'], 'MEDIUM',
   'OCR 단독 근거 (process 태그 내추럴)', ocr(i), evidenceKind='current_echo'),
}}

# 9. hocuspocus-12523553689 온두라스 세로아줄 레드 카투아이 워시드
i = 'hocuspocus-12523553689'
B[i] = {'golden': {
 'productType': fld('single', '온두라스 세로아줄 레드 카투아이 워시드', 'HIGH', '단일 산지(온두라스) 명시', pn(i)),
 'status': fld('active', 'active', 'MEDIUM', 'isSoldOut=False (수집 플래그)', 'collector_flag'),
 'originCountry': fld('온두라스', '온두라스', 'HIGH', '상품명 명시', pn(i)),
 'originRegion': fld('세로아줄', '세로아줄', 'MEDIUM', "상품명 '세로아줄' — 상품명 기반 추론이므로 MEDIUM", pn(i)),
 'producer': sm(i, "'세로아줄'은 지역명 — 생산자(농장) 정보 아님", '세로아줄', pn(i)),
 'process': fld('워시드', '워시드', 'HIGH', "상품명 '워시드' 명시", pn(i)),
 'variety': fld('카투아이', '레드 카투아이', 'MEDIUM', "'레드'는 변종 표기 — 품종은 카투아이 (batch-011 피베리 선례와 같은 취지: 비품종 토큰 제외)", pn(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음', '온두라스 세로아줄 레드 카투아이 워시드', pn(i)),
 'tastingNotes': fld([], [], 'SOURCE_MISSING', 'OCR·텍스트 증거 없음 — 확인했으나 노트 정보 없음', pn(i)),
}}

# 10. cafedoan-11754674334 MANHATTAN 맨해튼 Panama Janson 501
i = 'cafedoan-11754674334'
B[i] = {'golden': {
 'productType': fld('single', 'MANHATTAN 맨해튼 Panama Janson 501', 'HIGH', '단일 산지(Panama) 명시', pn(i)),
 'status': fld('soldout', 'soldout', 'MEDIUM', 'isSoldOut=True (수집 플래그)', 'collector_flag'),
 'originCountry': fld('파나마', 'Panama', 'HIGH', "상품명 'Panama Janson 501' + detailText '파나마 잰슨 501'", pn(i) + ', ' + dt(i)),
 'originRegion': sm(i, '원문 확인했으나 지역 정보 없음', None, dt(i)),
 'producer': fld('잰슨', '잰슨 (Janson)', 'HIGH', "detailText '카이 잰슨과 그의 팀' · '해발 1350m에 위치한 Hacienda 농장' — 잰슨 가족 농장", dt(i)),
 'process': fld('워시드', '워시드 (Washed)', 'HIGH', "detailText '96시간 워시드 프로세스' + OCR process 태그 Washed", dt(i) + ', ' + ocr(i)),
 'variety': fld(None, '501', 'SOURCE_MISSING', "'501'은 로트 번호 — 품종이 아님 (batch-011 피베리 선례와 같은 취지)", pn(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음 (Roast Date - 4/15만 명시)', None, dt(i)),
 'tastingNotes': fld(['센차', '레몬제스트', '자스민', '피치', '허니'], ['센차, 레몬제스트, 자스민', 'Peach', 'Honey'], 'MEDIUM',
   "detailText CUP NOTE '센차, 레몬제스트, 자스민'(본문 명시, OCR도 확인) + OCR 단독 추가분 'Peach'·'Honey' — OCR 단독분 포함으로 전체 MEDIUM; 'juicy mouthfeel'은 질감 서술로 제외; 동일 이미지 URL의 두 OCR 출력은 보완 관계(정면 충돌 아님)",
   dt(i) + ', ' + ocr(i)),
}}

# 11. namusairo-27 숲
i = 'namusairo-27'
B[i] = {'golden': {
 'productType': fld('blend', '숲', 'HIGH', "원산지 'Ethiopia · Brazil' — 복수 산지 블렌드", ro(i)),
 'status': fld('soldout', 'SOLD OUT', 'HIGH', "본문 내 'SOLD OUT' 표기 (isSoldOut=false와 불일치하나 원문 우선 — batch-002 namusairo-1135 선례)", ro(i)),
 'originCountry': fld('에티오피아 · 브라질', 'Ethiopia · Brazil', 'HIGH', "원문 '원산지 Ethiopia · Brazil'", ro(i)),
 'originRegion': sm(i, '원문 확인했으나 지역 정보 없음'),
 'producer': sm(i, '원문 확인했으나 생산자 정보 없음'),
 'process': sm(i, '원문 확인했으나 가공 정보 없음'),
 'variety': sm(i, '원문 확인했으나 품종 정보 없음'),
 'roast': fld(None, 'Well-done', 'SOURCE_MISSING', "'Well-done'은 5단계 매핑표에 없음 — enum 강제 금지 (batch-011 교훈)", ro(i)),
 'tastingNotes': fld(['볶은땅콩', '향신료', '코코아', '레몬', '쌉쌀함'], ['볶은 땅콩, 향신료, 코코아, 레몬, 고소 달달 쌉쌀한 커피'], 'HIGH',
   "향 미 원문 명시 — '고소'·'달달'(달콤함 변형)은 질감·강도 서술이므로 value 제외·raw 보존; '쌉쌀함'은 쓴맛 노트로 포함", ro(i)),
}}

# 12. fillout-13673422137 콜롬비아 로스 파티오스 베리 코퍼먼티드 원두
i = 'fillout-13673422137'
B[i] = {'golden': {
 'productType': fld('single', '콜롬비아 로스 파티오스 베리 코퍼먼티드 원두', 'HIGH', '단일 산지(콜롬비아) 명시', pn(i)),
 'status': fld('active', 'active', 'MEDIUM', 'isSoldOut=False (수집 플래그)', 'collector_flag'),
 'originCountry': fld('콜롬비아', '콜롬비아', 'HIGH', '상품명 명시', pn(i)),
 'originRegion': fld('로스 파티오스', '로스 파티오스', 'MEDIUM', "상품명 '로스 파티오스' — 콜롬비아 지역명으로 보이나 상품명 기반 추론이므로 MEDIUM", pn(i)),
 'producer': sm(i, "'로스 파티오스'가 농장명인지 지역명인지 확인 불가 — 상품명 기반 추론 금지", '로스 파티오스', pn(i)),
 'process': fld('코퍼먼티드', '베리 코퍼먼티드', 'HIGH', "상품명 '베리 코퍼먼티드' 명시 + OCR process 태그 '베리 코퍼먼티드' — '베리'는 코퍼먼테이션 수식어", pn(i) + ', ' + ocr(i)),
 'variety': sm(i, '원문 확인했으나 품종 정보 없음', '콜롬비아 로스 파티오스 베리 코퍼먼티드 원두', pn(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음', '콜롬비아 로스 파티오스 베리 코퍼먼티드 원두', pn(i)),
 'tastingNotes': fld(['딸기', '블랙베리', '석류'], ['딸기', '블랙베리', '석류'], 'MEDIUM',
   'OCR 단독 근거 — 서로 다른 이미지 2종 중 1종에서만 노트 추출', ocr(i), evidenceKind='current_echo'),
}}

# 13. 루비아커피-콜롬비아엘파라이소리치피치라이트로스트가향커피
i = '루비아커피-콜롬비아엘파라이소리치피치라이트로스트가향커피'
B[i] = {'golden': {
 'productType': fld('single', '콜롬비아 엘 파라이소 리치피치 라이트 로스트 가향커피', 'HIGH', '단일 산지(콜롬비아) 명시 — 가향커피이나 산지는 단일', pn(i)),
 'status': fld('active', 'active', 'MEDIUM', 'isSoldOut=False (수집 플래그)', 'collector_flag'),
 'originCountry': fld('콜롬비아', '콜롬비아', 'HIGH', '상품명 명시', pn(i)),
 'originRegion': sm(i, "'엘 파라이소'는 농장명 — 지역으로 승격 금지 (batch-011 블렌드 성분→원산지 승격 패턴과 같은 취지)", '엘 파라이소', pn(i)),
 'producer': fld('엘 파라이소', '엘 파라이소', 'MEDIUM', "상품명 '엘 파라이소' — 유명 농장명이나 상품명 기반 추론이므로 MEDIUM", pn(i)),
 'process': fld('인퓨즈드', '리치피치 라이트 로스트 가향커피', 'HIGH', "상품명 '리치피치 ... 가향커피' — 가향(인퓨즈드) 명시", pn(i)),
 'variety': sm(i, '원문 확인했으나 품종 정보 없음', '콜롬비아 엘 파라이소 리치피치 라이트 로스트 가향커피', pn(i)),
 'roast': fld('Light', '라이트 로스트', 'HIGH', "상품명 '라이트 로스트' — 5단계 매핑", pn(i)),
 'tastingNotes': fld([], [], 'SOURCE_MISSING', 'OCR·텍스트 증거 없음 — 확인했으나 노트 정보 없음', pn(i)),
}}

# 14. hocuspocus-13639352375 에티오피아 예가체프 워르카 사카로 G1 워시드
i = 'hocuspocus-13639352375'
B[i] = {'golden': {
 'productType': fld('single', '에티오피아 예가체프 워르카 사카로 G1 워시드', 'HIGH', '단일 산지(에티오피아) 명시', pn(i)),
 'status': fld('active', 'active', 'MEDIUM', 'isSoldOut=False (수집 플래그)', 'collector_flag'),
 'originCountry': fld('에티오피아', '에티오피아', 'HIGH', '상품명 명시', pn(i)),
 'originRegion': fld('예가체프', '예가체프', 'HIGH', "상품명 '예가체프' — 도메인 규칙(구지/예가체프=지역)", pn(i)),
 'producer': sm(i, "'워르카 사카로'는 워싱스테이션 — 생산자(농장)가 아니므로 제외", '워르카 사카로', pn(i)),
 'process': fld('워시드', '워시드', 'HIGH', "상품명 '워시드' 명시", pn(i)),
 'variety': fld(None, 'G1', 'SOURCE_MISSING', "'G1'은 선별 등급 — 품종이 아님", pn(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음', '에티오피아 예가체프 워르카 사카로 G1 워시드', pn(i)),
 'tastingNotes': fld([], [], 'SOURCE_MISSING', 'OCR·텍스트 증거 없음 — 확인했으나 노트 정보 없음', pn(i)),
}}

# 15. cafedoan-5027185632 HEART ROASTERS 하트 로스터스 스테레오 블랜드
i = 'cafedoan-5027185632'
B[i] = {'golden': {
 'productType': fld('blend', 'HEART ROASTERS 하트 로스터스 스테레오 블랜드', 'HIGH', "상품명 '스테레오 블랜드' — 블렌드 명시", pn(i)),
 'status': fld('soldout', 'soldout', 'MEDIUM', 'isSoldOut=True (수집 플래그)', 'collector_flag'),
 'originCountry': sm(i, "'하트 로스터스'는 로스터리(미국) — 원산지가 아님; 블렌드 성분 원산지 정보 없음 (블렌드 성분→원산지 승격 금지)", '하트 로스터스', pn(i)),
 'originRegion': sm(i, '원문 확인했으나 지역 정보 없음', '스테레오 블랜드', pn(i)),
 'producer': sm(i, "'하트 로스터스'는 로스터리 — 생산자(농장) 정보 아님", '하트 로스터스', pn(i)),
 'process': sm(i, '원문 확인했으나 가공 정보 없음', '스테레오 블랜드', pn(i)),
 'variety': sm(i, '원문 확인했으나 품종 정보 없음', '스테레오 블랜드', pn(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음', '스테레오 블랜드', pn(i)),
 'tastingNotes': fld(['자스민', '피치', '얼그레이', '허니', '체리', '스위트크림', '퍼지'],
   ['Jasmine', 'Peach', 'Earl Grey', 'Honey', 'cherry', 'sweet cream', 'fudge'], 'MEDIUM',
   '동일 이미지 URL의 두 OCR 출력 병합 — [Jasmine·Peach·Earl Grey·Honey]와 [cherry·Sweet Cream·Fudge]는 보완 관계(정면 충돌 아님). OCR 단독 근거', ocr(i), evidenceKind='current_echo'),
}}

# 16. namusairo-1093 녹음
i = 'namusairo-1093'
B[i] = {'golden': {
 'productType': fld('blend', '녹음', 'HIGH', "원산지 'Guatemala · Kenya · Mexico' — 복수 산지 블렌드", ro(i)),
 'status': fld('soldout', 'SOLD OUT', 'HIGH', "본문 내 'SOLD OUT' 표기 (isSoldOut=false와 불일치하나 원문 우선 — batch-002 namusairo-1135 선례)", ro(i)),
 'originCountry': fld('과테말라 · 케냐 · 멕시코', 'Guatemala · Kenya · Mexico', 'HIGH', "원문 '원산지 Guatemala · Kenya · Mexico'", ro(i)),
 'originRegion': sm(i, '원문 확인했으나 지역 정보 없음'),
 'producer': sm(i, '원문 확인했으나 생산자 정보 없음'),
 'process': sm(i, '원문 확인했으나 가공 정보 없음'),
 'variety': sm(i, '원문 확인했으나 품종 정보 없음'),
 'roast': fld('Dark', 'Dark', 'HIGH', "원문 '볶음도 Dark'", ro(i)),
 'tastingNotes': fld(['건자두', '카카오', '당밀'], ['건자두, 카카오, 당밀, 묵직하다'], 'HIGH',
   "향 미 '건자두, 카카오, 당밀, 묵직하다' — '묵직하다'(heavy)는 질감 서술이므로 value 제외·raw 보존; OCR 이미지 노트도 본문과 일치(text_confirmed)", ro(i) + ', ' + ocr(i)),
}}

# 17. fillout-8427587166 시나몬 게이트 원두
i = 'fillout-8427587166'
B[i] = {'golden': {
 'productType': fld('other', '시나몬 게이트 원두', 'LOW', '원산지·블렌드 명시 없음 — single/blend 판단 불가', pn(i)),
 'status': fld('active', 'active', 'MEDIUM', 'isSoldOut=False (수집 플래그)', 'collector_flag'),
 'originCountry': sm(i, '원문 확인했으나 원산지 정보 없음', '시나몬 게이트 원두', pn(i)),
 'originRegion': sm(i, '원문 확인했으나 지역 정보 없음', '시나몬 게이트 원두', pn(i)),
 'producer': sm(i, '원문 확인했으나 생산자 정보 없음', '시나몬 게이트 원두', pn(i)),
 'process': fld('코퍼먼티드 · 워시드', '코퍼멘티드, 워시드', 'MEDIUM', "OCR process 태그 '코퍼멘티드, 워시드' — OCR 단독 근거", ocr(i)),
 'variety': sm(i, '원문 확인했으나 품종 정보 없음', '시나몬 게이트 원두', pn(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음', '시나몬 게이트 원두', pn(i)),
 'tastingNotes': fld(['시나몬', '사과'], ['시나몬, 사과, 달콤함'], 'MEDIUM',
   "OCR 단독 근거 — '달콤함'은 질감·강도 서술이므로 value 제외·raw 보존", ocr(i), evidenceKind='current_echo'),
}}

# 18. 루비아커피-인도네시아수마트라만델링g1길링바사-웻훌-미디엄로스트
i = '루비아커피-인도네시아수마트라만델링g1길링바사-웻훌-미디엄로스트'
B[i] = {'golden': {
 'productType': fld('single', '인도네시아 수마트라 만델링 G1 길링 바사 (웻 훌) 미디엄 로스트', 'HIGH', '단일 산지(인도네시아) 명시', pn(i)),
 'status': fld('active', 'active', 'MEDIUM', 'isSoldOut=False (수집 플래그)', 'collector_flag'),
 'originCountry': fld('인도네시아', '인도네시아', 'HIGH', '상품명 명시', pn(i)),
 'originRegion': fld('수마트라', '수마트라', 'HIGH', "상품명 '인도네시아 수마트라' — 수마트라는 지역(섬) 명시; '만델링'은 수마트라 커피 거래 통칭이므로 지역·품종에서 제외", pn(i)),
 'producer': sm(i, '원문 확인했으나 생산자 정보 없음', '인도네시아 수마트라 만델링 G1 길링 바사 (웻 훌) 미디엄 로스트', pn(i)),
 'process': fld('웻훌', '웻 훌 (Wet Hulled)', 'HIGH', "상품명 '웻 훌' 명시 + OCR process 태그 'Wet Hulled'", pn(i) + ', ' + ocr(i)),
 'variety': fld(None, 'G1', 'SOURCE_MISSING', "'G1'은 선별 등급 — 품종이 아님", pn(i)),
 'roast': fld('Medium', '미디엄 로스트', 'HIGH', "상품명 '미디엄 로스트' — 5단계 매핑", pn(i)),
 'tastingNotes': fld(['허브', '스파이스', '카카오'], ['허브', '스파이스', '카카오', '무거운 바디'], 'MEDIUM',
   "OCR 단독 근거 — '무거운 바디'(heavy body)는 질감 서술이므로 value 제외·raw 보존; 동일 이미지 URL의 빈 OCR 출력과 노트 출력은 상충 아님(침묵 vs 추출)", ocr(i), evidenceKind='current_echo'),
}}

# 19. hocuspocus-13639350218 에티오피아 예가체프 첼베사 워시드
i = 'hocuspocus-13639350218'
B[i] = {'golden': {
 'productType': fld('single', '에티오피아 예가체프 첼베사 워시드', 'HIGH', '단일 산지(에티오피아) 명시', pn(i)),
 'status': fld('active', 'active', 'MEDIUM', 'isSoldOut=False (수집 플래그)', 'collector_flag'),
 'originCountry': fld('에티오피아', '에티오피아', 'HIGH', '상품명 명시', pn(i)),
 'originRegion': fld('예가체프', '예가체프', 'HIGH', "상품명 '예가체프' — 도메인 규칙(구지/예가체프=지역)", pn(i)),
 'producer': sm(i, "'첼베사'는 워싱스테이션/케벨레 — 생산자(농장)가 아니므로 제외", '첼베사', pn(i)),
 'process': fld('워시드', '워시드', 'HIGH', "상품명 '워시드' 명시", pn(i)),
 'variety': sm(i, '원문 확인했으나 품종 정보 없음', '에티오피아 예가체프 첼베사 워시드', pn(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음', '에티오피아 예가체프 첼베사 워시드', pn(i)),
 'tastingNotes': fld([], [], 'SOURCE_MISSING', 'OCR 출력 빈값 — 이미지 확인했으나 노트 정보 없음', ocr(i)),
}}

# 20. cafedoan-9628182790 Solberg & Hansen 솔벅 & 한센 에티오피아 타데 워시드
i = 'cafedoan-9628182790'
B[i] = {'golden': {
 'productType': fld('single', 'Solberg & Hansen 솔벅 & 한센 에티오피아 타데 워시드', 'HIGH', '단일 산지(에티오피아) 명시', pn(i)),
 'status': fld('soldout', 'soldout', 'MEDIUM', 'isSoldOut=True (수집 플래그)', 'collector_flag'),
 'originCountry': fld('에티오피아', '에티오피아', 'HIGH', '상품명 명시', pn(i)),
 'originRegion': sm(i, "'타데'는 스테이션명 — 지역 정보 아님", '타데', pn(i)),
 'producer': sm(i, "'타데'는 워싱스테이션 — 생산자(농장)가 아니므로 제외", '타데', pn(i)),
 'process': fld('워시드', '워시드 (Våtbredet)', 'HIGH', "상품명 '워시드' 명시 + OCR process 태그 'Våtbredet'(노르웨이어 washed)", pn(i) + ', ' + ocr(i)),
 'variety': sm(i, '원문 확인했으나 품종 정보 없음', 'Solberg & Hansen 솔벅 & 한센 에티오피아 타데 워시드', pn(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음', 'Solberg & Hansen 솔벅 & 한센 에티오피아 타데 워시드', pn(i)),
 'tastingNotes': fld(['시트러스', '스톤프룻', '베르가못'], ['Sitrus', 'steinfrukt', 'bergamott'], 'MEDIUM',
   'OCR 단독 근거 (노르웨이어 노트) — 동일 이미지 URL의 빈 OCR 출력과 노트 출력은 상충 아님', ocr(i), evidenceKind='current_echo'),
}}

# 21. aerycoffee-11368384812 [에어리커피] 에티오피아 물루게타 문타샤 내추럴
i = 'aerycoffee-11368384812'
B[i] = {'golden': {
 'productType': fld('single', '[에어리커피] 에티오피아 물루게타 문타샤 내추럴', 'HIGH', '단일 산지(에티오피아) 명시', pn(i)),
 'status': fld('soldout', 'soldout', 'MEDIUM', 'isSoldOut=True (수집 플래그)', 'collector_flag'),
 'originCountry': fld('에티오피아', '에티오피아', 'HIGH', '상품명 명시', pn(i)),
 'originRegion': sm(i, "'물루게타'가 지역인지 확인 불가 — 상품명 기반 추론 금지 (batch-011 교훈)", '물루게타', pn(i)),
 'producer': sm(i, "'문타샤'가 생산자인지 확인 불가 — 상품명 기반 추론 금지", '문타샤', pn(i)),
 'process': fld('내추럴', '내추럴', 'HIGH', "상품명 '내추럴' 명시 + OCR process 태그 NATURAL", pn(i) + ', ' + ocr(i)),
 'variety': sm(i, '원문 확인했으나 품종 정보 없음', '[에어리커피] 에티오피아 물루게타 문타샤 내추럴', pn(i)),
 'roast': sm(i, '원문 확인했으나 로스팅 정보 없음', '[에어리커피] 에티오피아 물루게타 문타샤 내추럴', pn(i)),
 'tastingNotes': fld(['꽃향기', '믹스베리'], ['fragrant floral notes', 'complex mixed berry flavors', '향기로운 꽃 향기와 믹스 베리의 복합적인 플레이버'], 'MEDIUM',
   "OCR 단독 근거 — '복합적인 플레이버'는 질감·강도 서술(복합성 변형)이므로 value 제외·raw 보존", ocr(i), evidenceKind='current_echo'),
}}

# 22. 로스터릭-에티오피아예가체프아리차g1워시드중강배전
i = '로스터릭-에티오피아예가체프아리차g1워시드중강배전'
B[i] = {'golden': {
 'productType': fld('single', '에티오피아 예가체프 아리차 G1 워시드 중강배전', 'HIGH', '단일 산지(에티오피아) 명시', pn(i)),
 'status': fld('active', 'active', 'MEDIUM', 'isSoldOut=False (수집 플래그)', 'collector_flag'),
 'originCountry': fld('에티오피아', '에티오피아', 'HIGH', '상품명 명시', pn(i)),
 'originRegion': fld('예가체프', '예가체프', 'HIGH', "상품명 '예가체프' — 도메인 규칙(구지/예가체프=지역)", pn(i)),
 'producer': sm(i, "'아리차'는 케벨레/스테이션 — 생산자(농장)가 아니므로 제외", '아리차', pn(i)),
 'process': fld('워시드', '워시드', 'HIGH', "상품명 '워시드' 명시 + OCR process 태그 '워시드'", pn(i) + ', ' + ocr(i)),
 'variety': fld(None, 'G1', 'SOURCE_MISSING', "'G1'은 선별 등급 — 품종이 아님", pn(i)),
 'roast': fld('Medium-Dark', '중강배전', 'HIGH', "상품명 '중강배전' — 5단계 매핑", pn(i)),
 'tastingNotes': fld(['블루베리', '다크초콜릿'], ['블루베리', '부드러운 질감', '다크 초콜릿'], 'MEDIUM',
   "OCR 단독 근거 — '부드러운 질감'은 질감 서술이므로 value 제외·raw 보존; 동일 이미지 URL의 두 동일 OCR 출력", ocr(i), evidenceKind='current_echo'),
}}

json.dump(B, open('/home/hatch/workspace/beanpick/audit/golden/_work/batch-012-reviewerB.json', 'w'), ensure_ascii=False, indent=1)
print('B written:', len(B))
