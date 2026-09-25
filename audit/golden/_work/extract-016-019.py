#!/usr/bin/env python3
# 배치 16~19 증거 사전 추출 (PHASE-1-PROTOCOL.md §3)
# 출력: audit/golden/_work/batch-0NN-evidence.json (NN = 16,17,18,19)
import json, os

BASE = os.path.expanduser("~/workspace/beanpick")
BATCHES = json.load(open(os.path.join(BASE, "audit/golden/batches.json")))["batches"]
CV = json.load(open(os.path.join(BASE, "audit/golden/current-values.json")))["current"]

def extract_one(pid):
    c = CV[pid]
    ef = c["evidenceFile"]
    epath = os.path.join(BASE, "audit-input", ef)
    ev = {}
    if os.path.exists(epath):
        ev = json.load(open(epath)).get("evidence", {}) or {}
    dc = ev.get("detailCache", {}) or {}
    dt = dc.get("detailText") or ""
    dt_full = len(dt)
    detail_text = dt[:4000] + ("…(생략)" if dt_full > 4000 else "")
    raw_texts = []
    for r in (ev.get("rawObservations") or []):
        t = r.get("text") or ""
        if not t.strip():
            continue
        raw_texts.append({
            "url": r.get("url") or r.get("sourceUrl") or "",
            "text": t[:2000] + ("…(생략)" if len(t) > 2000 else ""),
        })
    ocr_notes = []
    for o in (ev.get("ocr") or []):
        ocr_notes.append({
            "imageUrl": o.get("imageUrl") or "",
            "output": str(o.get("output") or "")[:3000],
        })
    return {
        "id": pid,
        "evidenceGrade": c.get("evidenceGrade"),
        "roastery": c.get("roasterName"),
        "productName": c.get("productName"),
        "productUrl": c.get("productUrl"),
        "isSoldOut": c.get("isSoldOut"),
        "current": c,
        "evidenceFile": ef,
        "detailText": detail_text,
        "detailTextFullLen": dt_full,
        "rawTexts": raw_texts,
        "ocrNotes": ocr_notes,
        "detailImageUrls": dc.get("detailImageUrls") or [],
    }

for n in (16, 17, 18, 19):
    batch = BATCHES[n - 1]
    ids = batch["ids"]
    items = [extract_one(pid) for pid in ids]
    out = os.path.join(BASE, "audit/golden/_work/batch-%03d-evidence.json" % n)
    json.dump(items, open(out, "w"), ensure_ascii=False, indent=1)
    grades = {}
    for it in items:
        grades[it["evidenceGrade"]] = grades.get(it["evidenceGrade"], 0) + 1
    print("wrote", out, len(items), grades)
