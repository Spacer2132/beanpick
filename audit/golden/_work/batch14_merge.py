#!/usr/bin/env python3
"""batch-014 최종 병합: golden + current + diff + review -> audit/golden/batch-014.json"""
import json, re, glob
from collections import Counter

BASE = '/home/hatch/workspace/beanpick'
W = BASE + '/audit/golden/_work'

def norm(s):
    return re.sub(r'\s+', '', str(s)).lower()

def normset(v):
    if v is None: return None
    if isinstance(v, list): return sorted(norm(x) for x in v)
    return norm(v)

batches = json.load(open(BASE + '/audit/golden/batches.json'))
ids = batches['batches'][13]['ids']
cur = json.load(open(BASE + '/audit/golden/current-values.json'))['current']
A = json.load(open(W + '/batch-014-reviewerA.json'))
B = json.load(open(W + '/batch-014-reviewerB.json'))
judge_rec = json.load(open(W + '/batch-014-judge-record.json'))['judge']
C_IDS = ['aerycoffee-13180710105', 'aerycoffee-12350323875', 'aerycoffee-13647146780']
FIELDS = ['productType', 'status', 'originCountry', 'originRegion', 'producer', 'process', 'variety', 'roast', 'tastingNotes']

# snapshotRecord에서 roastery/productUrl/productName 추출
meta = {}
for pat in glob.glob(BASE + '/audit-input/products/*.json'):
    d = json.load(open(pat))
    sr = d.get('snapshotRecord', {})
    pid = sr.get('id') or d.get('id')
    if pid in ids and pid not in meta:
        meta[pid] = {'roastery': sr.get('roastery', ''), 'productUrl': sr.get('productUrl', ''),
                     'productName': sr.get('productName', '')}

judge_by_id = {}
for j in judge_rec:
    judge_by_id.setdefault(j['id'], {})[j['field']] = j

# ---- C등급 기계 golden ----
def c_golden(pid):
    iso = cur[pid].get('isSoldOut', False)
    g = {}
    for f in FIELDS:
        if f == 'status':
            g[f] = {'value': 'soldout' if iso else 'active', 'raw': 'soldout' if iso else 'active',
                    'confidence': 'MEDIUM', 'evidence': 'isSoldOut=%s (수집 플래그)' % iso,
                    'evidenceSource': 'collector_flag'}
        elif f == 'tastingNotes':
            g[f] = {'value': [], 'raw': [], 'confidence': 'UNKNOWN',
                    'evidence': '제공된 증거 없음 (스냅샷만 존재)',
                    'evidenceSource': 'manifest: hasEvidenceBeyondSnapshot=false'}
        else:
            g[f] = {'value': None, 'raw': None, 'confidence': 'UNKNOWN',
                    'evidence': '제공된 증거 없음 (스냅샷만 존재)',
                    'evidenceSource': 'manifest: hasEvidenceBeyondSnapshot=false'}
    return g

def golden_of(pid):
    if pid in C_IDS:
        return c_golden(pid)
    g = {f: dict(A[pid]['golden'][f]) for f in FIELDS}
    if pid in judge_by_id:
        for f, j in judge_by_id[pid].items():
            g[f] = {'value': j['value'], 'raw': j['raw'], 'confidence': j['confidence'],
                    'evidence': j['evidence'], 'evidenceSource': j['evidenceSource']}
            if 'evidenceKind' in j:
                g[f]['evidenceKind'] = j['evidenceKind']
    return g

# ---- diff ----
def d_not_displayed():
    return {'match': None, 'case': None, 'failureReason': 'NOT_DISPLAYED_FIELD', 'note': '앱 표시 없음 — 비교 제외'}

def diff_status(gv, raw_status):
    if gv == raw_status:
        return {'match': True, 'case': None, 'failureReason': None, 'note': '정확도 통계에서 제외 (collector_flag)'}
    return {'match': False, 'case': 1, 'failureReason': 'PARSER_MISS',
            'note': 'golden=%s vs displayed=%s — 정확도 통계에서 제외' % (gv, raw_status)}

def diff_scalar(pid, f, gv, dv, both_empty_note='둘 다 정보 없음'):
    """원문-표시 스칼라 비교. dv_empty_values: 표시 '없음' 취급 값"""
    g, d = normset(gv), normset(dv)
    if g is None and (d is None or d == '' or d == '확인 필요'):
        return {'match': True, 'case': None, 'failureReason': None, 'note': both_empty_note}
    if g is not None and d == g:
        return {'match': True, 'case': None, 'failureReason': None, 'note': '정규화 후 일치'}
    return None  # 호출자가 분류

def diff_product(pid, golden, c):
    raw, dp = c['raw'], c['displayed']
    out = {}
    out['productType'] = d_not_displayed()
    out['originRegion'] = d_not_displayed()
    out['status'] = diff_status(golden['status']['value'], raw.get('status'))
    if pid in C_IDS:
        for f in ['originCountry', 'producer', 'process', 'variety', 'roast', 'tastingNotes']:
            out[f] = {'match': None, 'case': 3, 'failureReason': 'EVIDENCE_UNAVAILABLE',
                      'note': 'C등급: 판정 불가 (golden UNKNOWN)'}
        return out
    # 수동 분류 (원문 근거 기반)
    out['originCountry'] = manual(pid, 'originCountry', golden['originCountry']['value'], dp.get('originCountry'))
    out['producer'] = manual(pid, 'producer', golden['producer']['value'], dp.get('region'))
    out['process'] = manual(pid, 'process', golden['process']['value'], dp.get('process'))
    out['variety'] = manual(pid, 'variety', golden['variety']['value'], dp.get('variety'))
    out['roast'] = manual(pid, 'roast', golden['roast']['value'], dp.get('roast'))
    out['tastingNotes'] = manual(pid, 'tastingNotes', golden['tastingNotes']['value'], dp.get('tastingNotes'))
    return out

MANUAL = {
 # id: {field: (failureReason, case, note)}
 'cafedoan-13094366167': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': ('FALSE_POSITIVE', 1, 'golden SOURCE_MISSING인데 \'농장\' 행 표시값: "NOMAD 노마드 Hambela" (상품명 잔여 텍스트)'),
   'process': (None, None, '정규화 후 일치'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': ('NORMALIZATION_ERROR', 1, 'golden=[\'카카오닙스\', \'체리\', \'블루베리\'] vs displayed=[\'초콜릿\'] — 3종 누락 + \'초콜릿\' 추가 (카카오닙스 오독)')},
 '호커스포커스로스터스-킹스크로스홈카페원두': {
   'originCountry': (None, None, '둘 다 정보 없음'),
   'producer': (None, None, '둘 다 정보 없음'),
   'process': (None, None, '둘 다 정보 없음'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': (None, None, '둘 다 정보 없음')},
 'lubia-11575853258': {
   'originCountry': (None, None, '둘 다 정보 없음'),
   'producer': (None, None, '둘 다 정보 없음'),
   'process': ('FALSE_POSITIVE', 1, 'golden SOURCE_MISSING인데 표시값 "블렌드" (가공 정보 아님)'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': ('NOT_IMPLEMENTED', 1, 'golden=Dark이나 스마트스토어 수집이 roastLevel을 \'확인 필요\'로 고정'),
   'tastingNotes': ('NORMALIZATION_ERROR', 1, 'golden 5종 vs displayed 4종 — \'초콜릿\' 누락 + 구운아몬드→아몬드 표기 차이')},
 'fillout-13684407826': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': (None, None, '정규화 후 일치'),
   'process': (None, None, '정규화 후 일치'),
   'variety': (None, None, '정규화 후 일치'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': (None, None, '둘 다 정보 없음')},
 'namusairo-1114': {
   'originCountry': ('PARSER_MISS', 1, 'golden="에티오피아 · 케냐" vs displayed="케냐" — 에티오피아 누락'),
   'producer': ('FALSE_POSITIVE', 1, 'golden SOURCE_MISSING(원문엔 가공소만)인데 \'농장\' 행 표시값: "그리니" (상품명)'),
   'process': ('PARSER_MISS', 1, 'golden="워시드 · 캐스크 숙성" vs displayed="워시드" — 캐스크 숙성 누락'),
   'variety': ('PARSER_MISS', 1, 'golden 7품종 vs displayed="SL28 / SL34" — 5품종 누락'),
   'roast': ('NOT_IMPLEMENTED', 1, 'golden=Medium이나 스마트스토어 수집이 roastLevel을 \'확인 필요\'로 고정'),
   'tastingNotes': ('PARSER_MISS', 1, 'golden 5종 vs displayed 3종 — \'가죽\', \'오키\' 누락')},
 'cafedoan-7633322126': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': ('NORMALIZATION_ERROR', 1, 'golden="레티 베르무데스" vs 농장행="MANHATTAN 맨해튼 Letty Bermudez" — 한/영 표기 차이 (동일인)'),
   'process': (None, None, '둘 다 정보 없음'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': (None, 3, 'EVIDENCE_UNAVAILABLE: 동일 이미지 OCR 정면 충돌 — golden UNKNOWN')},
 'hocuspocus-13691080691': {
   'originCountry': (None, None, '둘 다 정보 없음'),
   'producer': (None, None, '둘 다 정보 없음'),
   'process': (None, None, '둘 다 정보 없음'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': (None, None, '둘 다 정보 없음')},
 '루비아커피-에티오피아예가체프코케허니g1내추럴라이트로스트': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': ('FALSE_POSITIVE', 1, 'golden SOURCE_MISSING(코케=스테이션)인데 \'농장\' 행 표시값: "예가체프 코케 허니 G1" (상품명 잔여 텍스트)'),
   'process': ('PARSER_MISS', 1, 'golden="내추럴 · 허니" vs displayed="내추럴" — 허니 누락'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': ('NOT_IMPLEMENTED', 1, 'golden=Light이나 스마트스토어 수집이 roastLevel을 \'확인 필요\'로 고정'),
   'tastingNotes': ('PARSER_MISS', 1, 'golden 4종 vs displayed 3종 — \'꽃향기\' 누락')},
 'fillout-13761048456': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': ('FALSE_POSITIVE', 1, 'golden SOURCE_MISSING인데 \'농장\' 행 표시값: "문가리아 헤비" (상품명 잔여 텍스트)'),
   'process': (None, None, '정규화 후 일치'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': (None, None, '둘 다 정보 없음')},
 'namusairo-1123': {
   'originCountry': (None, None, '둘 다 정보 없음'),
   'producer': (None, None, '둘 다 정보 없음'),
   'process': (None, None, '둘 다 정보 없음'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': ('PARSER_MISS', 1, 'golden 13종 vs displayed 2종 — 11종 누락')},
 'cafedoan-13095256178': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': ('NORMALIZATION_ERROR', 1, 'golden="핀카 라스 플로레스" vs 농장행="NOMAD 노마드 Las Flores" — 한/영 표기 차이 (동일 농장 추정)'),
   'process': (None, None, '정규화 후 일치'),
   'variety': (None, None, '정규화 후 일치'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': ('NORMALIZATION_ERROR', 1, 'golden 7종 vs displayed 3종 — 4종 누락 + \'초콜릿\' 추가 (카카오닙스/카카오파우더 오독)')},
 'hocuspocus-13707039145': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': ('FALSE_POSITIVE', 1, 'golden SOURCE_MISSING(캄완기=스테이션)인데 \'농장\' 행 표시값: "키린야가 캄완기 AA TOP" (상품명 잔여 텍스트)'),
   'process': (None, None, '정규화 후 일치'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': (None, None, '둘 다 정보 없음')},
 '루비아커피-에티오피아예가체프코케g2워시드미디엄로스트': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': ('FALSE_POSITIVE', 1, 'golden SOURCE_MISSING(코케=스테이션)인데 \'농장\' 행 표시값: "예가체프 코케 G2" (상품명 잔여 텍스트)'),
   'process': (None, None, '정규화 후 일치'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': ('NOT_IMPLEMENTED', 1, 'golden=Medium이나 스마트스토어 수집이 roastLevel을 \'확인 필요\'로 고정'),
   'tastingNotes': ('NORMALIZATION_ERROR', 1, 'golden=[꽃향기, 복숭아, 갈색설탕] vs displayed=[복숭아, 브라운슈가] — 꽃향기 누락 + 갈색설탕↔브라운슈가 표기 차이')},
 'fillout-13622422334': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': ('FALSE_POSITIVE', 1, 'golden SOURCE_MISSING인데 \'농장\' 행 표시값: "베이트 알알" (상품명 잔여 텍스트)'),
   'process': (None, None, '정규화 후 일치'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': ('NORMALIZATION_ERROR', 1, 'golden=[포도쥬스, 카카오, 레드와인] vs displayed=[포도, 초콜릿] — 레드와인 누락 + 포도↔포도쥬스·초콜릿↔카카오 표기 차이')},
 'namusairo-41': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': (None, None, '정규화 후 일치'),
   'process': (None, None, '정규화 후 일치'),
   'variety': ('PARSER_MISS', 1, 'golden 5품종 vs displayed="카투라 / 카투아이" — 3품종 누락'),
   'roast': ('FALSE_POSITIVE', 1, 'golden SOURCE_MISSING(원문 \'Well-done\' 미매핑)인데 표시값 "Dark" (수집기 enum 강제)'),
   'tastingNotes': ('NORMALIZATION_ERROR', 1, 'golden=[산미, 카카오, 다크초콜릿] vs displayed=[다크초콜릿, 신선] — 산미·카카오 누락 + \'신선\' 추가 (질감 서술 오분류)')},
 'cafedoan-11754367412': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': ('PARSER_MISS', 1, 'golden="카페 그란하 라 에스페란사" vs 농장행="MANHATTAN 맨해튼 Sweet Valley" — 원문 생산자 표시 누락'),
   'process': (None, None, '정규화 후 일치'),
   'variety': ('PARSER_MISS', 1, 'golden="콜롬비아"(Colombia varietal) vs displayed="" — 품종 표시 누락'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': ('NORMALIZATION_ERROR', 1, 'golden=[캔디애플, 자두, 히비스커스] vs displayed=[사과, 자두, 히비스커스, 쥬시] — 캔디애플↔사과 표기 차이 + \'쥬시\' 추가 (질감어)')},
 'hocuspocus-13713119523': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': (None, None, '정규화 후 일치'),
   'process': (None, None, '정규화 후 일치'),
   'variety': (None, None, '정규화 후 일치'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': (None, None, '둘 다 정보 없음')},
 '루비아커피-코스타리카shbep따라주워시드미디엄로스트': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': ('FALSE_POSITIVE', 1, 'golden SOURCE_MISSING인데 \'농장\' 행 표시값: "SHB EP 따라주" (상품명 잔여 텍스트)'),
   'process': (None, None, '정규화 후 일치'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': ('NOT_IMPLEMENTED', 1, 'golden=Medium이나 스마트스토어 수집이 roastLevel을 \'확인 필요\'로 고정'),
   'tastingNotes': ('PARSER_MISS', 1, 'golden 3종 vs displayed 2종 — \'볶은콩\' 누락')},
 'fillout-5265856262': {
   'originCountry': (None, None, '둘 다 정보 없음'),
   'producer': (None, None, '둘 다 정보 없음'),
   'process': ('FALSE_POSITIVE', 1, 'golden SOURCE_MISSING인데 표시값 "블렌드" (가공 정보 아님)'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': ('NOT_IMPLEMENTED', 1, 'golden=Medium-Dark이나 스마트스토어 수집이 roastLevel을 \'확인 필요\'로 고정'),
   'tastingNotes': ('NORMALIZATION_ERROR', 1, 'golden=[넛티, 카라멜, 다크초콜릿] vs displayed=[다크초콜릿, 캐러멜, 견과류] — 넛티↔견과류·카라멜↔캐러멜 표기 차이')},
 'namusairo-1126': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': ('PARSER_MISS', 1, 'golden="705여 소농" vs 농장행="실속형.게뎁 무산소" (상품명 잔여 텍스트) — 원문 생산자 표시 누락'),
   'process': (None, None, '정규화 후 일치'),
   'variety': ('PARSER_MISS', 1, 'golden 4품종 vs displayed="" — 품종 표시 누락'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': ('NORMALIZATION_ERROR', 1, 'golden=[패션프룻, 살구잼, 딸기, 루바브] vs displayed=[딸기, 청량감, 패션프루트, 살구] — 루바브 누락 + \'청량감\' 추가 (원문 없는 AI 컵노트) + 패션프룻↔패션프루트·살구잼↔살구 표기 차이')},
 'aerycoffee-11495956352': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': ('NORMALIZATION_ERROR', 1, 'golden="하시엔다 코페이" vs 농장행="하시엔다 코페이 이타다키" — 라인명 추가 표기 차이 (동일 농장)'),
   'process': (None, None, '정규화 후 일치'),
   'variety': (None, None, '정규화 후 일치'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': (None, None, '정규화 후 일치')},
 'cafedoan-13635190651': {
   'originCountry': (None, None, '정규화 후 일치'),
   'producer': (None, None, '정규화 후 일치'),
   'process': (None, None, '정규화 후 일치'),
   'variety': (None, None, '둘 다 정보 없음'),
   'roast': (None, None, '둘 다 정보 없음'),
   'tastingNotes': ('NORMALIZATION_ERROR', 1, 'golden=[애플파이, 아몬드, 브라운슈가] vs displayed=[사과, 아몬드, 브라운슈가] — 애플파이↔사과 표기 차이 (Apple pie 오독)')},
}

def manual(pid, f, gv, dv):
    fr, case, note = MANUAL[pid][f]
    if fr is None and case is None:
        return {'match': True, 'case': None, 'failureReason': None, 'note': note}
    if fr is None and case == 3:
        return {'match': None, 'case': 3, 'failureReason': 'EVIDENCE_UNAVAILABLE', 'note': note}
    return {'match': False, 'case': case, 'failureReason': fr, 'note': note}

# ---- products 조립 ----
products = []
for pid in ids:
    golden = golden_of(pid)
    c = cur[pid]
    m = meta.get(pid, {})
    if pid in C_IDS:
        review = {'note': 'C-grade mechanical: no evidence, skipped independent review'}
    else:
        jf = judge_by_id.get(pid, {})
        if jf:
            judge = {'fields': {f: {'verdict': j['verdict'], 'value': j['value'],
                                    'confidence': j['confidence'], 'note': j['note']} for f, j in jf.items()},
                     'note': 'A/B 불일치 1건 해소 — 상세: audit/golden/_work/batch-014-judge-record.json'}
        else:
            judge = {'fields': {}, 'note': 'A/B 일치 — Judge 불필요'}
        review = {
            'reviewerA': {'golden': A[pid]['golden']},
            'reviewerB': {'golden': B[pid]['golden']},
            'judge': judge,
            'qualityAudit': {'reversals': [
                'cafedoan-13095256178 tastingNotes에 evidenceKind current_echo 추가 (OCR 보완분 포함)',
                'fillout-5265856262 roast에 evidenceKind current_echo 추가 (OCR 단독 근거)'],
                'note': '자동 검사 3종 시뮬레이션 (질감어·process 오염·evidenceKind) — 3건 수정. 상세: audit/golden/_work/batch-014-qa.json'},
            'domainReview': {'corrections': [],
                'note': '품종·지역·가공 14항목 검증 — 수정 없음. 상세: audit/golden/_work/batch-014-domain.json'},
        }
    products.append({
        'id': pid,
        'roastery': m.get('roastery', ''),
        'productName': m.get('productName', ''),
        'productUrl': m.get('productUrl', ''),
        'evidenceGrade': c.get('evidenceGrade', ''),
        'golden': golden,
        'current': {'raw': c['raw'], 'displayed': c['displayed']},
        'diff': diff_product(pid, golden, c),
        'review': review,
    })

# ---- summary ----
dis_by_id = {}
for j in judge_rec:
    dis_by_id[j['id']] = True
disagreements = len(judge_rec)
disagreementsExclStatus = disagreements  # status 불일치 없음

unknown = sum(1 for p in products for f in FIELDS if p['golden'][f]['confidence'] == 'UNKNOWN')
unknownExclC = sum(1 for p in products if p['id'] not in C_IDS for f in FIELDS if p['golden'][f]['confidence'] == 'UNKNOWN')
sm = sum(1 for p in products for f in FIELDS if p['golden'][f]['confidence'] == 'SOURCE_MISSING')

mismatch = 0
frd = Counter()
for p in products:
    for f in FIELDS:
        if f == 'status':
            continue
        df = p['diff'][f]
        if df['match'] is False:
            mismatch += 1
            frd[df['failureReason']] += 1

total_fields = 25 * 9
summary = {
    'total': 25,
    'cMechanical': 3,
    'reviewed': 22,
    'disagreements': disagreements,
    'disagreementsExclStatus': disagreementsExclStatus,
    'disagreementRateExclStatus': round(disagreementsExclStatus / (22 * 9), 4),
    'unknownFieldCount': unknown,
    'unknownFieldRate': round(unknown / total_fields, 4),
    'unknownFieldCountExclC': unknownExclC,
    'sourceMissingFieldCount': sm,
    'sourceMissingFieldRate': round(sm / total_fields, 4),
    'mismatchCountExclStatus': mismatch,
    'failureReasonDistributionExclStatus': dict(frd),
    'statusExcludedFromAccuracy': True,
    'qaReversals': 3,
    'domainCorrections': 0,
    'topMisjudgments': [
        {'field': 'tastingNotes', 'pattern': '원문 노트 표시 누락·표기 차이·AI 생성 노트 추가 혼합', 'count': 15,
         'example': 'namusairo-1126'},
        {'field': 'producer', 'pattern': "농장 행에 상품명 잔여 텍스트 표시 8건 + 한/영 표기 차이 3건 + 원문 생산자 누락 2건", 'count': 13,
         'example': 'namusairo-1114'},
        {'field': 'roast', 'pattern': "스마트스토어 수집이 roastLevel을 '확인 필요'로 고정 6건 + 'Well-done' enum 강제 1건", 'count': 7,
         'example': 'lubia-11575853258'},
    ],
    'revisionNotes': 'rev2 적용: SOURCE_MISSING 강화(워싱스테이션·Well-done 라벨·G1/AA/SHB EP 등급·허니/내추럴 병기), OCR 단독 근거 MEDIUM에 evidenceKind current_echo, 질감어 value 제외·raw 보존, 원문 우선(status soldout 4건·namusairo 본문 SOLD OUT), 동일 이미지 OCR 부분 충돌 시 교차확인분 유지(Judge: 코케g2).',
}

out = {
    'batch': 14,
    'ids': ids,
    'snapshot': {'sha256': 'ac7739a73376f125a8a200796391a128b206a4da50582fbfa8e350723e6d0b81',
                 'count': 454,
                 'repoHead': '88fad74faad43b8a1e8abf6ef7676c62ed0a9f09'},
    'summary': summary,
    'products': products,
}
json.dump(out, open(BASE + '/audit/golden/batch-014.json', 'w'), ensure_ascii=False, indent=1)
print('written. products:', len(products))
print('unknown:', unknown, 'unknownExclC:', unknownExclC, 'sourceMissing:', sm)
print('mismatchExclStatus:', mismatch, dict(frd))
print('disagreementRate:', summary['disagreementRateExclStatus'])
