#!/usr/bin/env python3
# 배치 16 병합: A golden(일치 필드) + Judge(finalGolden, 불일치 필드) + C등급 기계 처리
# 출력: audit/golden/_work/batch-016-merged.json {pid: {golden, review, grade}}
import json, os

BASE = os.path.expanduser("~/workspace/beanpick")
N = 16
A = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-%03d-reviewerA.json" % N)))
B = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-%03d-reviewerB.json" % N)))
J = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-%03d-judge.json" % N)))
EV = {e["id"]: e for e in json.load(open(os.path.join(BASE, "audit/golden/_work/batch-%03d-evidence.json" % N)))}
BATCH = json.load(open(os.path.join(BASE, "audit/golden/batches.json")))["batches"][N - 1]

def c_mechanical(e):
    iso = e["isSoldOut"]
    g = {}
    for f in ["productType", "originCountry", "originRegion", "producer", "process", "variety", "roast"]:
        g[f] = {"value": None, "raw": None, "confidence": "UNKNOWN",
                "evidence": "제공된 증거 없음 (스냅샷만 존재)",
                "evidenceSource": "manifest: hasEvidenceBeyondSnapshot=false"}
    g["tastingNotes"] = {"value": [], "raw": [], "confidence": "UNKNOWN",
                         "evidence": "제공된 증거 없음 (스냅샷만 존재)",
                         "evidenceSource": "manifest: hasEvidenceBeyondSnapshot=false"}
    g["status"] = {"value": "soldout" if iso else "active",
                   "raw": "soldout" if iso else "active",
                   "confidence": "MEDIUM",
                   "evidence": "isSoldOut=%s (수집 플래그)" % iso,
                   "evidenceSource": "collector_flag"}
    return g

merged = {}
for pid in BATCH["ids"]:
    e = EV[pid]
    grade = e["evidenceGrade"]
    if grade == "C":
        merged[pid] = {"golden": c_mechanical(e), "grade": "C",
                       "review": {"note": "C-grade mechanical: no evidence, skipped independent review"}}
        continue
    ga = A[pid]["golden"]
    gb = B[pid]["golden"]
    final = {f: dict(v) for f, v in ga.items()}
    judge_note = None
    if pid in J:
        for f, fv in J[pid]["finalGolden"].items():
            final[f] = fv
        judge_note = {f: {"choice": d["choice"], "reason": d["reason"]}
                      for f, d in J[pid]["decisions"].items()}
    merged[pid] = {
        "golden": final,
        "grade": grade,
        "review": {
            "note": "Judge 적용: A/B 일치 필드는 A 값, 불일치 필드는 Judge 판정",
            "reviewerA": {"golden": ga},
            "reviewerB": {"golden": gb},
            "judge": judge_note,
        },
    }

out = os.path.join(BASE, "audit/golden/_work/batch-%03d-merged.json" % N)
json.dump(merged, open(out, "w"), ensure_ascii=False, indent=1)
print("wrote", out, len(merged))
# 필드 키 점검
import collections
keysets = collections.Counter(tuple(sorted(m["golden"].keys())) for m in merged.values())
print("golden key sets:", dict(keysets))
