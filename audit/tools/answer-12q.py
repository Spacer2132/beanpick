#!/usr/bin/env python3
# PHASE-1-FINAL 12문항 답변용 수치 산출. golden 배치 diff 기준.
import json
from collections import Counter, defaultdict

FIELDS = ['originCountry', 'process', 'producer', 'roast', 'tastingNotes', 'variety']
cur = json.load(open('audit/golden/current-values.json', encoding='utf-8'))['current']

def has_value(v):
    if v is None:
        return False
    if isinstance(v, list):
        return len(v) > 0
    return str(v).strip() != '' and str(v).strip() != '확인 필요'

false_reasons = Counter()   # (field, reason) for match=False
none_reasons = Counter()    # reason for match=None
case1 = 0                   # 실제 데이터 오류: match=False + golden 독립근거 있음
src_missing_fields = 0      # CASE 2: golden SOURCE_MISSING 필드 수
roastery_err = defaultdict(int)  # 로스터리별 문제 수 (match=False + FP)
roastery_fp = defaultdict(int)

CASE1_REASONS = {'PARSER_MISS', 'FALSE_POSITIVE', 'NORMALIZATION_ERROR', 'FIELD_MAPPING_ERROR', 'NOT_IMPLEMENTED'}

def roast_name(p, pid):
    return p.get('roastery') or cur[pid].get('roasterName') or pid.split('-')[0]

for n in range(1, 20):
    b = json.load(open(f'audit/golden/batch-{n:03d}.json', encoding='utf-8'))
    for p in b['products']:
        r = roast_name(p, p['id'])
        d = p['diff'] if isinstance(p['diff'], dict) else {}
        for f in FIELDS:
            g = p['golden'].get(f) or {}
            if not isinstance(g, dict):
                continue
            if g.get('confidence') == 'SOURCE_MISSING':
                src_missing_fields += 1
            dd = d.get(f)
            if not isinstance(dd, dict) or dd.get('failureReason') == 'NOT_DISPLAYED_FIELD':
                continue
            m, reason = dd.get('match'), dd.get('failureReason')
            if m is False:
                false_reasons[(f, reason)] += 1
                if reason in CASE1_REASONS:
                    case1 += 1
                roastery_err[r] += 1
            elif m is None:
                none_reasons[reason] += 1
        # FP: golden SOURCE_MISSING + displayed 값 있음
        for f in FIELDS:
            g = p['golden'].get(f) or {}
            if not isinstance(g, dict) or g.get('confidence') != 'SOURCE_MISSING':
                continue
            dv = cur[p['id']]['displayed'][{'originCountry': 'originCountry', 'process': 'process',
                'producer': 'region', 'roast': 'roastLevel', 'tastingNotes': 'tastingNotes',
                'variety': 'variety'}[f]]
            if has_value(dv):
                roastery_fp[r] += 1
                roastery_err[r] += 1

print('1. 실제 데이터 오류(CASE 1, match=False + golden 독립근거):', case1)
print('   원인 분포:', {f'{f}/{r}': c for (f, r), c in sorted(false_reasons.items(), key=lambda x: (x[0][0], str(x[0][1]))) if r in CASE1_REASONS})
print('2. 원문에 정보 없음(CASE 2, golden SOURCE_MISSING 필드):', src_missing_fields)
parser_miss = sum(c for (f, r), c in false_reasons.items() if r == 'PARSER_MISS')
print('3. Parser 때문에 놓친 건수(PARSER_MISS):', parser_miss)
ocr = sum(c for (f, r), c in list(false_reasons.items()) + [((None, k), v) for k, v in none_reasons.items()] if r == 'OCR_CONFLICT')
print('4. OCR 관련(OCR_CONFLICT):', ocr, '(전부 판정불가)')
notimpl = sum(c for (f, r), c in false_reasons.items() if r == 'NOT_IMPLEMENTED') + none_reasons['NOT_IMPLEMENTED']
print('5. 로스터리/채널 전용 처리 필요(NOT_IMPLEMENTED, 수집 고정값):', notimpl)
print('6. 판정 불가(접근 실패·증거 없음, match=None EVIDENCE_UNAVAILABLE):', none_reasons['EVIDENCE_UNAVAILABLE'])
print('   match=None 전체:', dict(none_reasons))
print('11. 로스터리별 문제 수 Top 5 (match=False + FP):')
for r, c in sorted(roastery_err.items(), key=lambda x: -x[1])[:5]:
    print(f'    {r}: {c} (FP {roastery_fp[r]})')
print('12. 최소 변경 개선: 정규화 사전 alias 추가 → dictionary-miss 228건/144개 상품 (소규모 코드 변경)')
