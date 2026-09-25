#!/usr/bin/env node
// golden tastingNotes raw -> BeanPick 표시 어휘 정규화 (비교 전용)
// golden.tastingNotes.comparable 을 배치 파일에 기록하고,
// displayed 와의 비교 결과(matched / missing_in_displayed / extra_in_displayed / unmatched_pairs)를
// audit/golden/_work/tastingnotes-comparison.json 에 저장한다.
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { normalizeTastingNotes, NON_TASTE_ALIASES, COUNTRY_ALIASES } from '../../src/services/tastingNotes.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GOLDEN = join(ROOT, 'audit/golden');

// 질감어 사전 (audit/tools/quality-auditor-checks.py TEXTURE_WORDS와 동일 —
// golden value에서 제거된, 노트가 아닌 것으로 판정된 서술)
const TEXTURE_WORDS = new Set([
  '쥬시', '쥬시한', 'sweet', 'juicy', '부드러운', '풀바디',
  '좋은균형감', '좋은밸런스', '마일드한커피', '복합성', '달콤함',
  '가득', '깔끔한',
]);
const normKey = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const current = JSON.parse(readFileSync(join(GOLDEN, 'current-values.json'), 'utf8')).current;

// raw 노트 하나가 정규화 과정에서 어떻게 사라졌는지 분류
function classifyDrop(note, comparableSet) {
  const text = String(note || '').trim();
  if (!text) return null;
  // 단일 노트 기준 매핑 (overlap 제거 전)
  const individual = normalizeTastingNotes([note], { limit: Infinity, explicitEvidence: true });
  if (individual.length > 0) {
    const removed = individual.filter((x) => !comparableSet.has(x));
    if (removed.length > 0) {
      return { note: text, mappedTo: individual, reason: 'overlap-removed' };
    }
    return null; // comparable에 살아있음
  }
  // 매핑 자체가 안 됨 — 정당하게 버려진 것인지 판정
  const k = normKey(text);
  if ([...TEXTURE_WORDS].some((w) => normKey(w) === k)) {
    return { note: text, mappedTo: [], reason: 'texture' };
  }
  const blocked = [...NON_TASTE_ALIASES, ...COUNTRY_ALIASES].map(normKey);
  if (blocked.includes(k)) {
    return { note: text, mappedTo: [], reason: 'blocked-nontaste' };
  }
  return { note: text, mappedTo: [], reason: 'dictionary-miss' };
}

const batchFiles = readdirSync(GOLDEN)
  .filter((f) => /^batch-0\d{2}\.json$/.test(f) && f.length <= 14)
  .sort();
if (batchFiles.length === 0) {
  console.error('배치 파일을 찾지 못함');
  process.exit(1);
}

const report = { generatedAt: new Date().toISOString(), products: [] };

for (const bf of batchFiles) {
  const fp = join(GOLDEN, bf);
  const batch = JSON.parse(readFileSync(fp, 'utf8'));
  let dirty = false;
  for (const p of batch.products) {
    const tn = p.golden?.tastingNotes;
    if (!tn) continue;
    const rawNotes = tn.raw ?? tn.value;
    const list = Array.isArray(rawNotes) ? rawNotes : rawNotes == null ? [] : [rawNotes];
    const comparable = normalizeTastingNotes(list, { limit: Infinity, explicitEvidence: true });
    if (JSON.stringify(tn.comparable) !== JSON.stringify(comparable)) {
      tn.comparable = comparable;
      dirty = true;
    }
    // 사각지대: 정규화기가 버린 노트 (comparable에 매핑되지 않은 raw 노트)
    const cset0 = new Set(comparable);
    const droppedByNormalizer = list
      .map((note) => classifyDrop(note, cset0))
      .filter(Boolean);
    if (JSON.stringify(tn.droppedByNormalizer) !== JSON.stringify(droppedByNormalizer)) {
      tn.droppedByNormalizer = droppedByNormalizer;
      dirty = true;
    }
    // 사전 누락 후보: raw 노트 중 정규화 결과가 없는 것
    const unmatched = droppedByNormalizer
      .filter((d) => d.reason === 'dictionary-miss')
      .map((d) => d.note);
    const disp = current[p.id]?.displayed?.tastingNotes ?? null;
    const cset = new Set(comparable);
    const dset = new Set(Array.isArray(disp) ? disp : []);
    report.products.push({
      batch: bf.replace('.json', ''),
      id: p.id,
      confidence: tn.confidence,
      evidenceKind: tn.evidenceKind || null,
      raw: list,
      comparable,
      displayed: disp,
      matched: [...cset].filter((x) => dset.has(x)),
      missing_in_displayed: [...cset].filter((x) => !dset.has(x)),
      extra_in_displayed: [...dset].filter((x) => !cset.has(x)),
      dropped_by_normalizer: droppedByNormalizer,
      unmatched_pairs: unmatched,
    });
  }
  if (dirty) writeFileSync(fp, JSON.stringify(batch, null, 1), 'utf8');
}
writeFileSync(join(GOLDEN, '_work/tastingnotes-comparison.json'), JSON.stringify(report, null, 1), 'utf8');
console.log(`batches: ${batchFiles.length}, products: ${report.products.length}`);
