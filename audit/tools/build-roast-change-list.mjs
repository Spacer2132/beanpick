#!/usr/bin/env node
// FIX-3 전체 변경 목록 생성: 462건 전체에서 roastLevel 표시가 바뀌는 상품 목록
// before = 구 코드 표시(p.roastLevel ?? ''), after = 신 코드 표시(getDisplayRoastLevel) + 4c 시뮬레이션 저장값
// 사용: node audit/tools/build-roast-change-list.mjs
// 출력: audit/fixes/roast-change-list.json
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { getDisplayRoastLevel } = require(join(ROOT, 'src/services/roastLevel.cjs'));

const docs = JSON.parse(readFileSync(join(ROOT, 'docs/products.json'), 'utf8'));
const sim = JSON.parse(readFileSync('/tmp/sim-roast.json', 'utf8'));
const simById = Object.fromEntries((sim.products || sim).map((p) => [p.id, p]));

const list = [];
for (const p of docs.products) {
  const before = p.roastLevel ?? '';
  const simP = simById[p.id] || p;
  const after = getDisplayRoastLevel(simP) || '';
  const beforeShown = before === '확인 필요' ? '' : before;
  if (beforeShown !== after) {
    list.push({
      id: p.id,
      productName: p.productName,
      before: beforeShown || '(표시 없음)',
      after: after || '(표시 없음)',
      storedAfter: simP.roastLevel || '',
      simFilled: simP._simRoastSource === 'detail',
      evidence: simP._simRoastSource === 'detail'
        ? `상세: ${(simP._simRoastEvidence || '').slice(0, 160)}`
        : `상품명: ${p.productName || ''}`,
    });
  }
}
const out = {
  generatedAt: new Date().toISOString(),
  note: 'before=구 표시(p.roastLevel), after=신 표시(getDisplayRoastLevel)+4c 시뮬레이션 저장값. 4c는 시뮬레이션 추정치.',
  total: docs.products.length,
  changed: list.length,
  changes: list,
};
writeFileSync(join(ROOT, 'audit/fixes/roast-change-list.json'), JSON.stringify(out, null, 1), 'utf8');
console.log(`전체 ${out.total}건 중 변경 ${out.changed}건 → audit/fixes/roast-change-list.json`);
const byAfter = {};
for (const c of list) byAfter[c.after] = (byAfter[c.after] || 0) + 1;
console.log('after 분포:', JSON.stringify(byAfter));
