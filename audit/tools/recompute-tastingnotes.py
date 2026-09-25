#!/usr/bin/env python3
"""[1] tastingNotes diff 재계산 — regression-rules §6.1 기준.

golden.tastingNotes.comparable (BeanPick 표시 어휘) vs displayed를 집합으로 비교, 순서 무시.
- 집합 동일 → match=True
- missing만 → PARSER_MISS / extra만 → FALSE_POSITIVE / 둘 다 → NORMALIZATION_ERROR
- OCR_CONFLICT, UNKNOWN(match=None)은 유지 (손대지 않음)
- 배치 summary의 mismatchCount / failureReasonDistribution(ExclStatus) 재계산
"""
import json, sys

ROOT = '/home/hatch/workspace/beanpick'
GOLDEN = ROOT + '/audit/golden'

def main():
    cur = json.load(open(GOLDEN + '/current-values.json', encoding='utf-8'))['current']
    changed_true = 0
    changed_false = 0
    for n in range(1, 20):
        fp = f'{GOLDEN}/batch-{n:03d}.json'
        batch = json.load(open(fp, encoding='utf-8'))
        for p in batch['products']:
            d = p['diff']
            if not isinstance(d, dict):
                print('WARN: diff가 dict가 아님', p['id'], file=sys.stderr)
                continue
            td = d.get('tastingNotes')
            if not isinstance(td, dict):
                continue
            if td.get('failureReason') == 'OCR_CONFLICT':
                continue  # CASE 3 — 손대지 않음
            tn = p['golden'].get('tastingNotes') or {}
            if tn.get('confidence') == 'UNKNOWN':
                new = {'match': None, 'case': 3, 'failureReason': 'EVIDENCE_UNAVAILABLE',
                       'note': 'golden UNKNOWN — 판정 불가'}
            else:
                cset = set(tn.get('comparable') or [])
                disp = cur[p['id']]['displayed']['tastingNotes'] or []
                dset = set(disp if isinstance(disp, list) else [])
                matched = sorted(cset & dset)
                missing = sorted(cset - dset)
                extra = sorted(dset - cset)
                if not missing and not extra:
                    order = ' (순서만 다름)' if list(tn.get('comparable') or []) != list(disp if isinstance(disp, list) else []) else ''
                    new = {'match': True, 'case': None, 'failureReason': None,
                           'note': f'집합 일치{order} — matched {len(matched)}건'}
                elif missing and not extra:
                    new = {'match': False, 'case': 1, 'failureReason': 'PARSER_MISS',
                           'note': f"표시 누락: {', '.join(missing)}"}
                elif extra and not missing:
                    new = {'match': False, 'case': 1, 'failureReason': 'FALSE_POSITIVE',
                           'note': f"golden 외 표시: {', '.join(extra)}"}
                else:
                    new = {'match': False, 'case': 1, 'failureReason': 'NORMALIZATION_ERROR',
                           'note': f"누락: {', '.join(missing)} / 추가: {', '.join(extra)}"}
            old = (td.get('match'), td.get('failureReason'))
            newv = (new['match'], new['failureReason'])
            if old != newv:
                if new['match'] is True:
                    changed_true += 1
                elif new['match'] is False and old[0] is False:
                    changed_false += 1
            d['tastingNotes'] = new
        # 배치 summary 재계산
        s = batch.get('summary', {})
        mm = 0
        fr = {}
        for p in batch['products']:
            d = p['diff']
            if not isinstance(d, dict):
                continue
            for f, r in d.items():
                if not isinstance(r, dict):
                    continue
                if f == 'status':
                    continue
                if r.get('failureReason') == 'NOT_DISPLAYED_FIELD':
                    continue
                if r.get('match') is False:
                    mm += 1
                    k = r.get('failureReason') or 'NONE'
                    fr[k] = fr.get(k, 0) + 1
        s['mismatchCountExclStatus'] = mm
        s['failureReasonDistributionExclStatus'] = fr
        s['mismatchCount'] = mm  # status 전부 일치이므로 동일
        s['tastingNotesRecomputed'] = '2026-09-26 §6.1 집합 비교 재계산'
        json.dump(batch, open(fp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'batch-{n:03d}: mismatch(exclStatus)={mm}')
    print(f'\n신규 match=True: {changed_true}건, False인데 원인 변경: {changed_false}건')

if __name__ == '__main__':
    main()
