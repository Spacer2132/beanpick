# Judge record — batch 13 (5 disagreements, 원문 재독 후 판정)
import json, os

J = []

# 1) hocuspocus-10781774331#process: A=워시드 vs B=무산소 워시드 (원문 '애너로빅 워시드')
J.append({
    "id": "hocuspocus-10781774331",
    "field": "process",
    "verdict": "B",
    "value": "무산소 워시드",
    "raw": "애너로빅 워시드",
    "confidence": "HIGH",
    "evidence": "원문 '애너로빅 워시드'. §8은 무산소/애너로빅이 단독 가공이 아님을 규정할 뿐, 워시드와의 결합 표기를 금지하지 않는다. batch-007에서 '무산소 워시드'가 golden 값으로 확정된 선례, regression-rules §3의 수식어 결합(무산소 내추럴=Anaerobic Natural) 원칙과 일치. A의 '워시드'는 수식어 탈락으로 정보 손실.",
    "evidenceSource": "audit-input/products/hocuspocus-10781774331-a7ff0e77.json#snapshotRecord.productName",
    "note": "A의 오판 패턴: §8 '수식어(단독 가공 아님)'를 '수식어 삭제'로 과잉 해석. 선례(batch-007 무산소 워시드)와 매핑표의 결합값 원칙을 놓침."
})

# 2) fillout-13732632561#variety: A=null vs B=엑셀사 (원문 '베트남 록렁 엑셀사 원두')
J.append({
    "id": "fillout-13732632561",
    "field": "variety",
    "verdict": "B",
    "value": "엑셀사",
    "raw": "엑셀사",
    "confidence": "MEDIUM",
    "evidence": "상품명 '엑셀사' 명시. 엑셀사(Excelsa, Coffea liberica var. dewevrei)는 특정 커피 분류군으로 제품 스펙에서 품종란에 기재되는 정보. §4가 제외하는 '자생종·다품종 같은 일반명'과 달리 구체적 식별자이므로 포함이 정보 보존에 유리. 종/품종 엄밀 구분은 스키마의 variety 필드 취지에 비추어 과도한 엄밀함.",
    "evidenceSource": "audit-input/products/fillout-13732632561-6d9a976d.json#snapshotRecord.productName",
    "note": "A의 오판 패턴: 분류학적 엄밀함을 앞세워 원문에 명시된 식별자를 탈락시킴. '원문에 없는 값을 만들지 마라'의 반대 방향 오류 — 원문에 있는 값을 지우지 마라."
})

# 3) aerycoffee-13695062103#process: A=내추럴 vs B=퍼먼테이션 내추럴 (원문 '72h 퍼먼테이션 내추럴')
J.append({
    "id": "aerycoffee-13695062103",
    "field": "process",
    "verdict": "B",
    "value": "퍼먼테이션 내추럴",
    "raw": "72h 퍼먼테이션 내추럴",
    "confidence": "HIGH",
    "evidence": "원문 '72h 퍼먼테이션 내추럴'. batch-010에서 '더블 퍼먼테이션 워시드'가 golden 값으로 확정된 선례 — 퍼먼테이션 수식어는 가공 식별의 핵심 정보이므로 보존. A의 '내추럴'은 정보 손실.",
    "evidenceSource": "audit-input/products/aerycoffee-13695062103-d3e7d2ea.json#snapshotRecord.productName",
    "note": "A의 오판 패턴: 1번과 동일 — 수식어를 '부차 정보'로 보고 삭제. 선례(더블 퍼먼테이션 워시드)와 배치 내 일관성(B의 무산소 워시드)을 놓침."
})

# 4) cafedoan-11754557408#producer: A=페페 히욘 vs B=핀카 솔레다드
J.append({
    "id": "cafedoan-11754557408",
    "field": "producer",
    "verdict": "B",
    "value": "핀카 솔레다드",
    "raw": "핀카 솔레다드 Finca Soledad",
    "confidence": "MEDIUM",
    "evidence": "원문 '핀카 솔레다드 Finca Soledad에서 페페와 그의 팀은 시드라에 고전적인 TyOxidator 방식의 가공을 적용' — 생산이 이루어진 농장이 명시. 페페 히욘은 운영자/생산자 개인이나, golden.producer의 일관 기준(농장 우선, namusairo-1136 라에스메랄다 선례)에 따라 농장명 채택. A의 페페 히욘도 원문 근거가 있으나(제품명·'로부터 온 커피'), 농장 명시가 더 직접적인 생산지 식별자.",
    "evidenceSource": "audit-input/products/cafedoan-11754557408-04c95035.json#evidence.detailCache.detailText",
    "note": "A/B 모두 원문 근거 있음 — 판단 기준의 차이(제품명 인물 vs 본문 농장). 배치 내 일관 기준 '본문에 농장 명시 시 농장 우선'으로 B 채택. A의 선택도 합리적이나 일관성을 위해 B."
})

# 5) 루비아커피-브라질ny2세하도파인컵내추럴미디엄로스트#process: A=펄프드 내추럴 vs B=내추럴
J.append({
    "id": "루비아커피-브라질ny2세하도파인컵내추럴미디엄로스트",
    "field": "process",
    "verdict": "B",
    "value": "내추럴",
    "raw": "내추럴",
    "confidence": "HIGH",
    "evidence": "상품명 '내추럴' 명시 (HIGH). A의 근거인 OCR process='Pupled Natural'은 모델 추출값의 오타('Pupled')를 포함하며, 이미지 원문 표기인지 모델 추론인지 확정 불가 — OCR은 노트에 대해서도 최대 MEDIUM인 독립 증거 아님. 상품명 명시(HIGH)가 우선.",
    "evidenceSource": "audit-input/products/루비아커피-브라질ny2세하도파인컵내추럴미디엄로스트-e69c226d.json#snapshotRecord.productName",
    "note": "A의 오판 패턴: OCR 추출값(오타 포함)을 상품명 명시보다 우선시함. OCR은 'BeanPick 현재 추출값'으로 독립 증거가 아니라는 §3 원칙 위반. B의 판단이 프로토콜에 부합."
})

out = os.path.expanduser("~/workspace/beanpick/audit/golden/_work/batch-013-judge-record.json")
json.dump({"judge": J}, open(out, "w"), ensure_ascii=False, indent=1)
print("wrote", out, len(J), "rulings")
for j in J:
    print(f"  {j['id']}#{j['field']}: verdict={j['verdict']} value={j['value']}")
