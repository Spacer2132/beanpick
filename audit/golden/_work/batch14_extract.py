"""배치 14 증거 사전 추출 (PROTOCOL §3).
current-values.json에서는 evidenceGrade/isSoldOut 메타데이터만 읽고
raw/displayed 판정값은 보지 않는다(B 블라인드 유지)."""
import json, glob, os

REPO = os.path.expanduser("~/workspace/beanpick")
BATCHES = json.load(open(f"{REPO}/audit/golden/batches.json"))["batches"][13]["ids"]
CUR = json.load(open(f"{REPO}/audit/golden/current-values.json"))["current"]
PROD = f"{REPO}/audit-input/products"

items = []
for pid in BATCHES:
    meta = CUR[pid]
    files = glob.glob(f"{PROD}/{pid}-*.json")
    if len(files) != 1:
        raise SystemExit(f"evidence file ambiguous for {pid}: {files}")
    efile = "products/" + os.path.basename(files[0])
    d = json.load(open(files[0]))
    snap = d.get("snapshotRecord", {})
    ev = d.get("evidence", {})
    dc = ev.get("detailCache") or {}
    dt = dc.get("detailText") or ""
    raw_obs = []
    for o in ev.get("rawObservations", []) or []:
        t = (o.get("text") or "")
        if t.strip():
            raw_obs.append({"url": o.get("url", ""), "text": t[:2000]})
    ocr_notes = []
    for o in ev.get("ocr", []) or []:
        ocr_notes.append({
            "method": o.get("method"),
            "imageUrl": o.get("imageUrl", ""),
            "output": (o.get("output") or "")[:4000],
        })
    items.append({
        "id": pid,
        "evidenceGrade": meta.get("evidenceGrade"),
        "roastery": snap.get("roasterName", ""),
        "productName": snap.get("productName", ""),
        "productUrl": snap.get("productUrl", ""),
        "isSoldOut": snap.get("isSoldOut", False),
        "current": meta,  # A 패스·diff용 (B 패스는 보지 않음)
        "evidenceFile": efile,
        "detailText": dt[:4000] + ("…(생략)" if len(dt) > 4000 else ""),
        "detailTextFullLen": len(dt),
        "rawTexts": raw_obs,
        "ocrNotes": ocr_notes,
        "detailImageUrls": dc.get("detailImageUrls", []) or [],
    })

out = f"{REPO}/audit/golden/_work/batch-014-evidence.json"
json.dump(items, open(out, "w"), ensure_ascii=False, indent=1)
print("wrote", out, len(items))
for it in items:
    print(f"  {it['id'][:40]:42s} grade={it['evidenceGrade']} soldout={it['isSoldOut']} dt={it['detailTextFullLen']} rawObs={len(it['rawTexts'])} ocr={len(it['ocrNotes'])} imgs={len(it['detailImageUrls'])}")
