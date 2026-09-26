#!/usr/bin/env node
// 상품별 필드 등급을 JSON으로 덤프 (코드 변경 전후 비교용)
// 사용: node audit/tools/grade-dump.mjs <products.json> <out.json>
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gradeProduct, displayedOf } from './audit-data.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [productsPath, outPath] = process.argv.slice(2);
if (!productsPath || !outPath) { console.error('사용: grade-dump.mjs <products.json> <out.json>'); process.exit(1); }

const golden = JSON.parse(readFileSync(resolve(ROOT, 'audit/golden-products.json'), 'utf8')).products;
const raw = JSON.parse(readFileSync(resolve(productsPath), 'utf8'));
const products = Array.isArray(raw) ? raw : raw.products;

const out = {};
for (const p of products) {
  const g = golden[p.id];
  if (!g) continue;
  const disp = displayedOf(p);
  out[p.id] = { grade: gradeProduct(g.golden, disp), dispRoast: disp.roast, storedRoast: p.roastLevel || '' };
}
writeFileSync(resolve(outPath), JSON.stringify(out, null, 1), 'utf8');
console.log(`wrote ${outPath}: ${Object.keys(out).length} products`);
