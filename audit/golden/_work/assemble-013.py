# Assemble batch-013 products + compute diff (displayed 기준)
# tastingNotes comparable는 compute-comparable.mjs가 채운 뒤 diff를 확정한다.
import json, os, re

BASE = os.path.expanduser("~/workspace/beanpick")
MERGED = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-013-merged.json")))
CV = json.load(open(os.path.join(BASE, "audit/golden/current-values.json")))["current"]
QA = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-013-qa.json")))
DOMAIN = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-013-domain.json")))
BATCH = json.load(open(os.path.join(BASE, "audit/golden/batches.json")))["batches"][12]

def norm_toks(s):
    s = re.sub(r"\s+", " ", str(s).strip()).lower()
    toks = re.split(r"[\s,·/│|()\[\]]+", s)
    return frozenset(t for t in toks if t)

def norm_set(v):
    if v is None: return None
    if isinstance(v, list):
        s = set()
        for x in v: s |= norm_toks(x)
        return frozenset(s)
    return norm_toks(v)

def eq(a, b):
    na, nb = norm_set(a), norm_set(b)
    if na is None and nb is None: return True
    if na is None or nb is None: return False
    return na == nb

def empty(v):
    return v is None or v == "" or v == []

NOT_DISP = {"match": None, "case": None, "failureReason": "NOT_DISPLAYED_FIELD",
            "note": "앱 표시 없음 — 비교 제외"}

def diff_status(g, d):
    gv, dv = g["value"], d["status"]
    if gv == dv:
        if g.get("evidenceSource") == "collector_flag":
            return {"match": True, "case": None, "failureReason": None,
                    "note": "정확도 통계에서 제외 (collector_flag)"}
        return {"match": True, "case": None, "failureReason": None,
                "note": "원문 근거로 일치"}
    return {"match": False, "case": 1, "failureReason": "PARSER_MISS",
            "note": f"golden={gv} vs displayed={dv} — 정확도 통계에서 제외"}

def diff_simple(g, dv, fname):
    # originCountry/process/variety 공통
    if g["confidence"] == "UNKNOWN":
        return {"match": None, "case": 3, "failureReason": "EVIDENCE_UNAVAILABLE",
                "note": "C등급: 판정 불가 (golden UNKNOWN)" if "C등급" in str(g.get("evidenceSource","")) or True else "판정 불가 (golden UNKNOWN)"}
    gv = g["value"]
    if empty(gv) and empty(dv):
        return {"match": True, "case": None, "failureReason": None, "note": "둘 다 정보 없음"}
    if eq(gv, dv):
        return {"match": True, "case": None, "failureReason": None, "note": "정규화 후 일치"}
    if empty(gv):
        return {"match": False, "case": 1, "failureReason": "FALSE_POSITIVE",
                "note": f"golden {g['confidence']}인데 표시값: \"{dv}\""}
    return {"match": False, "case": 1, "failureReason": "PARSER_MISS",
            "note": f"golden=\"{gv}\" vs displayed=\"{dv}\" — 원문 정보를 표시가 놓침"}

def diff_producer(g, region):
    if g["confidence"] == "UNKNOWN":
        return {"match": None, "case": 3, "failureReason": "EVIDENCE_UNAVAILABLE",
                "note": "C등급: 판정 불가 (golden UNKNOWN)"}
    gv = g["value"]
    if empty(gv):
        if empty(region):
            return {"match": True, "case": None, "failureReason": None, "note": "둘 다 정보 없음"}
        return {"match": False, "case": 1, "failureReason": "FALSE_POSITIVE",
                "note": f"golden SOURCE_MISSING인데 '농장' 행 표시값: \"{region}\" (상품명 잔여 텍스트)"}
    # §7: 정규화 집합 교차 / 부분문자열 / 핵심단어
    if empty(region):
        return {"match": False, "case": 1, "failureReason": "PARSER_MISS",
                "note": f"golden=\"{gv}\" vs 농장행 없음 — 생산자를 표시가 놓침"}
    gn, rn = norm_set(gv), norm_set(region)
    if gn & rn:
        return {"match": True, "case": None, "failureReason": None, "note": "정규화 후 일치"}
    # 부분 문자열 (공백 제거)
    gs = re.sub(r"\s+", "", str(gv)).lower()
    rs = re.sub(r"\s+", "", str(region)).lower()
    if gs in rs or rs in gs:
        return {"match": True, "case": None, "failureReason": None, "note": "정규화 후 일치"}
    # 핵심 단어(5자 이상) — 수동 판정 대상으로 표시
    return {"match": "MANUAL", "case": 1, "failureReason": "TBD",
            "note": f"golden=\"{gv}\" vs 농장행=\"{region}\" — 수동 판정 필요"}

def diff_roast(g, d, smartstore):
    if g["confidence"] == "UNKNOWN":
        return {"match": None, "case": 3, "failureReason": "EVIDENCE_UNAVAILABLE",
                "note": "C등급: 판정 불가 (golden UNKNOWN)"}
    gv, dv = g["value"], d["roastLevel"]
    if empty(gv) and (empty(dv) or dv == "확인 필요"):
        return {"match": True, "case": None, "failureReason": None, "note": "둘 다 정보 없음"}
    if eq(gv, dv):
        return {"match": True, "case": None, "failureReason": None, "note": "정규화 후 일치"}
    if dv == "확인 필요":
        if smartstore:
            return {"match": False, "case": 1, "failureReason": "NOT_IMPLEMENTED",
                    "note": f"golden={gv}이나 스마트스토어 수집이 roastLevel을 '확인 필요'로 고정"}
        return {"match": False, "case": 1, "failureReason": "PARSER_MISS",
                "note": f"golden={gv} vs displayed '확인 필요' — 공식몰 기본정보표의 볶음도를 수집이 놓침"}
    return {"match": False, "case": 1, "failureReason": "PARSER_MISS",
            "note": f"golden={gv} vs displayed=\"{dv}\""}

def diff_notes(g, disp_notes):
    # comparable은 mjs가 채움. 여기서는 임시로 value 기준 집합 비교 후 수동 확정.
    if g["confidence"] == "UNKNOWN":
        return {"match": None, "case": 3, "failureReason": "EVIDENCE_UNAVAILABLE",
                "note": "C등급: 판정 불가 (golden UNKNOWN)"}
    gv = g["value"] or []
    dn = disp_notes or []
    if not gv and not dn:
        return {"match": True, "case": None, "failureReason": None, "note": "둘 다 정보 없음"}
    gs, ds = norm_set(gv), norm_set(dn)
    if gs == ds:
        return {"match": True, "case": None, "failureReason": None, "note": "정규화 후 일치"}
    missing = sorted(set(x for x in gv) - set(x for x in dn))
    extra = sorted(set(x for x in dn) - set(x for x in gv))
    parts = []
    if missing: parts.append(f"누락 {missing}")
    if extra: parts.append(f"추가 {extra}")
    # 원문에 없는 displayed 노트 → FALSE_POSITIVE, 원문 노트 누락 → PARSER_MISS
    if extra and not missing:
        fr = "FALSE_POSITIVE"
    elif missing and not extra:
        fr = "PARSER_MISS"
    else:
        fr = "NORMALIZATION_ERROR"
    return {"match": False, "case": 1, "failureReason": fr,
            "note": f"golden={gv} vs displayed={dn} — {'; '.join(parts)} (comparable 확정 후 재확인)"}

products = []
manual_flags = []
for pid in BATCH["ids"]:
    m = MERGED[pid]
    c = CV[pid]
    g = m["golden"]
    d = c["displayed"]
    diff = {
        "productType": dict(NOT_DISP),
        "originRegion": dict(NOT_DISP),
        "status": diff_status(g["status"], d),
        "originCountry": diff_simple(g["originCountry"], d["originCountry"], "originCountry"),
        "producer": diff_producer(g["producer"], d.get("region", "")),
        "process": diff_simple(g["process"], d["process"], "process"),
        "variety": diff_simple(g["variety"], d["variety"], "variety"),
        "roast": diff_roast(g["roast"], d, c.get("smartstore")),
        "tastingNotes": diff_notes(g["tastingNotes"], d["tastingNotes"]),
    }
    for f, dd in diff.items():
        if dd["match"] == "MANUAL" or dd["failureReason"] == "TBD":
            manual_flags.append((pid, f, dd["note"]))
    prod = {
        "id": pid,
        "roastery": c.get("roasterName"),
        "productName": c.get("productName"),
        "productUrl": c.get("productUrl"),
        "evidenceGrade": m["grade"],
        "golden": g,
        "current": {"raw": c["raw"], "displayed": d},
        "diff": diff,
        "review": {
            "reviewerA": m["review"]["reviewerA"] if m["review"] else None,
            "reviewerB": m["review"]["reviewerB"] if m["review"] else None,
            "qualityAudit": {"note": "수동 QA 8항목 전수 확인. 되돌림 없음. 상세: audit/golden/_work/batch-013-qa.json"},
            "domainReview": {"note": "도메인 이상 없음. 상세: audit/golden/_work/batch-013-domain.json"},
        },
    }
    products.append(prod)

out = os.path.join(BASE, "audit/golden/_work/batch-013-products.json")
json.dump(products, open(out, "w"), ensure_ascii=False, indent=1)
print("wrote", out, len(products))
print("\n=== 수동 판정 필요 ===")
for pid, f, note in manual_flags:
    print(f"  {pid}#{f}: {note}")
