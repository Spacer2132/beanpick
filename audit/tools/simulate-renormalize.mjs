#!/usr/bin/env node
// FIX-1 시뮬레이션: 스냅샷 각 상품의 tastingNoteEvidence[].text를
// "새" 정규화기로 다시 정규화해 product.tastingNotes에 저장한 products.json을 만든다.
// - 발행 시점에 새 정규화기가 적용됐다고 가정한 시뮬레이션 (실제 발행 아님).
// - 호출 형태는 electron/githubPublisher.cjs preservePreviousTastingNotes와 동일:
//   normalizeTastingNotes(evidenceTexts, { limit: 5, explicitEvidence: true })
//   (reviewReason 있는 항목 제외). 이게 실제 발행 경로이므로 limit:5를 쓴다.
// - tastingNotes 외 모든 필드는 그대로 둔다.
// 사용: node audit/tools/simulate-renormalize.mjs <입력products.json> <출력.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeTastingNotes } from '../../src/services/tastingNotes.js';

const [inPath, outPath] = process.argv.slice(2).map((a) => resolve(a));
if (!inPath || !outPath) {
  console.error('사용: node audit/tools/simulate-renormalize.mjs <입력products.json> <출력.json>');
  process.exit(2);
}

const raw = JSON.parse(readFileSync(inPath, 'utf8'));
const list = Array.isArray(raw) ? raw : raw.products;

let changed = 0;
for (const p of list) {
  // 발행 경로(githubPublisher.cjs)와 동일: reviewReason 제외 + explicitEvidence
  const texts = (p.tastingNoteEvidence || [])
    .filter((e) => e && !e.reviewReason)
    .map((e) => e.text)
    .filter(Boolean);
  const before = JSON.stringify(p.tastingNotes || []);
  const after = normalizeTastingNotes(texts, { limit: 5, explicitEvidence: true });
  p.tastingNotes = after;
  if (JSON.stringify(after) !== before) changed++;
}

const out = Array.isArray(raw) ? list : { ...raw, products: list };
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`tastingNotes 변경 상품: ${changed}/${list.length} → ${outPath}`);
