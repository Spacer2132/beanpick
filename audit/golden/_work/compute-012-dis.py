import json, re

A = json.load(open('/home/hatch/workspace/beanpick/audit/golden/_work/batch-012-reviewerA.json'))
B = json.load(open('/home/hatch/workspace/beanpick/audit/golden/_work/batch-012-reviewerB.json'))

COUNTRY_EN = {'에티오피아':'ethiopia','ethiopia':'ethiopia','콜롬비아':'colombia','colombia':'colombia',
 '파나마':'panama','panama':'panama','케냐':'kenya','kenya':'kenya','과테말라':'guatemala','guatemala':'guatemala',
 '브라질':'brazil','brazil':'brazil','멕시코':'mexico','mexico':'mexico','인도네시아':'indonesia','indonesia':'indonesia',
 '온두라스':'honduras','honduras':'honduras'}

def ntok(s):
    s = str(s).strip()
    s = re.sub(r'\s+', ' ', s)
    # 한글 토큰 내부 공백 제거
    s = re.sub(r'(?<=[가-힣]) (?=[가-힣])', '', s)
    return s.lower()

def toks(v):
    if v is None: return None
    parts = re.split(r'[,·/|()]+', str(v))
    out = set()
    for p in parts:
        p = ntok(p)
        if p: out.add(p)
    return out

def norm_country_set(v):
    t = toks(v)
    if t is None: return None
    return {COUNTRY_EN.get(x, x) for x in t}

def eq(field, va, vb):
    if va is None and vb is None: return True
    if va is None or vb is None: return False
    if field == 'originCountry':
        return norm_country_set(va) == norm_country_set(vb)
    if field == 'tastingNotes':
        ta = {ntok(x) for x in va}; tb = {ntok(x) for x in vb}
        return ta == tb
    return toks(va) == toks(vb)

FIELDS = ['productType','status','originCountry','originRegion','producer','process','variety','roast','tastingNotes']
dis = []
for pid in A:
    ga, gb = A[pid]['golden'], B[pid]['golden']
    for f in FIELDS:
        va, vb = ga[f]['value'], gb[f]['value']
        if not eq(f, va, vb):
            dis.append({'id': pid, 'field': f, 'A': ga[f], 'B': gb[f]})

json.dump(dis, open('/home/hatch/workspace/beanpick/audit/golden/_work/batch-012-disagreements.json','w'), ensure_ascii=False, indent=1)
print('disagreements:', len(dis))
for d in dis:
    print('-', d['id'], d['field'])
    print('   A:', json.dumps(d['A']['value'], ensure_ascii=False), d['A']['confidence'])
    print('   B:', json.dumps(d['B']['value'], ensure_ascii=False), d['B']['confidence'])
