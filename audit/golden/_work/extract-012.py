import json, os

ROOT = '/home/hatch/workspace/beanpick'
b = json.load(open(ROOT + '/audit/golden/batches.json'))
ids = b['batches'][11]['ids']
cv = json.load(open(ROOT + '/audit/golden/current-values.json'))['current']

out = []
for i in ids:
    e = cv[i]
    rec = {
        'id': i,
        'evidenceGrade': e.get('evidenceGrade'),
        'roastery': e.get('roasterName'),
        'productName': e.get('productName'),
        'productUrl': e.get('productUrl'),
        'isSoldOut': e.get('isSoldOut'),
        'current': e,
        'evidenceFile': e.get('evidenceFile'),
        'detailText': '',
        'rawTexts': [],
        'ocrNotes': [],
        'detailImageUrls': [],
    }
    ef = e.get('evidenceFile')
    if ef:
        p = ROOT + '/audit-input/' + ef
        if os.path.exists(p):
            d = json.load(open(p))
            ev = d.get('evidence', {}) or {}
            dc = ev.get('detailCache', {}) or {}
            dt = dc.get('detailText') or ''
            rec['detailText'] = dt[:4000] + ('…(생략)' if len(dt) > 4000 else '')
            for ro in (ev.get('rawObservations') or []):
                t = (ro.get('text') or '').strip()
                if t:
                    rec['rawTexts'].append({
                        'url': ro.get('url'),
                        'text': t[:2000] + ('…(생략)' if len(t) > 2000 else ''),
                    })
            for o in (ev.get('ocr') or []):
                outp = o.get('output') or ''
                rec['ocrNotes'].append({
                    'method': o.get('method'),
                    'imageUrl': o.get('imageUrl'),
                    'output': outp,
                })
            rec['detailImageUrls'] = dc.get('detailImageUrls') or ev.get('detailImageUrls') or []
    out.append(rec)

json.dump(out, open(ROOT + '/audit/golden/_work/batch-012-evidence.json', 'w'), ensure_ascii=False, indent=1)
for r in out:
    print(r['id'], r['evidenceGrade'], 'detailText:', len(r['detailText']), 'rawTexts:', len(r['rawTexts']), 'ocrNotes:', len(r['ocrNotes']), 'images:', len(r['detailImageUrls']))
