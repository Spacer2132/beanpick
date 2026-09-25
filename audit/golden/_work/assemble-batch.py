#!/usr/bin/env python3
# 배치 최종 조립 (공용): audit/golden/batch-0NN.json
# 사용법: python3 assemble-batch.py 17
# tastingNotes comparable/droppedByNormalizer는 이후 compute-comparable.mjs가 채움
import json, os, re, collections, sys

BASE = os.path.expanduser("~/workspace/beanpick")
N = int(sys.argv[1])
MERGED = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-%03d-merged.json" % N)))
CV = json.load(open(os.path.join(BASE, "audit/golden/current-values.json")))["current"]
BATCH = json.load(open(os.path.join(BASE, "audit/golden/batches.json")))["batches"][N - 1]
QA = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-%03d-qa.json" % N)))
DOMAIN = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-%03d-domain.json" % N)))
DIS = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-%03d-disagreements.json" % N)))

def norm_toks(s):
    s = re.sub(r"\s+", " ", str(s).strip()).lower()
    return frozenset(t for t in re.split(r"[\s,·/│|()\[\]]+", s) if t)

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

def unav_note(g):
    return "판정 불가 (golden UNKNOWN)"

def diff_status(g, d):
    gv, dv = g["value"], d["status"]
    if gv == dv:
        if g.get("evidenceSource") == "collector_flag":
            return {"match": True, "case": None, "failureReason": None,
                    "note": "정확도 통계에서 제외 (collector_flag)"}
        return {"match": True, "case": None, "failureReason": None, "note": "원문 근거로 일치"}
    return {"match": False, "case": 1, "failureReason": "PARSER_MISS",
            "note": "golden=%s vs displayed=%s — 정확도 통계에서 제외" % (gv, dv)}

def diff_simple(g, dv, fname):
    if g["confidence"] == "UNKNOWN":
        return {"match": None, "case": 3, "failureReason": "EVIDENCE_UNAVAILABLE",
                "note": unav_note(g)}
    gv = g["value"]
    if empty(gv) and empty(dv):
        return {"match": True, "case": None, "failureReason": None, "note": "둘 다 정보 없음"}
    if eq(gv, dv):
        return {"match": True, "case": None, "failureReason": None, "note": "정규화 후 일치"}
    if empty(gv):
        return {"match": False, "case": 1, "failureReason": "FALSE_POSITIVE",
                "note": "golden %s인데 표시값: \"%s\"" % (g["confidence"], dv)}
    return {"match": False, "case": 1, "failureReason": "PARSER_MISS",
            "note": "golden=\"%s\" vs displayed=\"%s\" — 원문 정보를 표시가 놓침" % (gv, dv)}

def diff_producer(g, region):
    if g["confidence"] == "UNKNOWN":
        return {"match": None, "case": 3, "failureReason": "EVIDENCE_UNAVAILABLE",
                "note": unav_note(g)}
    gv = g["value"]
    if empty(gv):
        if empty(region):
            return {"match": True, "case": None, "failureReason": None, "note": "둘 다 정보 없음"}
        return {"match": False, "case": 1, "failureReason": "FALSE_POSITIVE",
                "note": "golden SOURCE_MISSING인데 '농장' 행 표시값: \"%s\" (상품명 잔여 텍스트)" % region}
    if empty(region):
        return {"match": False, "case": 1, "failureReason": "PARSER_MISS",
                "note": "golden=\"%s\" vs 농장행 없음 — 생산자를 표시가 놓침" % gv}
    gn, rn = norm_set(gv), norm_set(region)
    if gn & rn:
        return {"match": True, "case": None, "failureReason": None, "note": "정규화 후 일치"}
    gs = re.sub(r"\s+", "", str(gv)).lower()
    rs = re.sub(r"\s+", "", str(region)).lower()
    if gs in rs or rs in gs:
        return {"match": True, "case": None, "failureReason": None, "note": "정규화 후 일치"}
    return {"match": "MANUAL", "case": 1, "failureReason": "TBD",
            "note": "golden=\"%s\" vs 농장행=\"%s\" — 수동 판정 필요" % (gv, region)}

def diff_roast(g, d, smartstore):
    if g["confidence"] == "UNKNOWN":
        return {"match": None, "case": 3, "failureReason": "EVIDENCE_UNAVAILABLE",
                "note": unav_note(g)}
    gv, dv = g["value"], d["roastLevel"]
    if empty(gv) and (empty(dv) or dv == "확인 필요"):
        return {"match": True, "case": None, "failureReason": None, "note": "둘 다 정보 없음"}
    if eq(gv, dv):
        return {"match": True, "case": None, "failureReason": None, "note": "정규화 후 일치"}
    if dv == "확인 필요":
        if smartstore:
            return {"match": False, "case": 1, "failureReason": "NOT_IMPLEMENTED",
                    "note": "golden=%s이나 스마트스토어 수집이 roastLevel을 '확인 필요'로 고정" % gv}
        return {"match": False, "case": 1, "failureReason": "PARSER_MISS",
                "note": "golden=%s vs displayed '확인 필요' — 공식몰 기본정보표의 볶음도를 수집이 놓침" % gv}
    return {"match": False, "case": 1, "failureReason": "PARSER_MISS",
            "note": "golden=%s vs displayed=\"%s\"" % (gv, dv)}

def diff_notes(g, disp_notes):
    # batch-015 관행: golden.value vs displayed 집합 비교
    if g["confidence"] == "UNKNOWN":
        return {"match": None, "case": 3, "failureReason": "EVIDENCE_UNAVAILABLE",
                "note": unav_note(g)}
    gv = g["value"] or []
    dn = disp_notes or []
    if not gv and not dn:
        return {"match": True, "case": None, "failureReason": None, "note": "둘 다 정보 없음"}
    if norm_set(gv) == norm_set(dn):
        return {"match": True, "case": None, "failureReason": None, "note": "정규화 후 일치"}
    missing = sorted(set(x for x in gv) - set(x for x in dn))
    extra = sorted(set(x for x in dn) - set(x for x in gv))
    parts = []
    if missing: parts.append("누락 %s" % missing)
    if extra: parts.append("추가 %s" % extra)
    if extra and not missing:
        fr = "FALSE_POSITIVE"
    elif missing and not extra:
        fr = "PARSER_MISS"
    else:
        fr = "NORMALIZATION_ERROR"
    return {"match": False, "case": 1, "failureReason": fr,
            "note": "golden=%s vs displayed=%s — %s" % (gv, dn, "; ".join(parts))}

# OCR 충돌 특례 (배치별): {pid: field}
OCR_CONFLICT = {
    16: {"cafedoan-13647238261": "tastingNotes"},
    17: {"cafedoan-12994609419": "tastingNotes",
         "cafedoan-10838004944": "tastingNotes"},
}.get(N, {})

FIELD_ORDER = ["productType", "status", "originCountry", "originRegion", "producer",
               "process", "decafMethod", "variety", "roast", "tastingNotes"]

products = []
manual_flags = []
for pid in BATCH["ids"]:
    m = MERGED[pid]
    c = CV[pid]
    g = m["golden"]
    d = c["displayed"]
    go = {f: g[f] for f in FIELD_ORDER if f in g}
    diff = {
        "productType": dict(NOT_DISP),
        "originRegion": dict(NOT_DISP),
        "status": diff_status(go["status"], d),
        "originCountry": diff_simple(go["originCountry"], d["originCountry"], "originCountry"),
        "producer": diff_producer(go["producer"], d.get("region", "")),
        "process": diff_simple(go["process"], d["process"], "process"),
        "variety": diff_simple(go["variety"], d["variety"], "variety"),
        "roast": diff_roast(go["roast"], d, c.get("smartstore")),
        "tastingNotes": diff_notes(go["tastingNotes"], d["tastingNotes"]),
    }
    if pid in OCR_CONFLICT:
        f = OCR_CONFLICT[pid]
        diff[f] = {"match": None, "case": 3, "failureReason": "OCR_CONFLICT",
                   "note": "동일 이미지 OCR 정면 충돌 — 원문 이미지 없이는 해결 불가 (CASE 3)"}
    for f, dd in diff.items():
        if dd["match"] == "MANUAL" or dd["failureReason"] == "TBD":
            manual_flags.append((pid, f, dd["note"]))
    if m["grade"] == "C":
        review = {"note": "C-grade mechanical: no evidence, skipped independent review"}
    else:
        nj = len((m["review"].get("judge") or {}))
        review = {
            "note": "Reviewer A/B 독립 판정 + Judge 불일치 해소(%d건) + QA/도메인 리뷰. 상세: audit/golden/_work/batch-%03d-judge.json, batch-%03d-qa.json, batch-%03d-domain.json" % (nj, N, N, N),
            "reviewerA": m["review"]["reviewerA"],
            "reviewerB": m["review"]["reviewerB"],
        }
    products.append({
        "id": pid,
        "roastery": c.get("roasterName"),
        "productName": c.get("productName"),
        "productUrl": c.get("productUrl"),
        "evidenceGrade": m["grade"],
        "golden": go,
        "current": {k: c.get(k) for k in ["id", "roasterName", "productName", "productUrl",
                                          "isSoldOut", "smartstore", "evidenceGrade",
                                          "evidenceFile", "raw", "displayed"]},
        "diff": diff,
        "review": review,
    })

FIELDS9 = ["productType", "status", "originCountry", "originRegion", "producer",
           "process", "variety", "roast", "tastingNotes"]
total = len(products)
cMech = sum(1 for p in products if p["evidenceGrade"] == "C")
reviewed = total - cMech
n_dis = sum(len(v) for v in DIS.values())
n_dis_excl = sum(1 for v in DIS.values() for f in v if f != "status")
unknown = sum(1 for p in products for f in FIELDS9
              if (p["golden"].get(f) or {}).get("confidence") == "UNKNOWN")
unknownExclC = sum(1 for p in products if p["evidenceGrade"] != "C" for f in FIELDS9
                   if (p["golden"].get(f) or {}).get("confidence") == "UNKNOWN")
srcmiss = sum(1 for p in products for f in FIELDS9
              if (p["golden"].get(f) or {}).get("confidence") == "SOURCE_MISSING")
unmapped = sum(1 for p in products for f in FIELDS9
               if (p["golden"].get(f) or {}).get("mappingStatus") == "UNMAPPED_LABEL")
mismatch = 0
frDist = collections.Counter()
for p in products:
    for f, dd in p["diff"].items():
        if f == "status":
            continue
        if dd["match"] is False:
            mismatch += 1
            frDist[dd["failureReason"]] += 1
nfields = total * len(FIELDS9)
summary = {
    "total": total,
    "cMechanical": cMech,
    "reviewed": reviewed,
    "disagreements": n_dis,
    "disagreementsExclStatus": n_dis_excl,
    "disagreementRateExclStatus": round(n_dis_excl / (reviewed * 8), 4) if reviewed else 0,
    "unknownFieldCount": unknown,
    "unknownFieldRate": round(unknown / nfields, 4),
    "unknownFieldCountExclC": unknownExclC,
    "sourceMissingFieldCount": srcmiss,
    "sourceMissingFieldRate": round(srcmiss / nfields, 4),
    "unmappedLabelFieldCount": unmapped,
    "mismatchCountExclStatus": mismatch,
    "failureReasonDistributionExclStatus": dict(frDist),
    "statusExcludedFromAccuracy": True,
    "qaReversals": len(QA["reversals"]),
    "domainCorrections": len(DOMAIN["corrections"]),
    "topMisjudgments": [],
    "revisionNotes": "",
}

out = {
    "batch": N,
    "ids": BATCH["ids"],
    "snapshot": {"sha256": "ac7739a73376f125a8a200796391a128b206a4da50582fbfa8e350723e6d0b81",
                 "repoHead": "88fad74faad43b8a1e8abf6ef7676c62ed0a9f09",
                 "count": 454},
    "summary": summary,
    "products": products,
}
fp = os.path.join(BASE, "audit/golden/batch-%03d.json" % N)
json.dump(out, open(fp, "w"), ensure_ascii=False, indent=1)
print("wrote", fp)
print("summary:", json.dumps({k: v for k, v in summary.items()
      if k not in ("topMisjudgments", "revisionNotes")}, ensure_ascii=False, indent=1))
print("\n=== 수동 판정 필요 ===")
for pid, f, note in manual_flags:
    print(" ", pid, "#", f, ":", note)
