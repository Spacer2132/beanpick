#!/usr/bin/env python3
"""Quality Auditor 자동 검사 5종 (PHASE-1-RESULTS-4 [C] + INTERIM-4/5)

배치 golden 파일에 대해 다음 위반을 검사한다. 위반이 있으면 목록을 출력하고
exit 1, 없으면 "0건"을 출력하고 exit 0.

검사:
  (1) 질감어 사전 — tastingNotes value에 질감 서술이 노트로混入
  (2) process 오염 — process value에 블렌드/디카페인/디카페인 공정어 포함
  (3) evidenceKind 누락 — OCR 단독 근거 + MEDIUM인데 evidenceKind가 없음
  (4) Reviewer 독립성 — A/B evidence 문구 동일 30% 초과, golden 바이트 동일,
      유사 문구(difflib ≥ 0.8) 50% 초과 시 FAIL
  (5) status 데이터 기반 — golden status.value vs current-values.json isSoldOut
      (overrideExcerpt에 본문 품절 안내 발췌가 있으면 예외)
"""
import json
import glob
import re
import sys
import difflib
from pathlib import Path

# 스크립트 위치 기준으로 경로를 잡아 어느 폴더에서 실행해도 같은 결과
GOLDEN_DIR = Path(__file__).resolve().parent.parent / 'golden'
WORK_DIR = GOLDEN_DIR / '_work'

# (1) 질감어 사전 — 지금까지 제거된 질감 서술 (정확 일치, 영문은 대소문자 무시)
TEXTURE_WORDS = {
    '쥬시', '쥬시한', 'sweet', 'juicy', '부드러운', '풀바디',
    '좋은균형감', '좋은밸런스', '마일드한커피', '복합성', '달콤함',
    '가득', '깔끔한',
}
# 'Sweet mandarin' 같은 복합 향미 노트는 제외 — 단독 토큰일 때만 위반


def norm(s):
    return re.sub(r'\s+', '', str(s)).lower()


def is_texture(note):
    return norm(note) in {norm(w) for w in TEXTURE_WORDS}


# (2) process에 들어가면 안 되는 단어 — 블렌드/디카페인/디카페인 공정어
PROCESS_BANNED = [
    '블렌드', 'blend',
    '디카페인', 'decaf', 'decaffeinated',
    '마운틴워터', '마운틴 워터', 'mountainwater',
    '스위스워터', '스위스 워터', 'swisswater',
    '슈가케인', 'sugarcane',
]


def process_contaminated(value):
    if not value:
        return None
    n = norm(value)
    # E.A 단독 (Ethyl Acetate = 디카페인 공정)
    if re.fullmatch(r'e\.?a\.?', n):
        return 'E.A(디카페인 공정)'
    for w in PROCESS_BANNED:
        if norm(w) in n:
            return w
    return None


# (3) OCR 단독 근거 판정
def is_ocr_only(src):
    if not src or not src.strip():
        return False
    parts = [p.strip() for p in re.split(r'\s*[+,]\s*', src)]
    return bool(parts) and all(
        re.search(r'evidence\.ocr|ocrNotes|gemini', p, re.I) for p in parts)


def main():
    violations = []
    files = sorted(GOLDEN_DIR.glob('batch-*.json'))
    files = [f for f in files if len(f.name) <= 14]
    if not files:
        # 거짓 통과 방지: 검사 대상이 0개면 오류로 종료
        print(f'오류: 배치 파일을 찾지 못함 ({GOLDEN_DIR})', file=sys.stderr)
        sys.exit(1)
    for fp in files:
        batch = fp.name.replace('.json', '')
        b = json.load(fp.open())
        for p in b['products']:
            pid = p['id']
            g = p['golden']
            # (1) 질감어
            tn = g.get('tastingNotes') or {}
            for note in (tn.get('value') or []):
                if is_texture(note):
                    violations.append((batch, pid, '질감어', repr(note)))
            # (2) process 오염 (+ decafMethod가 있으면 process는 깨끗해야 함)
            pr = g.get('process') or {}
            hit = process_contaminated(pr.get('value'))
            if hit:
                violations.append((batch, pid, 'process 오염', f'{pr.get("value")!r} ({hit})'))
            # (3) evidenceKind 누락된 OCR 단독 MEDIUM (tastingNotes)
            if (tn.get('confidence') == 'MEDIUM'
                    and is_ocr_only(tn.get('evidenceSource', ''))
                    and not tn.get('evidenceKind')):
                violations.append((batch, pid, 'evidenceKind 누락', 'OCR 단독 MEDIUM'))

    # (4) Reviewer 독립성 검사 — A/B evidence 문구 동일 비율, golden 바이트 동일
    for fp in files:
        batch = fp.name.replace('.json', '')
        n = batch.replace('batch-', '')
        fa = WORK_DIR / f'batch-{n}-reviewerA.json'
        fb = WORK_DIR / f'batch-{n}-reviewerB.json'
        if not (fa.exists() and fb.exists()):
            continue  # reviewer 파일이 없으면 스킵 (배치 1~8 등 구방식)
        A = json.load(fa.open())
        B = json.load(fb.open())
        ev_same = ev_tot = 0
        byte_same = []
        for pid in A:
            if pid not in B:
                continue
            ga = A[pid].get('golden', A[pid])
            gb = B[pid].get('golden', B[pid])
            if json.dumps(ga, sort_keys=True, ensure_ascii=False) == \
               json.dumps(gb, sort_keys=True, ensure_ascii=False):
                byte_same.append(pid)
            for f, va in ga.items():
                if not (isinstance(va, dict) and va.get('evidence')):
                    continue
                vb = gb.get(f)
                if not (isinstance(vb, dict) and vb.get('evidence')):
                    continue
                ev_tot += 1
                if str(va['evidence']).strip() == str(vb['evidence']).strip():
                    ev_same += 1
        ratio = ev_same / ev_tot if ev_tot else 0
        detail = f'evidence 동일 {ev_same}/{ev_tot}={ratio:.0%}, golden 바이트동일 {len(byte_same)}건'
        if ratio > 0.30:
            violations.append((batch, '-', '독립성 붕괴', f'evidence 동일 비율 {ratio:.0%} > 30% ({detail})'))
        if byte_same:
            violations.append((batch, '-', '독립성 붕괴',
                               f'golden 바이트 동일 {len(byte_same)}건: {byte_same[:5]}{"…" if len(byte_same) > 5 else ""}'))
        # (4b) 유사 문구 비율 (difflib ratio >= 0.8, 완전 동일 포함) — 표현만 바꾼 베낌 탐지
        # 실측: 오염 버전 70~99%, 정상 버전 13~40% → FAIL 기준 50%
        sim_n = 0
        for pid in A:
            if pid not in B:
                continue
            ga = A[pid].get('golden', A[pid])
            gb = B[pid].get('golden', B[pid])
            for f, va in ga.items():
                if not (isinstance(va, dict) and va.get('evidence')):
                    continue
                vb = gb.get(f)
                if not (isinstance(vb, dict) and vb.get('evidence')):
                    continue
                ea, eb = str(va['evidence']).strip(), str(vb['evidence']).strip()
                if difflib.SequenceMatcher(None, ea, eb).ratio() >= 0.8:
                    sim_n += 1
        sim_ratio = sim_n / ev_tot if ev_tot else 0
        print(f'  [{batch}] 유사 문구(≥0.8): {sim_n}/{ev_tot}={sim_ratio:.0%}', end=' ')
        if sim_ratio > 0.50:
            violations.append((batch, '-', '독립성 붕괴', f'유사 문구 비율 {sim_ratio:.0%} > 50%'))
            print('FAIL')
        else:
            print('OK')
        print(f'  [{batch}] 독립성: {detail} {"OK" if ratio <= 0.30 and not byte_same else "FAIL"}')

    # (5) status 데이터 기반 검사 — golden 값 vs current-values.json isSoldOut
    # golden status.value가 수집 플래그와 다르면 FAIL.
    # 단, status.overrideExcerpt에 구매 버튼 영역이 아닌 본문 품절 안내의 원문 발췌가 있으면 예외
    # (발췌에 템플릿 마커가 섞여 있으면 예외 무효).
    cv_all = json.load(open(GOLDEN_DIR / 'current-values.json'))['current']
    TEMPLATE_MARKERS = ['장바구니', '바로구매하기', '바로 구매하기', 'ADD TO CART',
                        'BUY NOW', 'WISH LIST', '관심상품', '예약주문', '정기배송',
                        '위시리스트', 'REGULAR DELIVERY']
    for fp in files:
        batch = fp.name.replace('.json', '')
        b = json.load(fp.open())
        for p in b['products']:
            st = p['golden'].get('status') or {}
            gv = st.get('value')
            flag = cv_all.get(p['id'], {}).get('isSoldOut')
            if flag is None or gv not in ('active', 'soldout'):
                continue
            expected = 'soldout' if flag else 'active'
            if gv == expected:
                continue
            excerpt = str(st.get('overrideExcerpt') or '')
            if excerpt and not any(m in excerpt for m in TEMPLATE_MARKERS):
                continue  # 본문 품절 안내 발췌 — 예외
            violations.append((batch, p['id'], 'status 불일치',
                               f'golden={gv} vs isSoldOut={flag} (overrideExcerpt 없음)'))

    if violations:
        print(f'위반 {len(violations)}건:')
        for v in violations:
            print(' ', v)
        sys.exit(1)
    print(f'위반 0건 (검사 대상: {len(files)}개 배치 파일)')
    sys.exit(0)


if __name__ == '__main__':
    main()
