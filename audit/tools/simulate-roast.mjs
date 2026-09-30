#!/usr/bin/env node
// FIX-3 §4c 시뮬레이션: audit-input의 상세 텍스트로 수집 단계(4c 로직)를 흉내 낸 products.json 생성.
// "시뮬레이션 추정치" — 실제 수집이 아니라 audit-input에 저장된 상세 텍스트를 재사용한다.
// 사용: node audit/tools/simulate-roast.mjs <in-products.json> <out-sim.json>
// 측정: npm run audit:data -- <out-sim.json> --before <in-products.json>
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { extractRoastLevel, isRoastLevelUnknown } = require(join(ROOT, 'src/services/roastLevel.cjs'));

const AUDIT_INPUT = '/home/hatch/workspace/audit-input-work/audit-input';
const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) { console.error('사용: simulate-roast.mjs <in-products.json> <out-sim.json>'); process.exit(1); }

function detailTextsOf(ev) {
  const texts = [];
  const dc = ev.detailCache;
  if (typeof dc === 'string') texts.push(dc);
  else if (dc && typeof dc === 'object') {
    for (const v of Object.values(dc)) if (typeof v === 'string' && v) texts.push(v);
  }
  const ro = ev.rawObservations;
  if (typeof ro === 'string') texts.push(ro);
  else if (Array.isArray(ro)) {
    for (const r of ro) {
      if (typeof r === 'string') texts.push(r);
      else if (r && typeof r.text === 'string') texts.push(r.text);
    }
  }
  return texts;
}


// 근거 스니펫: 매핑된 레벨의 대표 표현이 처음 등장한 주변 60자
function evidenceSnippet(text, level) {
  const probes = {
    'Medium-Dark': ['중강배전','미디엄다크','미디엄 다크','미디움다크','미디움 다크','medium-dark','medium dark'],
    'Medium-Light': ['중약배전','미디엄라이트','미디엄 라이트','미디움라이트','미디움 라이트','medium-light','medium light'],
    'Dark': ['강배전','다크로스트','다크 로스트','다크','dark'],
    'Light': ['약배전','라이트로스트','라이트 로스트','라이트','light'],
    'Medium': ['중배전','미디엄로스트','미디엄 로스트','미디엄','미디움','medium'],
  };
  const t = String(text || '');
  for (const probe of (probes[level] || [])) {
    const i = t.toLowerCase().indexOf(probe.toLowerCase());
    if (i >= 0) return t.slice(Math.max(0, i - 60), i + probe.length + 60).replace(/\s+/g, ' ');
  }
  return '';
}

const detailById = {};
const dir = join(AUDIT_INPUT, 'products');
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  let d;
  try { d = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
  const id = d.snapshotRecord?.id;
  if (id) detailById[id] = detailTextsOf(d.evidence || {});
}

const raw = JSON.parse(readFileSync(resolve(inPath), 'utf8'));
const products = Array.isArray(raw) ? raw : raw.products;
let filled = 0, unknown = 0, noDetail = 0;
const filledList = [];
for (const p of products) {
  if (!isRoastLevelUnknown(p.roastLevel)) continue;
  unknown++;
  const texts = detailById[p.id] || [];
  if (!texts.length) { noDetail++; continue; }
  // 수집 단계 흉내: 상세 텍스트 전체에서 추출 (스마트스토어 detailText + cafe24 파서 텍스트 근사)
  const joined = texts.join('\n');
  const found = extractRoastLevel(joined);
  if (found) {
    p.roastLevel = found;
    p._simRoastSource = 'detail';
    p._simRoastEvidence = evidenceSnippet(joined, found);
    filled++;
    filledList.push({ id: p.id, level: found });
  }
}
writeFileSync(resolve(outPath), JSON.stringify(raw, null, 1), 'utf8');
console.log(`입력 ${products.length}건 중 roastLevel 미상 ${unknown}건, 상세 텍스트 없음 ${noDetail}건, 시뮬레이션 채움 ${filled}건`);
console.log(`wrote ${outPath} — 시뮬레이션 추정치`);
