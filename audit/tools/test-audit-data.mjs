#!/usr/bin/env node
// audit-data.mjs 자체 테스트. 5개 검증을 모두 통과해야 exit 0, 하나라도 실패하면 exit 1.
// 사용: npm run audit:test
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeProduct, displayedOf } from './audit-data.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TMP = '/tmp/audit-data-test';
const AUDIT_DATA = join(ROOT, 'audit/tools/audit-data.mjs');
const GOLDEN = JSON.parse(readFileSync(join(ROOT, 'audit/golden-products.json'), 'utf8')).products;

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`PASS ${name}`);
  else { console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`); failures++; }
}

function loadProducts() {
  const raw = JSON.parse(readFileSync(join(ROOT, 'docs/products.json'), 'utf8'));
  return Array.isArray(raw) ? raw : raw.products;
}
function saveProducts(list, name) {
  mkdirSync(TMP, { recursive: true });
  const fp = join(TMP, name);
  writeFileSync(fp, JSON.stringify({ products: list }));
  return fp;
}
function runAudit(file, before) {
  const args = [AUDIT_DATA, file];
  if (before) args.push('--before', before);
  try {
    const out = execFileSync('node', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { exit: 0, out };
  } catch (e) {
    return { exit: e.status ?? 1, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}
function sectionIds(out, title) {
  const ids = new Set();
  const lines = out.split('\n');
  let on = false;
  for (const ln of lines) {
    if (ln.startsWith('### ')) on = ln.includes(title);
    else if (on && ln.startsWith('- ')) ids.add(ln.slice(2).split(' ')[0]);
    else if (on && ln.trim() === '') on = false;
  }
  return ids;
}
const clone = (o) => JSON.parse(JSON.stringify(o));

const products = loadProducts();
const byId = {};
for (const p of products) byId[p.id] = p;
const orig = saveProducts(products, 'orig.json');

// (1) 같은 파일 전후 비교 → exit 0
{
  const r = runAudit(orig, orig);
  check('(1) 동일 파일 전후 비교 exit 0', r.exit === 0, `exit=${r.exit}`);
}

// 후보 수집: golden 커버 + 등급 계산
const graded = [];
for (const p of products) {
  const g = GOLDEN[p.id];
  if (!g) continue;
  graded.push({ p, g: g.golden, disp: displayedOf(p), grade: gradeProduct(g.golden, displayedOf(p)) });
}

// (2) 노트 20건 삭제 + 산지 10건 변조 → exit 1, 전부 감지
{
  const noteCands = graded.filter((x) => x.grade.tastingNotes === 'Correct' && x.disp.tastingNotes.length > 0);
  const originCands = graded.filter((x) => {
    if (x.grade.originCountry !== 'Correct' || !x.disp.originCountry) return false;
    const gv = String(x.g.originCountry.value);
    return gv && x.p.productName.includes(gv) && gv !== '콜롬비아';
  });
  check('(2) 후보 확보 (노트 20+, 산지 10+)',
    noteCands.length >= 20 && originCands.length >= 10,
    `notes=${noteCands.length} origin=${originCands.length}`);
  const mod = clone(products);
  const modById = {};
  for (const p of mod) modById[p.id] = p;
  const noteIds = noteCands.slice(0, 20).map((x) => x.p.id);
  for (const id of noteIds) { modById[id].tastingNoteEvidence = []; modById[id].tastingNotes = []; }
  const originIds = originCands.slice(0, 10).map((x) => x.p.id);
  for (const id of originIds) {
    const gv = String(GOLDEN[id].golden.originCountry.value);
    modById[id].productName = modById[id].productName.replace(gv, '콜롬비아');
    modById[id].origin = '콜롬비아';
  }
  const modFile = saveProducts(mod, 'mod.json');
  const r = runAudit(modFile, orig);
  const disappeared = sectionIds(r.out, '사라진 값');
  const newlyWrong = sectionIds(r.out, '맞다가 틀려진 값');
  const allNotes = noteIds.every((id) => disappeared.has(id));
  const allOrigin = originIds.every((id) => newlyWrong.has(id));
  check('(2) exit 1', r.exit === 1, `exit=${r.exit}`);
  check('(2) 노트 삭제 20건 전부 사라진 값 감지', allNotes,
    `감지 ${noteIds.filter((id) => disappeared.has(id)).length}/20`);
  check('(2) 산지 변조 10건 전부 맞다가 틀려진 값 감지', allOrigin,
    `감지 ${originIds.filter((id) => newlyWrong.has(id)).length}/10`);
}

// (3)(4) golden SOURCE_MISSING + 표시 없음/있음 (tastingNotes)
{
  const cand = graded.find((x) => {
    const g = x.g.tastingNotes;
    return g && g.confidence === 'SOURCE_MISSING' && x.grade.tastingNotes === 'Correct';
  });
  check('(3)(4) SOURCE_MISSING + 표시 없음 후보 존재', !!cand);
  if (cand) {
    check('(3) SOURCE_MISSING + 표시 없음 → Correct', cand.grade.tastingNotes === 'Correct');
    const p2 = clone(cand.p);
    p2.tastingNotes = ['블루베리'];
    const g2 = gradeProduct(cand.g, displayedOf(p2));
    check('(4) SOURCE_MISSING + 표시 있음 → FALSE_POSITIVE', g2.tastingNotes === 'FALSE_POSITIVE',
      `got ${g2.tastingNotes}`);
  }
}

// (5) current_echo 상품 5건 노트 삭제 → 5건 모두 사라진 값, exit 1
{
  const echoCands = graded.filter((x) => {
    const g = x.g.tastingNotes;
    return g && g.evidenceKind === 'current_echo' && x.disp.tastingNotes.length > 0;
  });
  check('(5) current_echo 노트 후보 5+ 존재', echoCands.length >= 5, `found=${echoCands.length}`);
  if (echoCands.length >= 5) {
    const mod = clone(products);
    const modById = {};
    for (const p of mod) modById[p.id] = p;
    const echoIds = echoCands.slice(0, 5).map((x) => x.p.id);
    for (const id of echoIds) { modById[id].tastingNoteEvidence = []; modById[id].tastingNotes = []; }
    const modFile = saveProducts(mod, 'echo-mod.json');
    const r = runAudit(modFile, orig);
    const disappeared = sectionIds(r.out, '사라진 값');
    const allEcho = echoIds.every((id) => disappeared.has(id));
    check('(5) exit 1', r.exit === 1, `exit=${r.exit}`);
    check('(5) 5건 모두 사라진 값 감지', allEcho,
      `감지 ${echoIds.filter((id) => disappeared.has(id)).length}/5`);
  }
}

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
