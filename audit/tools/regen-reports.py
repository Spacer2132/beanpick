#!/usr/bin/env python3
# PHASE-1-FINAL / roastery-quality-report 용 (a)(b)(c) 수치 재생성.
# golden 배치 diff + current-values.json 에서 전부 계산. 손으로 적은 숫자 없음.
import json
from collections import defaultdict

FIELDS = ['originCountry', 'process', 'producer', 'roast', 'tastingNotes', 'variety']
DM = {'originCountry': 'originCountry', 'process': 'process', 'producer': 'region',
      'roast': 'roastLevel', 'tastingNotes': 'tastingNotes', 'variety': 'variety'}

def has_value(v):
    if v is None:
        return False
    if isinstance(v, list):
        return len(v) > 0
    return str(v).strip() != '' and str(v).strip() != '확인 필요'

cur = json.load(open('audit/golden/current-values.json', encoding='utf-8'))['current']

# (a) 판정 가능 기준 정확도 = match/(match+mismatch)
acc = {}
for f in FIELDS:
    t = fa = 0
    for n in range(1, 20):
        b = json.load(open(f'audit/golden/batch-{n:03d}.json', encoding='utf-8'))
        for p in b['products']:
            d = p['diff'].get(f) if isinstance(p['diff'], dict) else {}
            if not isinstance(d, dict) or d.get('failureReason') == 'NOT_DISPLAYED_FIELD':
                continue
            if d.get('match') is True:
                t += 1
            elif d.get('match') is False:
                fa += 1
    acc[f] = (t, fa)

# (b) 값 재현율 (golden HIGH/MEDIUM 값 보유, current_echo 제외, match=True)
rec = {}
for f in FIELDS:
    num = den = 0
    for n in range(1, 20):
        b = json.load(open(f'audit/golden/batch-{n:03d}.json', encoding='utf-8'))
        for p in b['products']:
            g = p['golden'].get(f) or {}
            if not isinstance(g, dict):
                continue
            if has_value(g.get('value')) and g.get('confidence') in ('HIGH', 'MEDIUM') \
                    and g.get('evidenceKind') != 'current_echo':
                den += 1
                d = p['diff'].get(f) if isinstance(p['diff'], dict) else {}
                if isinstance(d, dict) and d.get('match') is True:
                    num += 1
    rec[f] = (num, den)

# (c) FALSE_POSITIVE (golden SOURCE_MISSING + displayed 값 있음)
fp = {}
for f in FIELDS:
    n = tot = 0
    for nn in range(1, 20):
        b = json.load(open(f'audit/golden/batch-{nn:03d}.json', encoding='utf-8'))
        for p in b['products']:
            g = p['golden'].get(f) or {}
            if not isinstance(g, dict) or g.get('confidence') != 'SOURCE_MISSING':
                continue
            tot += 1
            if has_value(cur[p['id']]['displayed'][DM[f]]):
                n += 1
    fp[f] = (n, tot)

print('## (a) 판정 가능 기준 정확도')
print()
print('| 필드 | 정확도 |')
print('|---|---|')
for f in FIELDS:
    t, fa = acc[f]
    print(f'| {f} | {t/(t+fa):.1%} ({t}/{t+fa}) |')
print()
print('## (b) 값 재현율 (golden HIGH/MEDIUM, current_echo 제외)')
print()
print('| 필드 | 재현율 |')
print('|---|---|')
for f in FIELDS:
    num, den = rec[f]
    print(f'| {f} | {num/den:.1%} ({num}/{den}) |' if den else f'| {f} | — |')
print()
print('## (c) FALSE_POSITIVE (golden SOURCE_MISSING → 표시값 있음)')
print()
print('| 필드 | 건수 |')
print('|---|---|')
for f in FIELDS:
    n, tot = fp[f]
    print(f'| {f} | {n}/{tot} |')

# 로스터리별 표용 데이터도 JSON으로 저장
def roast_name(p, pid):
    return p.get('roastery') or cur[pid].get('roasterName') or pid.split('-')[0]

rrec = defaultdict(lambda: defaultdict(lambda: [0, 0]))
rfp = defaultdict(lambda: defaultdict(lambda: [0, 0]))
counts = defaultdict(int)
for n in range(1, 20):
    b = json.load(open(f'audit/golden/batch-{n:03d}.json', encoding='utf-8'))
    for p in b['products']:
        r = roast_name(p, p['id'])
        counts[r] += 1
        for f in FIELDS:
            g = p['golden'].get(f) or {}
            if not isinstance(g, dict):
                continue
            if g.get('confidence') == 'SOURCE_MISSING':
                rfp[r][f][1] += 1
                if has_value(cur[p['id']]['displayed'][DM[f]]):
                    rfp[r][f][0] += 1
            elif has_value(g.get('value')) and g.get('confidence') in ('HIGH', 'MEDIUM') \
                    and g.get('evidenceKind') != 'current_echo':
                rrec[r][f][1] += 1
                d = p['diff'].get(f) if isinstance(p['diff'], dict) else {}
                if isinstance(d, dict) and d.get('match') is True:
                    rrec[r][f][0] += 1

out = {'counts': dict(counts), 'recall': {r: {f: rrec[r][f] for f in FIELDS} for r in counts},
       'fp': {r: {f: rfp[r][f] for f in FIELDS} for r in counts}}
json.dump(out, open('/tmp/roastery-stats.json', 'w', encoding='utf-8'), ensure_ascii=False)
print()
print('로스터리 통계 저장: /tmp/roastery-stats.json')
