#!/usr/bin/env python3
# 배치 16 QA 되돌림: 에스테이트명을 originRegion HIGH로 기록한 9건 → null/SOURCE_MISSING
# 근거: rev2 "원문에 지역 표기 없음 → 승격 금지" + Judge 선례(aerycoffee-13666855026)
import json, os

BASE = os.path.expanduser("~/workspace/beanpick")
N = 16
M = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-%03d-merged.json" % N)))

REVERSALS = [
    ("cafedoan-11446555211", "라 트리니다드", "Finca La Trinidad(콜롬비아 우일라)의 농장명. 원문에 지역 표기 없음"),
    ("hocuspocus-12134209835", "비스타 헤르모사", "Vista Hermosa(과테말라 안티구아)의 농장명. 원문에 지역 표기 없음"),
    ("aerycoffee-11941856461", "잔슨", "Hacienda Janson(파나마)의 농장명. 원문에 지역 표기 없음"),
    ("cafedoan-13627490056", "카멜리아스", "Finca Las Camelias(과테말라)의 농장명. 원문에 지역 표기 없음"),
    ("hocuspocus-11755848790", "다테하", "Daterra Estate(브라질 세하두)의 농장명. 원문에 지역 표기 없음"),
    ("cafedoan-13647777127", "라 노리아", "농장명으로 보이며 원문에 지역 표기 없음"),
    ("cafedoan-13647238261", "라 시리아", "Finca La Siria(콜롬비아 우일라)의 농장명. 원문에 지역 표기 없음"),
    ("cafedoan-11382415813", "부에나 비스타", "원문에 'Finca Buena Vista'로 농장임이 명시됨. 농장은 지역이 아님"),
    ("cafedoan-11754458202", "산타 루치아", "원문에 'Santa Lucia 농장'으로 농장임이 명시됨. 농장은 지역이 아님"),
]

log = []
for pid, old_val, reason in REVERSALS:
    g = M[pid]["golden"]["originRegion"]
    assert g["value"] == old_val, (pid, g["value"])
    src = g["evidenceSource"]
    M[pid]["golden"]["originRegion"] = {
        "value": None,
        "raw": None,
        "confidence": "SOURCE_MISSING",
        "evidence": "'%s'은 %s → 지역 승격 금지 (Judge 선례: aerycoffee-13666855026)" % (old_val, reason),
        "evidenceSource": src,
    }
    log.append({"id": pid, "field": "originRegion",
                "before": {"value": old_val, "confidence": "HIGH"},
                "after": {"value": None, "confidence": "SOURCE_MISSING"},
                "reason": reason})

json.dump(M, open(os.path.join(BASE, "audit/golden/_work/batch-%03d-merged.json" % N), "w"),
          ensure_ascii=False, indent=1)
qa = {"reversals": log,
      "note": "수동 QA: 에스테이트명을 originRegion HIGH로 승격한 9건 되돌림. 나머지 필드 이상 없음."}
json.dump(qa, open(os.path.join(BASE, "audit/golden/_work/batch-%03d-qa.json" % N), "w"),
          ensure_ascii=False, indent=1)
print("reversals applied:", len(log))

# 도메인 리뷰 기록
domain = {"corrections": [],
          "note": "도메인 리뷰: 게이샤=품종, 파카스/카투아이=품종, 무산소=가공 수식어, 워시드/내추럴/허니 표기 정상. "
                  "에스테이트명(라 트리니다드·비스타 헤르모사·잔슨·카멜리아스·다테하·라 노리아·라 시리아·부에나 비스타·산타 루치아)은 "
                  "지역이 아니라 농장명이므로 originRegion 기록 불가 — QA 되돌림과 일치. 수정 없음."}
json.dump(domain, open(os.path.join(BASE, "audit/golden/_work/batch-%03d-domain.json" % N), "w"),
          ensure_ascii=False, indent=1)
print("domain review written")
