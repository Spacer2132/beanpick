#!/usr/bin/env python3
"""Phase 1 스키마 개정 #1 (2026-09-25): batch-001~005 변환.
- NOT_DISPLAYED: originRegion/type diff 재분류, producer diff를 farm('농장' 행)과 비교로 재계산
- UNKNOWN 분리: SOURCE_MISSING 추가
- status: collector_flag/MEDIUM (원문 반대 증거 5건은 원문 우선)
- OCR_CONFLICT: 칠린블렌드
- roast: 5단계 enum + raw 보존
- raw + normalized 병기
production 코드 미수정. 입력/출력 모두 audit/ 아래.
"""
import json, re, collections, copy

GOLDEN_DIR = '/home/hatch/workspace/beanpick/audit/golden'
cv = json.load(open(f'{GOLDEN_DIR}/current-values.json'))['current']

COUNTRY_MAP = {'Colombia': '콜롬비아', 'Ethiopia': '에티오피아', 'Panama': '파나마'}

def norm_process(v):
    if not isinstance(v, str): return v, v
    raw = v
    table = [
        ('Washed Experimental (워시드 익스페리멘탈)', '워시드 익스페리멘탈'),
        ('Washed (Dry Fermentation) 워시드 드라이 퍼먼테이션', '워시드 드라이 퍼먼테이션'),
        ('Natural·Anaerobic Natural (내추럴·무산소 내추럴)', '내추럴·무산소 내추럴'),
        ('White Honey (화이트 허니)', '화이트 허니'),
        ('Black Honey (블랙허니)', '블랙허니'),
        ('E.A (ethyl acetate)', 'E.A'),
        ('Anaerobic Natural', '무산소 내추럴'),
        ('Washed', '워시드'), ('Natural', '내추럴'), ('Honey', '허니'),
    ]
    for en, ko in table:
        if v == en: return ko, raw
    return v, raw

VARIETY_MAP = {'Pink Bourbon': '핑크 버번'}

ROAST_LABELS = {  # raw label -> enum
    '라이트 로스트': 'Light', '라이트': 'Light', 'Light': 'Light',
    '미디엄 로스트': 'Medium', '미디엄': 'Medium', 'Medium': 'Medium', '중배전': 'Medium',
    '미디움 다크 로스트': 'Medium-Dark', '중강배전': 'Medium-Dark',
    '다크 로스트': 'Dark', '다크': 'Dark', 'Dark': 'Dark', '강배전': 'Dark',
    '중약배전': 'Medium-Light', 'Light Medium': 'Medium-Light',
}
# 긴 라벨 우선 매칭용
ROAST_LABELS_SORTED = sorted(ROAST_LABELS.keys(), key=len, reverse=True)

NOTE_MAP = {
    'Jasmine': '자스민', 'Peach': '복숭아', 'Caramel': '캐러멜', '카라멜': '캐러멜',
    'Brown Sugar': '브라운슈가', 'Almond': '아몬드', 'Honey': '꿀',
    'Milk Chocolate': '밀크초콜릿', '밀크 초콜릿': '밀크초콜릿',
    'Dark Chocolate': '다크초콜릿', 'DARK CHOCOLATE': '다크초콜릿', '다크 초콜릿': '다크초콜릿',
    'Earl Grey': '얼그레이', 'BLUEBERRY': '블루베리', 'Apricot': '살구',
    'Chocolate': '초콜릿', 'Orange': '오렌지', 'Black Tea': '블랙티',
    'Nuts': '견과류', 'Raspberry': '라즈베리', 'Grape': '포도',
    'RED APPLE': '사과', 'PLUM': '자두', 'MACADAMIA': '마카다미아',
    'Nectarine': '천도복숭아', 'Lemon': '레몬', 'Lychee': '리치', 'Herbs': '허브',
    '꽃 향': '꽃향기', '블랙 슈가': '블랙슈가',
}

def norm_note(t):
    if t in NOTE_MAP:
        return NOTE_MAP[t]
    t2 = t.strip()
    if re.search(r'[가-힣]', t2):
        t2 = re.sub(r'\s+', '', t2)
        if t2 in NOTE_MAP:
            return NOTE_MAP[t2]
        return t2
    return re.sub(r'\s+', ' ', t2)

def classify_null(grade, evidence, source):
    if grade == 'C':
        return 'UNKNOWN'
    ev = (evidence or '').strip()
    src = (source or '').strip()
    if any(k in ev for k in ['판단 불가', '단정할 수 없음', '근거 부족', '제공된 증거 없음',
                             '스냅샷만', '충돌', '해결 불가', '확정 불가']):
        return 'UNKNOWN'
    if ev in ('원문 증거 없음', '원문 명시 없음') and not src:
        return 'UNKNOWN'
    if any(k in ev for k in ['미명시', '미표기', '정보 없음', '명시 없음', '해당 정보 없음', '가공이 아님']):
        return 'SOURCE_MISSING'
    if src:
        return 'SOURCE_MISSING'
    return 'UNKNOWN'

def normset(s):
    s = s.strip()
    parts = re.split(r'[()/·|,、]', s)
    out = set()
    for p in parts:
        p = p.strip().lower()
        if p:
            out.add(p)
            out.add(re.sub(r'\s+', '', p))
    out.add(re.sub(r'\s+', '', s.lower()))
    return {x for x in out if x}

STOPWORDS = {'coffee', 'farm', 'finca', 'estate', 'cooperative', 'co-op', '커피', '농장', '조합'}

def words5(s):
    return {w for w in re.split(r'\s+', s.lower()) if len(w) >= 5 and w not in STOPWORDS}

def producer_match(g, f):
    gs, fs = normset(g), normset(f)
    if gs & fs:
        return True
    for a in gs:
        for b in fs:
            if a and b and (a in b or b in a):
                return True
    # 단어 수준: golden의 핵심 단어가 farm 잔여 텍스트에 그대로 보이면 일치
    if words5(g) & words5(f):
        return True
    return False

def extract_roast_label(evidence, value):
    text = f"{evidence or ''} {value or ''}"
    found = []
    for lab in ROAST_LABELS:
        if re.search(r'[A-Za-z]', lab):
            # 영문 라벨은 단어 경계 매칭 (Medium-Dark 안의 Medium 오매칭 방지)
            pat = r'(?<![A-Za-z-])' + re.escape(lab) + r'(?![A-Za-z-])'
        else:
            pat = re.escape(lab)
        if re.search(pat, text):
            found.append(lab)
    if not found:
        return None
    ko = [l for l in found if re.search(r'[가-힣]', l)]
    pool = ko if ko else found
    return max(pool, key=len)

stats = collections.Counter()
roast_fixes = []
status_exceptions = []

for bi in range(1, 6):
    fn = f'{GOLDEN_DIR}/batch-00{bi}.json'
    d = json.load(open(fn))
    for p in d['products']:
        pid = p['id']
        grade = p.get('evidenceGrade')
        g = p['golden']
        cur = p['current']
        flag = cv[pid]['raw']['status']  # 'soldout' | 'active'
        farm = (cv[pid]['displayed'].get('region') or '').strip()

        # ---- current 블록: NOT_DISPLAYED 표시 ----
        if isinstance(cur.get('displayed'), dict):
            cur['displayed']['originRegion'] = 'NOT_DISPLAYED'
            cur['displayed']['type'] = 'NOT_DISPLAYED'
        else:
            # flat: b2/b3는 {raw,displayed} 객체, b5는 스칼라/null
            if isinstance(cur.get('originRegion'), dict) or 'originRegion' in cur:
                cur['originRegion'] = {'raw': None, 'displayed': 'NOT_DISPLAYED'}
            else:
                cur['originRegion'] = 'NOT_DISPLAYED'
            pt = cur.get('productType')
            if isinstance(pt, dict):
                cur['productType'] = {'raw': pt.get('raw'), 'displayed': 'NOT_DISPLAYED'}
            else:
                cur['productType'] = 'NOT_DISPLAYED'

        # ---- golden 필드 변환 ----
        for fld, gf in g.items():
            if not isinstance(gf, dict):
                continue
            val = gf.get('value')
            conf = gf.get('confidence')
            ev = gf.get('evidence', '')
            src = gf.get('evidenceSource', '')

            if fld == 'status':
                # 작업 3: collector_flag 정책
                if val == 'soldout' and '불일치하나 원문 우선' in ev:
                    gf['value'] = 'soldout'
                    gf['raw'] = 'SOLD OUT'
                    gf['confidence'] = 'HIGH'
                    # evidenceSource는 원문 유지, note 추가
                    gf['evidence'] = ev + ' [원문 우선: 수집 플래그 isSoldOut=false와 충돌]'
                    status_exceptions.append(pid)
                    stats['status_exception'] += 1
                else:
                    gf['value'] = flag
                    gf['raw'] = flag
                    gf['confidence'] = 'MEDIUM'
                    gf['evidence'] = f"isSoldOut={flag == 'soldout'} (수집 플래그)"
                    gf['evidenceSource'] = 'collector_flag'
                stats['status_rewritten'] += 1
                continue

            if fld == 'roast':
                lab = extract_roast_label(ev, val if isinstance(val, str) else None)
                if lab:
                    newv = ROAST_LABELS[lab]
                    changed = (val != newv) or (conf != 'HIGH')
                    if changed:
                        roast_fixes.append((pid, val, newv, lab, conf))
                        gf['evidence'] = (ev + ' [사용자 결정 2026-09-25: roast 5단계 enum, '
                                          f'{lab}={newv}, HIGH]').strip()
                    gf['value'] = newv
                    gf['raw'] = lab
                    gf['confidence'] = 'HIGH'
                    stats['roast_fixed'] += 1
                elif val is None:
                    gf['raw'] = None
                    newconf = classify_null(grade, ev, src)
                    if newconf != conf:
                        stats[f'roast_null_{conf}_to_{newconf}'] += 1
                    gf['confidence'] = newconf
                    stats['roast_null'] += 1
                else:
                    # 알 수 없는 라벨 — 그대로 두고 raw=value, 로그
                    gf['raw'] = val
                    stats['roast_unmapped'] += 1
                    print(f'WARN roast unmapped: b{bi} {pid} val={val} ev={ev[:80]}')
                continue

            if val is None or (isinstance(val, list) and len(val) == 0 and fld == 'tastingNotes' and conf == 'UNKNOWN'):
                # null 필드: UNKNOWN vs SOURCE_MISSING
                if fld == 'tastingNotes' and isinstance(val, list):
                    gf['raw'] = []
                else:
                    gf['raw'] = None
                newconf = classify_null(grade, ev, src)
                if newconf != conf:
                    stats[f'null_{conf}_to_{newconf}'] += 1
                gf['confidence'] = newconf
                continue

            # 값이 있는 필드: raw 보존 + 정규화
            if fld == 'originCountry' and isinstance(val, str):
                gf['raw'] = val
                gf['value'] = COUNTRY_MAP.get(val, val)
            elif fld == 'process' and isinstance(val, str):
                newv, raw = norm_process(val)
                gf['value'] = newv
                gf['raw'] = raw
            elif fld == 'variety' and isinstance(val, str):
                gf['raw'] = val
                gf['value'] = VARIETY_MAP.get(val, val)
            elif fld == 'tastingNotes' and isinstance(val, list):
                gf['raw'] = list(val)
                gf['value'] = [norm_note(t) for t in val]
            else:
                gf['raw'] = val

        # ---- 칠린블렌드 OCR_CONFLICT ----
        if '칠린블렌드' in pid:
            g['tastingNotes'] = {
                'value': None, 'raw': None, 'confidence': 'UNKNOWN',
                'evidence': '동일 이미지(사이즈만 다름)에 대한 gemini OCR 2건 정면 충돌 — '
                            'Jasmine/Peach/Honey/Black Tea vs Nuts/Caramel/Macadamia/Toast. '
                            '원문 이미지 없이는 해결 불가.',
                'evidenceSource': 'audit-input/products/아이덴티티커피랩-칠린블렌드-45812c89.json#evidence.ocrNotes',
            }
            p['diff']['tastingNotes'] = {
                'match': None, 'case': 3, 'failureReason': 'OCR_CONFLICT',
                'note': '동일 이미지 OCR 2건 충돌 — 원문 이미지 없이는 판정 불가',
            }
            stats['ocr_conflict'] += 1

        # ---- diff 재분류 ----
        df = p['diff']
        nd = {'match': None, 'case': None, 'failureReason': 'NOT_DISPLAYED_FIELD',
              'note': '앱에 해당 표시 없음'}
        df['originRegion'] = dict(nd)
        df['productType'] = dict(nd)
        stats['not_displayed'] += 2

        # producer diff: golden.producer vs farm('농장' 행)
        gp = g['producer']
        gv = gp.get('value')
        gconf = gp.get('confidence')
        if gconf == 'UNKNOWN':
            df['producer'] = {'match': None, 'case': 3, 'failureReason': 'EVIDENCE_UNAVAILABLE',
                              'note': 'golden 미확정 — 판정 불가'}
        elif gv is None:
            if not farm:
                df['producer'] = {'match': True, 'case': None, 'failureReason': None,
                                  'note': '원문·표시 모두 생산자 정보 없음'}
            else:
                df['producer'] = {'match': False, 'case': 2, 'failureReason': 'FALSE_POSITIVE',
                                  'note': f"'농장' 행에 상품명 잔여 텍스트 표시 (원문 생산자 정보 없음): '{farm}'"}
                stats['producer_false_positive'] += 1
        else:
            if producer_match(gv, farm):
                df['producer'] = {'match': True, 'case': None, 'failureReason': None,
                                  'note': "'농장' 행에 생산자명 표시"}
                stats['producer_match'] += 1
            else:
                if not farm:
                    df['producer'] = {'match': False, 'case': 2, 'failureReason': 'FIELD_MAPPING_ERROR',
                                      'note': f"원문 생산자 '{gv}'이나 '농장' 행 표시 없음"}
                else:
                    df['producer'] = {'match': False, 'case': 2, 'failureReason': 'FIELD_MAPPING_ERROR',
                                      'note': f"원문 생산자 '{gv}' vs '농장' 행 '{farm}' — farm은 상품명 기반 추론"}
                stats['producer_mapping_error'] += 1

        # status diff
        sv = g['status']['value']
        disp_status = cv[pid]['displayed']['status']
        if sv == disp_status:
            df['status'] = {'match': True, 'case': None, 'failureReason': None,
                            'note': '수집 플래그 기준 — 정확도 통계에서 제외'}
        else:
            df['status'] = {'match': False, 'case': 1, 'failureReason': 'PARSER_MISS',
                            'note': "원문에 'SOLD OUT' 표기되나 수집 플래그 isSoldOut=false — 수집 누락 (정확도 통계에서 제외)"}
            stats['status_parser_miss'] += 1

        # roast diff 재계산 (값이 바뀐 경우만)
        rf = [r for r in roast_fixes if r[0] == pid]
        if rf:
            _, oldv, newv, lab, _oldconf = rf[0]
            disp_roast = (cv[pid]['displayed'].get('roastLevel') or '').strip()
            disp_norm = None
            for l in ROAST_LABELS_SORTED:
                if disp_roast == l:
                    disp_norm = ROAST_LABELS[l]
                    break
            if disp_norm == newv:
                df['roast'] = {'match': True, 'case': None, 'failureReason': None,
                               'note': f"원문 '{lab}' → {newv}, 표시 '{disp_roast}'와 일치"}
            elif disp_roast in ('확인 필요', ''):
                smart = cv[pid].get('smartstore', False)
                df['roast'] = {'match': False, 'case': 1,
                               'failureReason': 'NOT_IMPLEMENTED' if smart else 'PARSER_MISS',
                               'note': f"원문 '{lab}' → {newv}이나 표시 '{disp_roast}'"}
            else:
                df['roast'] = {'match': False, 'case': 1, 'failureReason': 'FIELD_MAPPING_ERROR',
                               'note': f"원문 '{lab}' → {newv} vs 표시 '{disp_roast}'"}

    # ---- summary 재계산 ----
    s = d['summary']
    reviewed = [p for p in d['products'] if p.get('evidenceGrade') != 'C']
    # 불일치율 (status 제외)
    status_dis = {'1': 0, '2': 2, '3': 2, '4': 0, '5': 0}[str(bi)]
    dis_total = s.get('disagreements', 0)
    dis_nostatus = dis_total - status_dis
    s['disagreementsExclStatus'] = dis_nostatus
    s['disagreementRateExclStatus'] = round(dis_nostatus / (len(reviewed) * 8), 4) if reviewed else 0
    s['statusExcludedFromAccuracy'] = True
    # UNKNOWN / SOURCE_MISSING 분리 집계
    unk = sm = 0
    for p in d['products']:
        for fld, gf in p['golden'].items():
            if isinstance(gf, dict):
                if gf.get('confidence') == 'UNKNOWN': unk += 1
                elif gf.get('confidence') == 'SOURCE_MISSING': sm += 1
    s['unknownFieldCount'] = unk
    s['sourceMissingFieldCount'] = sm
    total_fields = len(d['products']) * 9
    s['unknownFieldRate'] = round(unk / total_fields, 4)
    s['sourceMissingFieldRate'] = round(sm / total_fields, 4)
    # diff 불일치 (status 제외)
    mism = 0
    frd = collections.Counter()
    for p in d['products']:
        for fld, dd in p['diff'].items():
            if fld == 'status' or not isinstance(dd, dict):
                continue
            if dd.get('match') is False:
                mism += 1
                if dd.get('failureReason'):
                    frd[dd['failureReason']] += 1
    s['mismatchCountExclStatus'] = mism
    s['failureReasonDistributionExclStatus'] = dict(frd)
    s['revisionNotes'] = (
        'schema-rev1: originRegion/productType diff → NOT_DISPLAYED_FIELD; '
        'producer diff = golden.producer vs displayed farm(농장 행); '
        'confidence에 SOURCE_MISSING 추가; status = collector_flag/MEDIUM (정확도 통계 제외); '
        '칠린블렌드 tastingNotes → OCR_CONFLICT/CASE 3; roast 5단계 enum + raw 보존; '
        'golden 전 필드에 raw(원문 표기) 병기'
    )
    json.dump(d, open(fn, 'w'), ensure_ascii=False, indent=1)
    print(f'batch-00{bi}: wrote {len(d["products"])} products | '
          f'disagree {dis_total}->{dis_nostatus} (rate {s["disagreementRateExclStatus"]}) | '
          f'UNKNOWN {unk} / SOURCE_MISSING {sm} | mismatch(excl status) {mism}')

print('\n=== stats ===')
for k, v in sorted(stats.items()):
    print(f'  {k}: {v}')
print('\n=== roast fixes (value or confidence changed) ===')
for pid, oldv, newv, lab, oldconf in roast_fixes:
    print(f'  {pid}: {oldv}({oldconf}) -> {newv}(HIGH) (raw={lab})')
print('\n=== status exceptions (원문 우선) ===')
for pid in status_exceptions:
    print(f'  {pid}')
