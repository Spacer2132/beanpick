import json

rec = {"judge": [
 {
  "id": "fillout-13684351661",
  "field": "producer",
  "verdict": "A",
  "value": None,
  "raw": "초르소",
  "confidence": "SOURCE_MISSING",
  "evidence": "원문은 상품명 '에티오피아 게뎁 초르소 워시드 원두'뿐. '초르소'는 에티오피아 워싱스테이션명으로 추정되며, 생산자(농장/농부/협동조합)가 아니다. 배치 12 내 동일 기준 적용 사례: hocuspocus-13639352375 '워르카 사카로', hocuspocus-13639350218 '첼베사', cafedoan-9628182790 '타데', 로스터릭 '아리차' — 모두 워싱스테이션/케벨레로 보고 producer에서 제외(SOURCE_MISSING). B만 '초르소'를 생산자로 승격한 것은 B 내부 기준 불일치. A의 SOURCE_MISSING이 일관되고 올바름.",
  "evidenceSource": "audit-input/products/fillout-13684351661-0758a94d.json#snapshotRecord.productName",
  "note": "B의 오판 패턴: 에티오피아 스테이션명의 생산자 승격 + B 내부 불일치(다른 스테이션은 제외하고 초르소만 포함). batch-011 '상품명→originRegion 추론' FALSE_POSITIVE 패턴과 같은 계열 — 상품명 토큰의 무비판 승격."
 },
 {
  "id": "cafedoan-12759206817",
  "field": "tastingNotes",
  "verdict": "B",
  "value": ["플로럴", "꿀", "배청", "시트러스", "자두", "레드프룻", "초콜릿", "건포도", "밝은산미"],
  "raw": ["플로럴, 꿀, 배청", "aromas cítricos de flor blanca", "miel y pera en almíbar", "acidez brillante e integrada", "notas de ciruela y frutos rojos", "chocolate y pasas sultanas"],
  "confidence": "MEDIUM",
  "evidence": "detailText CUP NOTE '플로럴, 꿀, 배청'(본문 명시) + 동일 상품 이미지의 OCR 스페인어 노트. 스페인어 노트는 본문과 상충하지 않고 보완 관계: flor blanca(플로럴)·miel(꿀)·pera(배청)는 본문과 일치하고, cítricos(시트러스)·ciruela(자두)·frutos rojos(레드프룻)·chocolate(초콜릿)·pasas sultanas(건포도)·acidez brillante(밝은산미)는 추가 고유 노트. OCR process 태그 NATURAL은 본문 '내추럴'과 일치하여 해당 이미지가 이 상품의 것임을 뒷받침. A가 인용한 batch-011 cafedoan-12769087298 선례는 OCR 노트가 본문과 '상충'하던 경우이나, 여기서는 상충이 없어 본문 우선 원칙이 OCR 추가분 배제를 강제하지 않음. 'dulzura(단맛)'·'juicy mouthfeel'은 질감 서술로 제외. OCR 단독분 포함이므로 전체 confidence는 MEDIUM.",
  "evidenceSource": "audit-input/products/cafedoan-12759206817-f7afcc24.json#evidence.detailCache.detailText, audit-input/products/cafedoan-12759206817-f7afcc24.json#evidence.ocr",
  "note": "A의 오판 패턴: batch-011 선례의 과잉 일반화 — '본문 우선'을 '본문만'으로 확대 해석하여 상충하지 않는 OCR 보완 노트를 배제. 상충 없는 보완 OCR은 병합이 원칙(batch-011 교훈: 서로 다른 이미지 2종의 OCR 노트는 병합 가능; 여기는 동일 이미지이나 보완 관계라 동일 취지)."
 },
 {
  "id": "namusairo-27",
  "field": "tastingNotes",
  "verdict": "B",
  "value": ["볶은땅콩", "향신료", "코코아", "레몬", "쌉쌀함"],
  "raw": ["볶은 땅콩, 향신료, 코코아, 레몬, 고소 달달 쌉쌀한 커피"],
  "confidence": "HIGH",
  "evidence": "원문 향미 '볶은 땅콩, 향신료, 코코아, 레몬, 고소 달달 쌉쌀한 커피'. '고소'(질감)·'달달'(달콤함 변형)은 질감·강도 서술이므로 제외가 타당. 그러나 '쌉쌀한'은 쓴맛(bitterness)을 가리키는 맛 서술 — 질감어 사전(쥬시/SWEET/JUICY/부드러운/풀바디/복합성/달콤함/가득/깔끔한 등)에도 없고, rev2의 질감·강도 제외 대상(질감·강도)이 아님. 맛의 기본 요소인 쓴맛을 질감 서술과 묶였다는 이유로 제외하면 원문에 명시된 향미 정보가 손실됨. B의 포함이 올바름.",
  "evidenceSource": "audit-input/products/namusairo-27-b4874945.json#evidence.rawObservations",
  "note": "A의 오판 패턴: 질감어 제외 원칙의 과잉 적용 — '고소 달달 쌉쌀한'이라는 묶인 서술 전체를 질감으로 보고 맛(쓴맛) 서술까지 제외. 질감어 제외는 질감·강도 서술에만 적용해야 하며, 맛 서술(쓴맛/신맛/단맛의 맛 자체)은 노트로 유지."
 }
]}

json.dump(rec, open('/home/hatch/workspace/beanpick/audit/golden/_work/batch-012-judge-record.json','w'), ensure_ascii=False, indent=1)
print('judge record written:', len(rec['judge']))
