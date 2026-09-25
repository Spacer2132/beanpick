# Merge batch-13 golden: A + judge rulings + C-grade mechanical
import json, os

BASE = os.path.expanduser("~/workspace/beanpick")
A = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-013-reviewerA.json")))
B = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-013-reviewerB.json")))
JR = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-013-judge-record.json")))
CV = json.load(open(os.path.join(BASE, "audit/golden/current-values.json")))["current"]
BATCH = json.load(open(os.path.join(BASE, "audit/golden/batches.json")))["batches"][12]

# Judge rulings -> field blocks
RULINGS = {(j["id"], j["field"]): j for j in JR["judge"]}

def field_from_ruling(j):
    blk = {"value": j["value"], "raw": j["raw"], "confidence": j["confidence"],
           "evidence": j["evidence"], "evidenceSource": j["evidenceSource"]}
    return blk

# reviewed ids (A/B)
reviewed_ids = set(A.keys())
C_IDS = ["aerycoffee-13630757741", "에어리커피-에어리커피-파나마엘리다카투아이asd내추럴",
         "hocuspocus-13171120597", "hocuspocus-11755845475", "aerycoffee-12350337347"]

# isSoldOut flags for C-grade
SOLDOUT = {pid: CV[pid]["isSoldOut"] for pid in C_IDS}

def c_field(f, pid):
    if f == "status":
        v = "soldout" if SOLDOUT[pid] else "active"
        return {"value": v, "raw": v, "confidence": "MEDIUM",
                "evidence": f"isSoldOut={SOLDOUT[pid]} (수집 플래그)",
                "evidenceSource": "collector_flag"}
    if f == "tastingNotes":
        return {"value": [], "raw": [], "confidence": "UNKNOWN",
                "evidence": "제공된 증거 없음 (스냅샷만 존재)",
                "evidenceSource": "manifest: hasEvidenceBeyondSnapshot=false",
                "comparable": [], "droppedByNormalizer": []}
    return {"value": None, "raw": None, "confidence": "UNKNOWN",
            "evidence": "제공된 증거 없음 (스냅샷만 존재)",
            "evidenceSource": "manifest: hasEvidenceBeyondSnapshot=false"}

FIELDS = ["productType","status","originCountry","originRegion","producer",
          "process","variety","roast","tastingNotes"]

merged = {}
for pid in BATCH["ids"]:
    if pid in reviewed_ids:
        g = {f: dict(A[pid]["golden"][f]) for f in A[pid]["golden"]}
        # apply judge rulings
        for (jid, jf), j in RULINGS.items():
            if jid == pid:
                g[jf] = field_from_ruling(j)
                # preserve comparable/droppedByNormalizer for tastingNotes if present
                if jf == "tastingNotes" and "comparable" in A[pid]["golden"].get("tastingNotes", {}):
                    g[jf]["comparable"] = A[pid]["golden"]["tastingNotes"]["comparable"]
                    g[jf]["droppedByNormalizer"] = A[pid]["golden"]["tastingNotes"]["droppedByNormalizer"]
        merged[pid] = {"golden": g, "grade": CV[pid]["evidenceGrade"],
                       "review": {"reviewerA": A[pid], "reviewerB": B[pid]}}
    else:
        g = {f: c_field(f, pid) for f in FIELDS}
        merged[pid] = {"golden": g, "grade": "C", "review": None}

out = os.path.join(BASE, "audit/golden/_work/batch-013-merged.json")
json.dump(merged, open(out, "w"), ensure_ascii=False, indent=1)
print("wrote", out, len(merged), "products")
# sanity: judge applied
for (jid, jf), j in RULINGS.items():
    print(f"  judge {jid}#{jf}: {merged[jid]['golden'][jf]['value']}")
