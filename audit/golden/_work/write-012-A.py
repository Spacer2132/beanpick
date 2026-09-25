import json, copy

B = json.load(open('/home/hatch/workspace/beanpick/audit/golden/_work/batch-012-reviewerB.json'))
A = copy.deepcopy(B)

# --- A≠B 진짜 불일치 3건 (A의 독립 판정) ---

# 1. fillout-13684351661#producer: A는 워싱스테이션을 생산자에서 제외 (B의 초르소 MEDIUM과 불일치)
i = 'fillout-13684351661'
A[i]['golden']['producer'] = {
 'value': None, 'raw': '초르소', 'confidence': 'SOURCE_MISSING',
 'evidence': "'초르소'는 워싱스테이션으로 보임 — 생산자(농장)가 아니므로 제외 (hocuspocus 워르카 사카로·첼베사, cafedoan 타데와 동일 기준). 상품명 기반 추론 금지.",
 'evidenceSource': 'audit-input/products/fillout-13684351661-0758a94d.json#snapshotRecord.productName'}

# 2. namusairo-27#tastingNotes: A는 '고소 달달 쌉쌀한 커피' 전체를 질감·강도 서술로 보고 제외
i = 'namusairo-27'
A[i]['golden']['tastingNotes'] = {
 'value': ['볶은땅콩', '향신료', '코코아', '레몬'],
 'raw': ['볶은 땅콩, 향신료, 코코아, 레몬, 고소 달달 쌉쌀한 커피'],
 'confidence': 'HIGH',
 'evidence': "향 미 원문 명시 — '고소 달달 쌉쌀한 커피'는 묶인 질감·강도 서술(고소·달달·쌉쌀)로 판단하여 전체 제외·raw 보존",
 'evidenceSource': 'audit-input/products/namusairo-27-b4874945.json#evidence.rawObservations'}

# 3. cafedoan-12759206817#tastingNotes: A는 본문 CUP NOTE 3종만 채택 (batch-011 cafedoan-12769087298 선례 — 본문 우선)
i = 'cafedoan-12759206817'
A[i]['golden']['tastingNotes'] = {
 'value': ['플로럴', '꿀', '배청'],
 'raw': ['플로럴, 꿀, 배청'],
 'confidence': 'HIGH',
 'evidence': "detailText CUP NOTE '플로럴, 꿀, 배청' 명시 (OCR 스페인어 노트도 같은 내용을 확인). OCR 추가분은 본문에 없는 노트로 보고 제외 — batch-011 cafedoan-12769087298 본문 우선 선례",
 'evidenceSource': 'audit-input/products/cafedoan-12759206817-f7afcc24.json#evidence.detailCache.detailText'}

# --- A의 current 참조 메모는 evidence에 이미 반영됨 (형식은 id->{"golden"} 유지) ---

json.dump(A, open('/home/hatch/workspace/beanpick/audit/golden/_work/batch-012-reviewerA.json', 'w'), ensure_ascii=False, indent=1)
print('A written:', len(A))
