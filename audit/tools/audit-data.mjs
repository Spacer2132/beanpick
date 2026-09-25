#!/usr/bin/env node
// BeanPick 데이터 회귀 감사 도구.
// 사용: node audit/tools/audit-data.mjs [products.json] [--before old-products.json] [--renormalize-golden | --write-golden]
//   products.json 기본값: docs/products.json
// - 수집기를 실행하지 않는다. 앱 표시 함수(coreFeatures/tastingNotes) import만 사용.
// - golden(audit/golden-products.json)과 현재 표시값을 비교해 필드별 Correct/Wrong/Missing 출력.
// - --before: 이전 products.json과 비교해 복구된 값 / 사라진 값 / 맞다가 틀려진 값 / 바뀐 상품 목록 출력.
//   회귀(사라진 값 + 맞다가 틀려진 값)가 1건 이상이면 exit 1.
// - --renormalize-golden: 정규화 사전을 의도적으로 바꾼 뒤, golden comparable을 현재 정규화기로 다시 계산해
//   변경분(추가/소실)을 보고한다. 소실이 1건 이상이면 exit 1. --write-golden은 소실 0일 때만 golden에 저장한다.
//   소실이 "초콜릿→다크초콜릿"처럼 더 구체적인 노트로 바뀐 것뿐임을 사람이 확인했으면 --accept-lost로 수용한다.
//   기본 실행은 golden에 고정된 comparable로 비교한다.
// - golden에 없는 ID → NEW, golden에만 있는 ID → GONE (회귀 아님).
// - evidenceKind=current_echo golden 필드는 Correct/Wrong/Missing 집계에서 제외하고,
//   "사라짐" 감지(이전에 표시되던 값이 사라짐)에만 사용한다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getProductCountryLabel,
  getProductProcessLabel,
  formatProductDisplayInfo,
} from '../../src/services/coreFeatures.js';
import { getDisplayTastingNotes, normalizeTastingNotes } from '../../src/services/tastingNotes.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GOLDEN_PATH = join(ROOT, 'audit/golden-products.json');

const args = process.argv.slice(2);
let productsPath = join(ROOT, 'docs/products.json');
let beforePath = null;
let renormalize = false;
let writeGolden = false;
let acceptLost = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--before') beforePath = resolve(args[++i]);
  else if (args[i] === '--renormalize-golden') renormalize = true;
  else if (args[i] === '--write-golden') { renormalize = true; writeGolden = true; }
  else if (args[i] === '--accept-lost') acceptLost = true;
  else if (!args[i].startsWith('--')) productsPath = resolve(args[i]);
}

const FIELDS = ['originCountry', 'process', 'producer', 'roast', 'tastingNotes', 'variety'];
const normKey = (s) => String(s ?? '').replace(/[\s·・,()/|-]/g, '').toLowerCase();
const isBlank = (v) => v === undefined || v === null ||
  (Array.isArray(v) ? v.length === 0 : String(v).trim() === '' || String(v).trim() === '확인 필요');

function loadProducts(fp) {
  const raw = JSON.parse(readFileSync(fp, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.products;
  const map = {};
  for (const p of list) map[p.id] = p;
  return map;
}

// 앱 표시값 계산 (audit/tools/extract-current.mjs와 동일한 함수 사용)
function displayedOf(p) {
  const di = formatProductDisplayInfo(p);
  return {
    originCountry: getProductCountryLabel(p) || '',
    process: getProductProcessLabel(p) || '',
    producer: di.farm || '',
    roast: p.roastLevel ?? '',
    tastingNotes: getDisplayTastingNotes(p) || [],
    variety: di.variety || '',
  };
}

// producer 비교 (§7 근사): 정규화 키 동등·부분문자열·핵심단어 포함
function producerMatch(golden, farm) {
  const g = normKey(golden), f = normKey(farm);
  if (!g || !f) return false;
  if (g === f || f.includes(g) || g.includes(f)) return true;
  const STOP = new Set(['coffee', 'farm', 'finca', 'estate', 'cooperative', 'co-op']);
  const words = String(golden).toLowerCase().split(/[^a-z0-9가-힣]+/)
    .filter((w) => w.length >= 5 && !STOP.has(w));
  return words.some((w) => f.includes(normKey(w)));
}

function comparableOf(goldenRec, goldenVal = goldenRec.value) {
  const raw = goldenRec.raw ?? goldenVal;
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  return normalizeTastingNotes(list, { limit: Infinity, explicitEvidence: true });
}

// 현재 정규화기로 golden comparable을 다시 계산해 고정값과 비교한다.
// 새로 표현 가능해진 노트(added)는 사전 확장의 정상 결과이고,
// 고정값에 있던 노트가 사라지면(lost) 정규화기가 원문 노트를 버리게 된 것이므로 회귀다.
function renormalizeGolden(golden) {
  const changes = [];
  for (const [id, rec] of Object.entries(golden)) {
    const tn = rec.golden?.tastingNotes;
    if (!tn || !Array.isArray(tn.comparable)) continue;
    const next = comparableOf(tn);
    const prev = new Set(tn.comparable), now = new Set(next);
    const added = next.filter((x) => !prev.has(x));
    const lost = tn.comparable.filter((x) => !now.has(x));
    if (added.length || lost.length) changes.push({ id, added, lost, next });
  }
  return changes;
}

function fieldsEqual(field, goldenVal, dispVal, goldenRec) {
  switch (field) {
    case 'tastingNotes': {
      // golden에 고정 저장된 comparable과 비교한다. 매번 현재 정규화기로 다시 계산하면
      // 정규화기가 노트를 버리는 회귀가 golden 쪽에서도 똑같이 사라져 잡히지 않는다.
      // 사전을 의도적으로 바꿨을 때는 --renormalize-golden 으로 변경분을 검토하고
      // --write-golden 으로 갱신한다.
      const comp = goldenRec.comparable ?? comparableOf(goldenRec, goldenVal);
      const c = new Set(comp), d = new Set(Array.isArray(dispVal) ? dispVal : []);
      if (c.size !== d.size) return false;
      for (const x of c) if (!d.has(x)) return false;
      return true;
    }
    case 'producer':
      return producerMatch(goldenVal, dispVal);
    default:
      return normKey(goldenVal) !== '' && normKey(goldenVal) === normKey(dispVal);
  }
}

// 상품 1건의 필드별 상태: Correct | Wrong | Missing | FALSE_POSITIVE | Skip(사유)
// - golden 값 없음(SOURCE_MISSING) + 표시 없음 = Correct (true negative)
// - golden 값 없음 + 표시 있음 = FALSE_POSITIVE (별도 집계)
// - roast의 "확인 필요"는 표시 없음으로 취급
function gradeProduct(golden, disp) {
  const out = {};
  for (const f of FIELDS) {
    const g = golden[f] || {};
    const val = g.value;
    const conf = g.confidence;
    if (g.mappingStatus === 'UNMAPPED_LABEL') { out[f] = 'Skip:UNMAPPED_LABEL'; continue; }
    if (g.evidenceKind === 'current_echo') { out[f] = 'Skip:current_echo'; continue; }
    if (conf === 'UNKNOWN' || conf === 'LOW') { out[f] = 'Skip:UNKNOWN'; continue; }
    const gv = isBlank(val);
    const dv = isBlank(disp[f]);
    if (gv) {
      out[f] = dv ? 'Correct' : 'FALSE_POSITIVE'; // true negative vs false positive
    } else if (dv) {
      out[f] = 'Missing';
    } else {
      out[f] = fieldsEqual(f, val, disp[f], g) ? 'Correct' : 'Wrong';
    }
  }
  return out;
}

function main() {
  if (!existsSync(GOLDEN_PATH)) { console.error('golden 없음: ' + GOLDEN_PATH); process.exit(2); }
  const goldenFile = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
  const golden = goldenFile.products;
  const now = loadProducts(productsPath);

  let renorm = null;
  if (renormalize) {
    renorm = renormalizeGolden(golden);
    for (const c of renorm) golden[c.id].golden.tastingNotes.comparable = c.next;
  }

  const stats = {};
  for (const f of FIELDS) stats[f] = { Correct: 0, Wrong: 0, Missing: 0, FALSE_POSITIVE: 0, Skip: 0 };
  const newIds = [], goneIds = [];
  const grades = {}; // id -> {field: status}

  for (const [id, p] of Object.entries(now)) {
    if (!golden[id]) { newIds.push(id); continue; }
    const disp = displayedOf(p);
    const gr = gradeProduct(golden[id].golden, disp);
    grades[id] = { disp, grade: gr };
    for (const f of FIELDS) {
      const s = gr[f].split(':')[0];
      stats[f][s]++;
    }
  }
  for (const id of Object.keys(golden)) if (!now[id]) goneIds.push(id);

  const L = [];
  L.push(`# audit-data 회귀 보고서`);
  L.push(`- 대상: ${productsPath}`);
  L.push(`- 상품 수: ${Object.keys(now).length} (golden 커버 ${Object.keys(grades).length}, NEW ${newIds.length}, GONE ${goneIds.length})`);
  L.push('');
  L.push('## 필드별 Correct/Wrong/Missing (golden UNKNOWN·UNMAPPED_LABEL·current_echo 제외)');
  L.push('');
  L.push('| 필드 | Correct | Wrong | Missing | FALSE_POSITIVE | Skip |');
  L.push('|---|---|---|---|---|---|');
  for (const f of FIELDS) {
    const s = stats[f];
    L.push(`| ${f} | ${s.Correct} | ${s.Wrong} | ${s.Missing} | ${s.FALSE_POSITIVE} | ${s.Skip} |`);
  }

  let exitCode = 0;
  if (renorm) {
    const lost = renorm.filter((c) => c.lost.length);
    const added = renorm.filter((c) => c.added.length);
    L.push('');
    L.push('## golden comparable 재정규화 (--renormalize-golden)');
    L.push(`- 변경 상품: ${renorm.length} (노트 추가 ${added.length}, 노트 소실 ${lost.length})`);
    L.push('- 추가는 사전 확장의 정상 결과다. 소실은 정규화기가 원문 노트를 버리게 된 것이므로 회귀로 본다.');
    if (lost.length) {
      L.push('', `### golden 노트 소실 (${lost.length}) — 회귀`);
      for (const c of lost) L.push(`- ${c.id}: -${c.lost.join(', ')}${c.added.length ? ` / +${c.added.join(', ')}` : ''}`);
      if (!acceptLost) exitCode = 1;
      else L.push('', `- --accept-lost: 소실 ${lost.length}건을 사람이 검토해 수용함 (회귀로 세지 않음)`);
    }
    if (added.length) {
      L.push('', `### golden 노트 추가 (${added.length})`);
      for (const c of added.filter((x) => !x.lost.length)) L.push(`- ${c.id}: +${c.added.join(', ')}`);
    }
    if (writeGolden) {
      if (lost.length && !acceptLost) {
        L.push('', '- --write-golden 거부: 노트 소실이 있어 golden을 갱신하지 않았다. 검토 후 --accept-lost를 함께 주면 갱신한다.');
      } else {
        writeFileSync(GOLDEN_PATH, JSON.stringify(goldenFile, null, 1)); // 원본과 같은 1칸 들여쓰기·끝 줄바꿈 없음
        L.push('', `- --write-golden: golden comparable ${renorm.length}건 갱신 완료 (${GOLDEN_PATH})`);
      }
    }
  }
  if (beforePath) {
    const before = loadProducts(beforePath);
    const recovered = [], disappeared = [], newlyWrong = [], newFP = [], fixedFP = [], changed = new Set();
    for (const [id, cur] of Object.entries(grades)) {
      const bp = before[id];
      if (!bp) continue;
      const bDisp = displayedOf(bp);
      const bGr = gradeProduct(golden[id].golden, bDisp);
      for (const f of FIELDS) {
        const b = bGr[f].split(':')[0], n = cur.grade[f].split(':')[0];
        const g = golden[id].golden[f] || {};
        if (g.evidenceKind === 'current_echo') {
          // A2: 정확도 집계에서는 제외하되, --before 비교에는 포함.
          // before에 값이 있었는데 after에 비면 "사라진 값"(회귀).
          if (!isBlank(bDisp[f]) && isBlank(cur.disp[f])) {
            disappeared.push(`${id} ${f} (current_echo 사라짐)`);
            changed.add(id);
          } else if (isBlank(bDisp[f]) && !isBlank(cur.disp[f])) {
            recovered.push(`${id} ${f} (current_echo 복구)`);
            changed.add(id);
          }
          continue;
        }
        if (b === n) continue;
        changed.add(id);
        if ((b === 'Wrong' || b === 'Missing' || b === 'FALSE_POSITIVE') && n === 'Correct') recovered.push(`${id} ${f}`);
        else if (b === 'FALSE_POSITIVE' && n !== 'FALSE_POSITIVE') fixedFP.push(`${id} ${f} → ${n}`);
        else if (b === 'Correct' && n === 'Missing') disappeared.push(`${id} ${f}`);
        else if (b === 'Correct' && n === 'Wrong') newlyWrong.push(`${id} ${f}`);
        else if (n === 'FALSE_POSITIVE' && b !== 'FALSE_POSITIVE') newFP.push(`${id} ${f} (${b} → FALSE_POSITIVE)`);
        else recovered.push(`${id} ${f} (${b} → ${n})`);
      }
    }
    L.push('');
    L.push(`## 회귀 분석 (--before ${beforePath})`);
    L.push(`- 복구된 값: ${recovered.length}`);
    L.push(`- 사라진 값: ${disappeared.length}`);
    L.push(`- 맞다가 틀려진 값: ${newlyWrong.length}`);
    L.push(`- 새로 생긴 거짓양성: ${newFP.length}`);
    L.push(`- 해소된 거짓양성: ${fixedFP.length}`);
    L.push(`- 바뀐 상품: ${changed.size}건`);
    for (const [title, arr] of [['복구된 값', recovered], ['사라진 값', disappeared], ['맞다가 틀려진 값', newlyWrong], ['새로 생긴 거짓양성', newFP], ['해소된 거짓양성', fixedFP]]) {
      if (arr.length) { L.push('', `### ${title} (${arr.length})`); for (const x of arr) L.push(`- ${x}`); }
    }
    if (changed.size) { L.push('', `### 바뀐 상품 (${changed.size})`); for (const id of [...changed].sort()) L.push(`- ${id}`); }
    const regressions = disappeared.length + newlyWrong.length + newFP.length;
    L.push('', `회귀 ${regressions}건 → exit ${regressions > 0 ? 1 : 0}`);
    if (regressions > 0) exitCode = 1;
  }
  if (newIds.length) { L.push('', `## NEW (golden에 없음, 회귀 아님, ${newIds.length})`); for (const id of newIds.slice(0, 20)) L.push(`- ${id}`); if (newIds.length > 20) L.push(`- ... 외 ${newIds.length - 20}건`); }
  if (goneIds.length) { L.push('', `## GONE (products.json에 없음, 회귀 아님, ${goneIds.length})`); for (const id of goneIds.slice(0, 20)) L.push(`- ${id}`); if (goneIds.length > 20) L.push(`- ... 외 ${goneIds.length - 20}건`); }

  console.log(L.join('\n'));
  process.exit(exitCode);
}

import { pathToFileURL } from 'node:url';
const invokedAsScript = (() => {
  try {
    return process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
  } catch { return false; }
})();
if (invokedAsScript) main();

// 테스트(audit/tools/test-audit-data.mjs)에서 사용
export { gradeProduct, displayedOf, isBlank, fieldsEqual, renormalizeGolden, FIELDS };
