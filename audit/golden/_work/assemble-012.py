import json, copy
from collections import Counter

ROOT = '/home/hatch/workspace/beanpick'
products = json.load(open(ROOT + '/audit/golden/_work/batch-012-products.json'))
QA = json.load(open(ROOT + '/audit/golden/_work/batch-012-qa.json'))
DOMAIN = json.load(open(ROOT + '/audit/golden/_work/batch-012-domain.json'))
BATCH = json.load(open(ROOT + '/audit/golden/batches.json'))

# review 블록에 QA/도메인 노트 주입
qa_note = "수동 QA 8항목 전수 확인 (증거 없는 HIGH·AI 노트·질감어·로스터리명 혼동·블렌드 오판·roastLevel 추정). 되돌림 없음. 상세: audit/golden/_work/batch-012-qa.json"
domain_note = "도메인 이상 없음. 게이샤=품종·예가체프=지역·Våtbredet=워시드·G1/AA 등급 제외·501 로트번호 제외·만델링 통칭 제외·엘 파라이소 농장명·워싱스테이션→producer SOURCE_MISSING 검증. 상세: audit/golden/_work/batch-012-domain.json"
for p in products:
    if 'qualityAudit' in p['review']:
        p['review']['qualityAudit']['note'] = qa_note
        p['review']['domainReview']['note'] = domain_note

# summary 통계
FIELDS = ['productType','status','originCountry','originRegion','producer','process','variety','roast','tastingNotes']
total = len(products)
reviewed = sum(1 for p in products if p['evidenceGrade'] != 'C')
cmech = total - reviewed

unknown = sum(1 for p in products for f in FIELDS
              if p['golden'][f]['confidence'] == 'UNKNOWN' and f != 'status')
unknown_excl_c = sum(1 for p in products if p['evidenceGrade'] != 'C' for f in FIELDS
                     if p['golden'][f]['confidence'] == 'UNKNOWN' and f != 'status')
sm = sum(1 for p in products for f in FIELDS
         if p['golden'][f]['confidence'] == 'SOURCE_MISSING')

mm = 0
dist = Counter()
for p in products:
    for f, dd in p['diff'].items():
        if f == 'status': continue
        if dd.get('match') is False:
            mm += 1
            dist[dd.get('failureReason')] += 1

summary = {
    'total': total,
    'cMechanical': cmech,
    'reviewed': reviewed,
    'disagreements': 3,
    'disagreementsExclStatus': 3,
    'disagreementRateExclStatus': round(3 / (reviewed * 8), 4),
    'unknownFieldCount': unknown,
    'unknownFieldRate': round(unknown / (total * 9), 4),
    'unknownFieldCountExclC': unknown_excl_c,
    'sourceMissingFieldCount': sm,
    'sourceMissingFieldRate': round(sm / (total * 9), 4),
    'mismatchCountExclStatus': mm,
    'failureReasonDistributionExclStatus': dict(sorted(dist.items())),
    'statusExcludedFromAccuracy': True,
    'qaReversals': 0,
    'domainCorrections': 0,
    'topMisjudgments': [
        {'field': 'producer', 'pattern': "농장 행에 상품명 잔여 텍스트 표시 (golden null/SOURCE_MISSING인데 표시값 존재)", 'count': 15, 'example': 'aerycoffee-11368384812'},
        {'field': 'tastingNotes', 'pattern': "원문 노트 표시 누락 (OCR/본문 노트 중 일부만 표시)", 'count': 10, 'example': 'cafedoan-12759206817'},
        {'field': 'process', 'pattern': "원문 가공 정보 표시 누락", 'count': 6, 'example': 'cafedoan-12759206817'},
    ],
    'revisionNotes': 'rev2 적용: SOURCE_MISSING 강화(워싱스테이션·Well-done 라벨·G1/AA 등급·501 로트번호), OCR 단독 근거 MEDIUM에 evidenceKind current_echo, decafMethod 분리(해당 없음), 질감어 value 제외·raw 보존, 원문 우선(status soldout 4건).',
}

out = {
    'batch': 'batch-012',
    'ids': BATCH['batches'][11]['ids'],
    'snapshot': BATCH['batches'][11].get('snapshot', '2026-09-25'),
    'summary': summary,
    'products': products,
}
json.dump(out, open(ROOT + '/audit/golden/batch-012.json', 'w'), ensure_ascii=False, indent=1)
print('written batch-012.json')
print(json.dumps(summary, ensure_ascii=False, indent=1))
