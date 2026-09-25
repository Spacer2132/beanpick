#!/usr/bin/env python3
# 배치 16~19 Reviewer A/B 입력 파일 생성
# - A 입력: 증거 + current 전체(raw/displayed) + isSoldOut
# - B 입력: 증거 + isSoldOut만 (current.raw/displayed 블라인드), 순서 셔플
import json, os, random

BASE = os.path.expanduser("~/workspace/beanpick")

def build_input(n, for_b):
    ev = json.load(open(os.path.join(BASE, "audit/golden/_work/batch-%03d-evidence.json" % n)))
    items = [e for e in ev if e["evidenceGrade"] in ("A", "B")]
    out = []
    for e in items:
        if for_b:
            out.append({
                "id": e["id"],
                "evidenceGrade": e["evidenceGrade"],
                "roastery": e["roastery"],
                "productName": e["productName"],
                "productUrl": e["productUrl"],
                "isSoldOut": e["isSoldOut"],
                "evidenceFile": e["evidenceFile"],
                "detailText": e["detailText"],
                "detailTextFullLen": e["detailTextFullLen"],
                "rawTexts": e["rawTexts"],
                "ocrNotes": e["ocrNotes"],
                "detailImageUrls": e["detailImageUrls"],
            })
        else:
            out.append(e)  # current 포함 전체
    if for_b:
        rnd = random.Random(20260925 + n)  # A와 다른 순서
        rnd.shuffle(out)
    suffix = "reviewerB-input" if for_b else "reviewerA-input"
    fp = os.path.join(BASE, "audit/golden/_work/batch-%03d-%s.json" % (n, suffix))
    json.dump(out, open(fp, "w"), ensure_ascii=False, indent=1)
    print("wrote", fp, len(out))

for n in (16, 17, 18, 19):
    build_input(n, for_b=False)
    build_input(n, for_b=True)
