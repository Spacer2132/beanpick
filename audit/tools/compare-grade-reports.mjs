#!/usr/bin/env node
// audit-data.mjs 출력 2건(수정 전/후)의 필드별 등급 표를 파싱해 전이를 요약한다.
// FIX-2 검증용: 코드 변경 전후 비교이므로 git stash로 구 코드를 복원해 before를 생성한다.
// 사용: node audit/tools/compare-grade-reports.mjs <before.md> <after.md>
import { readFileSync } from 'fs';

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
  console.error('사용: node audit/tools/compare-grade-reports.mjs <before.md> <after.md>');
  process.exit(1);
}

function parseTable(md) {
  const rows = {};
  const lines = String(md).split('\n');
  let inTable = false;
  for (const line of lines) {
    if (/^\|\s*필드\s*\|/.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (/^\|---/.test(line)) continue;
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/);
    if (!m) break;
    rows[m[1].trim()] = {
      Correct: +m[2], Wrong: +m[3], Missing: +m[4], FALSE_POSITIVE: +m[5], Skip: +m[6],
    };
  }
  return rows;
}

const before = parseTable(readFileSync(beforePath, 'utf8'));
const after = parseTable(readFileSync(afterPath, 'utf8'));
const fields = Object.keys(before);
if (fields.length === 0) { console.error('등급 표를 찾지 못함'); process.exit(1); }

console.log('## 필드별 등급 전이 (before → after)');
console.log('| 필드 | Correct Δ | Wrong Δ | Missing Δ | FALSE_POSITIVE Δ |');
console.log('|---|---|---|---|---|');
let ok = true;
for (const f of fields) {
  const b = before[f], a = after[f] || {};
  const d = (k) => (a[k] ?? 0) - (b[k] ?? 0);
  console.log(`| ${f} | ${d('Correct') >= 0 ? '+' : ''}${d('Correct')} | ${d('Wrong') >= 0 ? '+' : ''}${d('Wrong')} | ${d('Missing') >= 0 ? '+' : ''}${d('Missing')} | ${d('FALSE_POSITIVE') >= 0 ? '+' : ''}${d('FALSE_POSITIVE')} |`);
  if (f !== 'producer' && (d('Correct') !== 0 || d('Wrong') !== 0 || d('Missing') !== 0 || d('FALSE_POSITIVE') !== 0)) {
    console.log(`  ※ ${f}: producer 외 필드 변화 감지`);
    ok = false;
  }
}
// 게이트: producer Correct 감소 금지, Wrong 증가 금지
const pb = before.producer, pa = after.producer;
const gates = [
  ['producer Correct 감소 없음', (pa.Correct ?? 0) >= (pb.Correct ?? 0)],
  ['producer Wrong 증가 없음', (pa.Wrong ?? 0) <= (pb.Wrong ?? 0)],
  ['producer 외 필드 무변화', ok],
];
console.log('\n## 게이트');
let allOk = true;
for (const [name, pass] of gates) {
  console.log(`- ${pass ? 'PASS' : 'FAIL'}: ${name}`);
  if (!pass) allOk = false;
}
process.exit(allOk ? 0 : 1);
