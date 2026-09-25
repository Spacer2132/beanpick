# Batch 13 evidence pre-extraction (protocol §3)
import json, os

BASE = os.path.expanduser('~/workspace/beanpick')
cv = json.load(open(os.path.join(BASE, 'audit/golden/current-values.json')))['current']
batches = json.load(open(os.path.join(BASE, 'audit/golden/batches.json')))
ids = batches['batches'][12]['ids']
assert isinstance(ids, list) and len(ids) == 25, len(ids)

out = []
for pid in ids:
    cur = cv[pid]
    grade = cur.get('evidenceGrade')
    rec = {
        'id': pid,
        'evidenceGrade': grade,
        'roastery': cur.get('roasterName'),
        'productName': cur.get('productName'),
        'productUrl': cur.get('productUrl'),
        'isSoldOut': cur.get('isSoldOut'),
        'current': cur,
    }
    if grade != 'C':
        ef = cur.get('evidenceFile')
        rec['evidenceFile'] = ef
        ev = json.load(open(os.path.join(BASE, 'audit-input', ef)))['evidence']
        dc = ev.get('detailCache') or {}
        dt = dc.get('detailText') or ''
        if len(dt) > 4000:
            dt = dt[:4000] + '…(생략)'
        rec['detailText'] = dt
        rec['rawTexts'] = [
            {'url': ro.get('url'), 'text': (ro.get('text') or '')[:2000]}
            for ro in (ev.get('rawObservations') or [])
            if (ro.get('text') or '').strip()
        ]
        rec['ocrNotes'] = ev.get('ocr') or []
        rec['detailImageUrls'] = ev.get('detailImageUrls') or []
    out.append(rec)

of = os.path.join(BASE, 'audit/golden/_work/batch-013-evidence.json')
json.dump(out, open(of, 'w'), ensure_ascii=False, indent=1)
print('wrote', of, 'items:', len(out))
print('grades:', {g: sum(1 for r in out if r['evidenceGrade'] == g) for g in set(r['evidenceGrade'] for r in out)})
