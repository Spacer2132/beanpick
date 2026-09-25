import json, re, copy

ROOT = '/home/hatch/workspace/beanpick'
A = json.load(open(ROOT + '/audit/golden/_work/batch-012-reviewerA.json'))
B = json.load(open(ROOT + '/audit/golden/_work/batch-012-reviewerB.json'))
JREC = json.load(open(ROOT + '/audit/golden/_work/batch-012-judge-record.json'))
CV = json.load(open(ROOT + '/audit/golden/current-values.json'))['current']
BATCH = json.load(open(ROOT + '/audit/golden/batches.json'))
IDS = BATCH['batches'][11]['ids']

JMAP = {(j['id'], j['field']): j['verdict'] for j in JREC['judge']}

FIELDS = ['productType','status','originCountry','originRegion','producer','process','variety','roast','tastingNotes']
DIFF_ORDER = ['productType','originRegion','status','originCountry','producer','process','variety','roast','tastingNotes']

def fld(value, raw, confidence, evidence, evidenceSource, **kw):
    d = {'value': value, 'raw': raw, 'confidence': confidence, 'evidence': evidence, 'evidenceSource': evidenceSource}
    d.update(kw); return d

# ---------- 1. golden 병합 ----------
goldens = {}
for pid in A:
    g = {}
    for f in FIELDS:
        key = (pid, f)
        if key in JMAP:
            g[f] = copy.deepcopy(A[pid]['golden'][f] if JMAP[key]=='A' else B[pid]['golden'][f])
        else:
            g[f] = copy.deepcopy(A[pid]['golden'][f])
    goldens[pid] = g

# ---------- 2. 정규화 ----------
COUNTRY = {'에티오피아':'ethiopia','ethiopia':'ethiopia','콜롬비아':'colombia','colombia':'colombia',
 '파나마':'panama','panama':'panama','케냐':'kenya','kenya':'kenya','과테말라':'guatemala','guatemala':'guatemala',
 '브라질':'brazil','brazil':'brazil','멕시코':'mexico','mexico':'mexico','인도네시아':'indonesia','indonesia':'indonesia',
 '온두라스':'honduras','honduras':'honduras','인도':'india','india':'india'}
PROCESS = {'워시드':'washed','washed':'washed','내추럴':'natural','natural':'natural','허니':'honey','honey':'honey',
 '웻훌':'wet hulled','wet hulled':'wet hulled','코퍼먼티드':'co-fermented','인퓨즈드':'infused','무산소':'anaerobic'}
VARIETY = {'게이샤':'geisha','geisha':'geisha','핑크버번':'pink bourbon','pink bourbon':'pink bourbon',
 '카투아이':'catuai','catuai':'catuai','핑크 버번':'pink bourbon'}

def ntok(s):
    s = re.sub(r'\s+', ' ', str(s).strip())
    s = re.sub(r'(?<=[가-힣]) (?=[가-힣])', '', s)
    return s.lower()

def toks(v):
    if v is None: return None
    return {ntok(p) for p in re.split(r'[,·/|()]+', str(v)) if ntok(p)}

def mapt(m, t):
    return {m.get(x, x) for x in t}

def eqv(field, gv, dv):
    gt, dtk = toks(gv), toks(dv)
    if gt is None and dtk is None: return True
    if gt is None or dtk is None: return False
    if not gt and not dtk: return True
    if not gt or not dtk: return False
    if field == 'originCountry': return mapt(COUNTRY, gt) == mapt(COUNTRY, dtk)
    if field == 'process': return mapt(PROCESS, gt) == mapt(PROCESS, dtk)
    if field == 'variety': return mapt(VARIETY, gt) == mapt(VARIETY, dtk)
    if field == 'producer':
        # §7: 집합 교차 또는 부분 문자열 포함이면 일치
        gs = re.sub(r'\s+', '', str(gv)).lower()
        ds = re.sub(r'\s+', '', str(dv)).lower()
        if gs in ds or ds in gs: return True
        return bool(gt & dtk)
    return gt == dtk

def note_eq(field, gv, dv):
    gt, dtk = toks(gv) or set(), toks(dv) or set()
    if field == 'tastingNotes':
        return mapt({}, gt) == mapt({}, dtk)
    return gt == dtk

# ---------- 3. diff ----------
def diff_product(pid, golden, cur, grade):
    disp = cur['displayed']
    dmap = {'roast': 'roastLevel', 'producer': 'region'}
    d = {}
    is_smart = cur.get('smartstore', False)
    for f in DIFF_ORDER:
        if f in ('productType', 'originRegion'):
            d[f] = {'match': None, 'case': None, 'failureReason': 'NOT_DISPLAYED_FIELD', 'note': '앱 표시 없음 — 비교 제외'}
            continue
        if grade == 'C':
            if f == 'status':
                m = (golden['status']['value'] == disp.get('status'))
                d[f] = {'match': m, 'case': None, 'failureReason': None, 'note': '정확도 통계에서 제외 (collector_flag)'}
            else:
                d[f] = {'match': None, 'case': 3, 'failureReason': 'EVIDENCE_UNAVAILABLE', 'note': 'C등급: 판정 불가 (golden UNKNOWN)'}
            continue
        g = golden[f]
        dv = disp.get(dmap.get(f, f))
        if f == 'status':
            m = (g['value'] == dv)
            d[f] = {'match': m, 'case': None if m else 1, 'failureReason': None if m else 'PARSER_MISS',
                    'note': '정확도 통계에서 제외 (collector_flag)' if m else f"golden={g['value']} vs displayed={dv} — 정확도 통계에서 제외"}
            continue
        if f == 'tastingNotes':
            NOTE_ALIAS = {
                '꽃향기': '플로럴', '믹스베리': '베리', '베리류': '베리',
                '건자두': '말린자두', '카카오': '초콜릿', '코코아': '초콜릿',
                '발렌시아오렌지': '오렌지', '카라멜': '캐러멜',
                '향신료': '스파이스', '볶은땅콩': '땅콩', '레몬제스트': '레몬',
            }
            def nnorm(x): return NOTE_ALIAS.get(ntok(x), ntok(x))
            gn = {nnorm(x) for x in (g['value'] or [])}
            dn = {nnorm(x) for x in (dv or [])}
            if gn == dn:
                d[f] = {'match': True, 'case': None, 'failureReason': None, 'note': '노트 집합 일치 (표기 정규화 후)'}
                continue
            if not gn and dn:
                d[f] = {'match': False, 'case': 1, 'failureReason': 'FALSE_POSITIVE',
                        'note': f"golden 노트 없음인데 표시값: {dv} — 원문에 없는 노트 표시"}
                continue
            if gn and not dn:
                d[f] = {'match': False, 'case': 1, 'failureReason': 'PARSER_MISS',
                        'note': f"golden={g['value']} vs displayed=[] — 원문 노트 {len(gn)}종을 표시가 놓침"}
                continue
            if gn <= dn:
                extra = sorted(dn - gn)
                d[f] = {'match': False, 'case': 1, 'failureReason': 'FALSE_POSITIVE',
                        'note': f"golden={g['value']} vs displayed={dv} — 표시값에 {extra} 추가 (원문 향미 행에 없음)"}
                continue
            if dn <= gn:
                missing = sorted(gn - dn)
                d[f] = {'match': False, 'case': 1, 'failureReason': 'PARSER_MISS',
                        'note': f"golden={g['value']} vs displayed={dv} — 원문 노트 중 {missing} 표시 누락"}
                continue
            missing, extra = sorted(gn - dn), sorted(dn - gn)
            if len(missing) > len(extra):
                fr, why = 'PARSER_MISS', f"누락 위주 ({missing}) + 추가 ({extra})"
            elif len(extra) > len(missing):
                fr, why = 'FALSE_POSITIVE', f"추가 위주 ({extra}) + 누락 ({missing})"
            else:
                fr, why = 'NORMALIZATION_ERROR', f"표기 차이·누락·추가 혼합 (누락 {missing} / 추가 {extra})"
            d[f] = {'match': False, 'case': 1, 'failureReason': fr,
                    'note': f"golden={g['value']} vs displayed={dv} — {why}"}
            continue
        gv = g['value']
        EMPTY_DISP = {'', '확인 필요'}
        both_empty = (gv is None) and (dv is None or dv in EMPTY_DISP)
        if both_empty:
            d[f] = {'match': True, 'case': None, 'failureReason': None, 'note': '둘 다 정보 없음'}
            continue
        if eqv(f, gv, dv):
            # 한/영 표기 차이로 일치한 경우 NORMALIZATION_ERROR가 아니라 match
            d[f] = {'match': True, 'case': None, 'failureReason': None, 'note': '정규화 후 일치'}
            continue
        # mismatch
        if gv is None:
            fr = 'FALSE_POSITIVE'
            note = f"golden {g['confidence']}인데 표시값: {json.dumps(dv, ensure_ascii=False)}"
            if f == 'producer': note = f"golden {g['confidence']}인데 '농장' 행 표시값: {json.dumps(dv, ensure_ascii=False)} (상품명 잔여 텍스트)"
        elif dv is None or dv == '':
            fr = 'PARSER_MISS'
            note = f"golden={json.dumps(gv, ensure_ascii=False)} vs displayed 없음 — 원문 정보를 표시가 놓침"
        elif f == 'roast' and dv == '확인 필요':
            if is_smart:
                fr = 'NOT_IMPLEMENTED'; note = f"golden={gv}이나 스마트스토어 수집이 roastLevel을 '확인 필요'로 고정"
            else:
                fr = 'PARSER_MISS'; note = f"golden={gv} vs displayed '확인 필요' — 공식몰 기본정보표의 볶음도를 수집이 놓침"
        elif f == 'originCountry' and gv and dv:
            fr = 'PARSER_MISS'; note = f"golden={json.dumps(gv, ensure_ascii=False)} vs displayed={json.dumps(dv, ensure_ascii=False)} — 원문 국가 중 일부만/잘못 표시"
        elif f == 'process' and gv and dv:
            fr = 'PARSER_MISS'; note = f"golden={json.dumps(gv, ensure_ascii=False)} vs displayed={json.dumps(dv, ensure_ascii=False)} — 가공 정보 불일치"
        elif f == 'producer' and gv and dv:
            # 한/영 표기 차이(동일인) vs 생산자 누락(상품명 표시) 구분
            # 단어 단위 분할 (ntok의 한글 공백 제거 전 원문 기준)
            gwords = set(re.split(r'[\s/·,()]+', str(gv).lower())) - {''}
            dwords = set(re.split(r'[\s/·,()]+', str(dv).lower())) - {''}
            en_alias = {'잰슨': {'janson'}, '인마쿨라다': {'inmaculada'}, '펠로우': {'fellow'}, '팜스': {'farms', 'farm'}}
            alias_hit = any(en_alias.get(w, set()) & dwords for w in gwords)
            if alias_hit:
                fr = 'NORMALIZATION_ERROR'; note = f"golden={json.dumps(gv, ensure_ascii=False)} vs 농장행={json.dumps(dv, ensure_ascii=False)} — 한/영 표기 차이 (동일인)"
            else:
                fr = 'PARSER_MISS'; note = f"golden={json.dumps(gv, ensure_ascii=False)} vs 농장행={json.dumps(dv, ensure_ascii=False)} — 생산자를 놓치고 상품명 표시"
        elif f == 'variety' and gv and dv:
            gt2, dtk2 = toks(gv) or set(), toks(dv) or set()
            if dtk2 and dtk2 <= gt2:
                fr = 'PARSER_MISS'; note = f"golden={json.dumps(gv, ensure_ascii=False)} 중 {sorted(gt2 - dtk2)} 표시 누락"
            else:
                fr = 'NORMALIZATION_ERROR'; note = f"golden={json.dumps(gv, ensure_ascii=False)} vs displayed={json.dumps(dv, ensure_ascii=False)} — 표기 차이"
        else:
            fr = 'PARSER_MISS'; note = f"golden={json.dumps(gv, ensure_ascii=False)} vs displayed={json.dumps(dv, ensure_ascii=False)}"
        d[f] = {'match': False, 'case': 1, 'failureReason': fr, 'note': note}
    return d

# ---------- 4. products 조립 ----------
products = []
for pid in IDS:
    cur = CV[pid]
    grade = cur.get('evidenceGrade')
    if grade == 'C':
        golden = {}
        for f in FIELDS:
            if f == 'tastingNotes':
                golden[f] = fld([], [], 'UNKNOWN', '제공된 증거 없음 (스냅샷만 존재)', 'manifest: hasEvidenceBeyondSnapshot=false')
            elif f == 'status':
                v = 'soldout' if cur.get('isSoldOut') else 'active'
                golden[f] = fld(v, v, 'MEDIUM', f"isSoldOut={cur.get('isSoldOut')} (수집 플래그)", 'collector_flag')
            else:
                golden[f] = fld(None, None, 'UNKNOWN', '제공된 증거 없음 (스냅샷만 존재)', 'manifest: hasEvidenceBeyondSnapshot=false')
        diff = diff_product(pid, golden, cur, 'C')
        review = {'note': 'C-grade mechanical: no evidence, skipped independent review'}
    else:
        golden = goldens[pid]
        diff = diff_product(pid, golden, cur, grade)
        jf = {f'{i}#{fld_}': v for (i, fld_), v in JMAP.items() if i == pid}
        review = {
            'reviewerA': {'golden': copy.deepcopy(A[pid]['golden'])},
            'reviewerB': {'golden': copy.deepcopy(B[pid]['golden'])},
            'judge': {'fields': jf, 'note': 'see audit/golden/_work/batch-012-judge-record.json' if jf else 'A/B 일치 — Judge 불필요'},
            'qualityAudit': {'reversals': [], 'note': ''},
            'domainReview': {'corrections': [], 'note': ''},
        }
    products.append({
        'id': pid,
        'roastery': cur.get('roasterName'),
        'productName': cur.get('productName'),
        'productUrl': cur.get('productUrl'),
        'evidenceGrade': grade,
        'golden': golden,
        'current': {'raw': cur.get('raw'), 'displayed': cur.get('displayed')},
        'diff': diff,
        'review': review,
    })

json.dump(products, open(ROOT + '/audit/golden/_work/batch-012-products.json','w'), ensure_ascii=False, indent=1)
print('products:', len(products))

# mismatch 미리보기 (status 제외)
from collections import Counter
cnt = Counter()
for p in products:
    for f, dd in p['diff'].items():
        if f == 'status': continue
        if dd.get('match') is False:
            cnt[(f, dd.get('failureReason'))] += 1
print('mismatches excl status:', sum(cnt.values()))
for k in sorted(cnt): print(' ', k, cnt[k])
for p in products:
    bad = [(f, dd.get('failureReason')) for f, dd in p['diff'].items() if dd.get('match') is False]
    if bad: print(p['id'][:40], bad)
