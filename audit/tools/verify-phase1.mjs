#!/usr/bin/env node
// Phase 1 자체 검증. 아래를 출력한다:
//  - golden 454건 = 스냅샷 454건, 중복 0, 누락 0
//  - 배치 1~19 A/B 독립성 (필드 불일치율, evidence 문구 동일 비율, golden 바이트 동일 수)
//  - quality-auditor-checks.py 결과
//  - audit:test 결과
//  - 근거 없는 HIGH 0건, current_echo 표시 누락 0건
// audit-input이 없으면 해당 검사는 "audit-input 없으면 건너뜀"으로 출력한다.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GOLDEN_DIR = join(ROOT, 'audit/golden');
const WORK_DIR = join(GOLDEN_DIR, '_work');

const valKey = (v) => JSON.stringify(v ?? null);
const hasValue = (v) => {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  const s = String(v).trim();
  return s !== '' && s !== '확인 필요';
};

console.log('# Phase 1 자체 검증');
console.log();

// 1. golden 454 = 스냅샷 454, 중복 0, 누락 0
{
  const golden = JSON.parse(readFileSync(join(ROOT, 'audit/golden-products.json'), 'utf8')).products;
  const gids = Object.keys(golden);
  const dup = gids.length - new Set(gids).size;
  const cv = JSON.parse(readFileSync(join(GOLDEN_DIR, 'current-values.json'), 'utf8')).current;
  const cvids = Object.keys(cv);
  console.log('## 1. golden ↔ 스냅샷 정합');
  console.log(`- golden: ${gids.length}건, current-values: ${cvids.length}건, 중복 ${dup}건`);
  const missing = gids.filter((id) => !cvids.includes(id));
  const extra = cvids.filter((id) => !gids.includes(id));
  console.log(`- 누락(골든에만 없음): ${missing.length}, 초과: ${extra.length}`);
  const snapDir = join(ROOT, 'audit-input/products');
  if (existsSync(snapDir)) {
    const snapIds = new Set();
    for (const f of readdirSync(snapDir).filter((x) => x.endsWith('.json'))) {
      try {
        const d = JSON.parse(readFileSync(join(snapDir, f), 'utf8'));
        const id = (d.snapshotRecord && d.snapshotRecord.id) || d.id;
        if (id) snapIds.add(id);
      } catch { /* skip */ }
    }
    const sm = gids.filter((id) => !snapIds.has(id));
    console.log(`- audit-input 스냅샷: ${snapIds.size}건, golden 대비 누락 ${sm.length}건`);
  } else {
    console.log('- audit-input 스냅샷 대조: audit-input 없으면 건너뜀');
  }
  console.log();
}

// 2. 배치 1~19 A/B 독립성
{
  console.log('## 2. 배치별 A/B 독립성');
  console.log();
  console.log('| 배치 | 필드 불일치율 | evidence 문구 동일 | golden 바이트 동일 |');
  console.log('|---|---|---|---|');
  for (let n = 1; n <= 19; n++) {
    const nn = String(n).padStart(3, '0');
    const fa = join(WORK_DIR, `batch-${nn}-reviewerA.json`);
    const fb = join(WORK_DIR, `batch-${nn}-reviewerB.json`);
    if (!existsSync(fa) || !existsSync(fb)) {
      console.log(`| ${nn} | reviewer 파일 없음 (구방식) | — | — |`);
      continue;
    }
    const A = JSON.parse(readFileSync(fa, 'utf8'));
    const B = JSON.parse(readFileSync(fb, 'utf8'));
    let mis = 0, tot = 0, evSame = 0, evTot = 0, byteSame = 0, pids = 0;
    for (const pid of Object.keys(A)) {
      if (!B[pid]) continue;
      pids++;
      const ga = A[pid].golden || A[pid];
      const gb = B[pid].golden || B[pid];
      if (valKey(ga) === valKey(gb)) byteSame++;
      const fields = new Set([...Object.keys(ga), ...Object.keys(gb)]);
      for (const f of fields) {
        const va = ga[f], vb = gb[f];
        const vaV = va && typeof va === 'object' ? va.value : va;
        const vbV = vb && typeof vb === 'object' ? vb.value : vb;
        if (f !== 'status') { // 중간 보고의 불일치율 정의와 동일하게 status 제외
          tot++;
          if (valKey(vaV) !== valKey(vbV)) mis++;
        }
        const ea = va && typeof va === 'object' ? va.evidence : null;
        const eb = vb && typeof vb === 'object' ? vb.evidence : null;
        if (ea || eb) {
          evTot++;
          if (String(ea || '').trim() === String(eb || '').trim()) evSame++;
        }
      }
    }
    console.log(`| ${nn} | ${(mis / tot * 100).toFixed(1)}% (${mis}/${tot}) | ${(evSame / evTot * 100).toFixed(0)}% (${evSame}/${evTot}) | ${byteSame}/${pids} |`);
  }
  console.log();
}

// 3. quality-auditor-checks.py
{
  console.log('## 3. quality-auditor-checks.py');
  try {
    const out = execFileSync('python3', [join(ROOT, 'audit/tools/quality-auditor-checks.py')],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const last = out.trim().split('\n').pop();
    console.log(`- 결과: PASS (${last})`);
  } catch (e) {
    console.log(`- 결과: FAIL (exit ${e.status})`);
    console.log(String(e.stdout || '').trim().split('\n').slice(-5).join('\n'));
  }
  console.log();
}

// 4. audit:test
{
  console.log('## 4. npm run audit:test');
  try {
    const out = execFileSync('node', [join(ROOT, 'audit/tools/test-audit-data.mjs')],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const pass = (out.match(/PASS/g) || []).length;
    console.log(`- 결과: PASS (${pass}개 검증 통과)`);
  } catch (e) {
    console.log(`- 결과: FAIL (exit ${e.status})`);
    console.log(String(e.stdout || '').trim().split('\n').filter((l) => l.startsWith('FAIL')).join('\n'));
  }
  console.log();
}

// 5. 근거 없는 HIGH / current_echo 표시 누락
{
  console.log('## 5. golden 무결성');
  const cv = JSON.parse(readFileSync(join(GOLDEN_DIR, 'current-values.json'), 'utf8')).current;
  const DM = { originCountry: 'originCountry', process: 'process', producer: 'region', roast: 'roastLevel', tastingNotes: 'tastingNotes', variety: 'variety' };
  let highNoEv = 0, echoMissing = 0;
  const echoMissingIds = [];
  for (let n = 1; n <= 19; n++) {
    const nn = String(n).padStart(3, '0');
    const b = JSON.parse(readFileSync(join(GOLDEN_DIR, `batch-${nn}.json`), 'utf8'));
    for (const p of b.products) {
      for (const [f, g] of Object.entries(p.golden)) {
        if (!g || typeof g !== 'object') continue;
        if (g.confidence === 'HIGH' && !g.evidence) highNoEv++;
        if (g.evidenceKind === 'current_echo' && hasValue(g.value) && DM[f]) {
          const dv = cv[p.id].displayed[DM[f]];
          if (!hasValue(dv)) { echoMissing++; echoMissingIds.push(`${p.id} ${f}`); }
        }
      }
    }
  }
  console.log(`- 근거 없는 HIGH: ${highNoEv}건`);
  console.log(`- current_echo 표시 누락 (golden 값 있음 + 표시 비어 있음): ${echoMissing}건`);
  for (const id of echoMissingIds) console.log(`  - ${id}`);
  console.log();
}
