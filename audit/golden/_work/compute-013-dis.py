# Compute A/B disagreements with normalization equivalence (regression-rules.md §1)
import json, os, re

BASE = os.path.expanduser("~/workspace/beanpick")
A = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-013-reviewerA.json")))
B = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-013-reviewerB.json")))

CORE_FIELDS = ["productType", "status", "originCountry", "originRegion", "producer",
               "process", "variety", "roast", "tastingNotes", "decafMethod"]

def norm_str(s):
    if s is None:
        return None
    s = str(s).strip()
    s = re.sub(r"\s+", " ", s)
    # 한글 토큰 내부 공백 제거는 토큰 단위로: 영문 소문자화
    s = s.lower()
    # 구분자 무시 → 토큰 집합
    toks = re.split(r"[\s,·/│|()\[\]]+", s)
    toks = [t for t in toks if t]
    return frozenset(toks)

def norm_val(v):
    if v is None:
        return None
    if isinstance(v, list):
        toks = set()
        for item in v:
            n = norm_str(item)
            if n:
                toks |= set(n)
        return frozenset(toks)
    return norm_str(v)

def equiv(fa, fb):
    va, vb = fa.get("value"), fb.get("value")
    if va is None and vb is None:
        return True
    if (va is None) != (vb is None):
        return False
    return norm_val(va) == norm_val(vb)

dis = []
for pid in A:
    ga, gb = A[pid]["golden"], B[pid]["golden"]
    fields = [f for f in CORE_FIELDS if f in ga or f in gb]
    for f in fields:
        fa = ga.get(f) or {"value": None}
        fb = gb.get(f) or {"value": None}
        if not equiv(fa, fb):
            dis.append({"id": pid, "field": f, "A": fa, "B": fb})

out = os.path.join(BASE, "audit/golden/_work/batch-013-disagreements.json")
json.dump(dis, open(out, "w"), ensure_ascii=False, indent=1)
print("disagreements:", len(dis))
for d in dis:
    print(f"  {d['id']}#{d['field']}: A={json.dumps(d['A']['value'], ensure_ascii=False)} B={json.dumps(d['B']['value'], ensure_ascii=False)}")
