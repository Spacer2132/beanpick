// Phase 1 공통 입력 생성기. production 코드는 import만 (수정 없음).
// 출력 1: audit/golden/current-values.json — 상품별 current.raw / current.displayed (실제 앱 함수 실행)
// 출력 2: audit/golden/batches.json — 25건 단위 배치 (로스터리 혼합, 결정적 셔플 seed=20260925)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getProductCountryLabel,
  getProductOriginLabel,
  getProductProcessLabel,
  isDecafProduct,
  isGroundCoffeeProduct,
  formatProductDisplayInfo,
} from '../../src/services/coreFeatures.js';
import { getDisplayTastingNotes } from '../../src/services/tastingNotes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit-input/snapshot-products.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit-input/manifest.json'), 'utf8'));
const P = snap.products;
const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
const isSmartstore = (p) => { try { return new URL(p.productUrl).hostname === 'smartstore.naver.com'; } catch { return false; } };
const isBlendText = (p) => /\bblend\b|블[렌랜]드|블[렌랜]딩/i.test([p.productName, p.origin, p.process].filter(Boolean).join(' ').toLowerCase());

function productType(p) {
  const name = String(p.productName || '');
  if (isDecafProduct(p)) return 'decaf';
  if (isBlendText(p)) return 'blend';
  if (/드립\s*백|drip/i.test(name)) return 'dripbag';
  if (/캡슐|capsule/i.test(name)) return 'capsule';
  if (isGroundCoffeeProduct(p)) return 'ground';
  if (/굿즈|머그|텀블러|에코백|드리퍼/.test(name)) return 'goods';
  if (getProductCountryLabel(p) !== '') return 'single';
  return 'other';
}

const gradeOf = (m) => {
  if (m.hasDetailText) return 'A';
  if (m.rawObservationCount > 0 || m.ocrEntryCount > 0 || m.detailImageCount > 0) return 'B';
  return 'C'; // hasEvidenceBeyondSnapshot=false (엣지: 플래그 true이나 카운트 0도 C로 취급)
};

const manifestById = {};
for (const m of manifest.products) manifestById[m.id] = m;

const current = {};
for (const p of P) {
  const m = manifestById[p.id] || {};
  const di = formatProductDisplayInfo(p);
  current[p.id] = {
    id: p.id, roasterName: p.roasterName, productName: p.productName,
    productUrl: p.productUrl, isSoldOut: !!p.isSoldOut, smartstore: isSmartstore(p),
    evidenceGrade: gradeOf(m),
    evidenceFile: m.file || null,
    raw: {
      origin: p.origin ?? null,
      process: p.process ?? null,
      variety: null, // 스냅샷에 variety 필드 없음 (표시는 displayInfo.variety 규칙 매칭)
      roastLevel: p.roastLevel ?? null,
      tastingNotes: Array.isArray(p.tastingNotes) ? p.tastingNotes : [],
      tastingNoteEvidence: p.tastingNoteEvidence ?? null,
      type: null,
      status: p.isSoldOut ? 'soldout' : 'active',
    },
    displayed: {
      originCountry: getProductCountryLabel(p),
      originRegion: 'NOT_DISPLAYED', // 앱에 지역 표시 없음 (표는 국가 라벨만)
      originLabel: getProductOriginLabel(p),
      process: getProductProcessLabel(p),
      variety: di.variety || '',
      region: di.farm || '',
      roastLevel: p.roastLevel ?? null,
      tastingNotes: getDisplayTastingNotes(p),
      type: 'NOT_DISPLAYED', // productType()은 감사 도구 자체 발명 — 앱 표시 없음
      status: p.isSoldOut ? 'soldout' : 'active',
    },
  };
}

// ---- 배치: 로스터리 라운드로빈 혼합 (결정적) ----
let seed = 20260925;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const byR = {};
for (const p of P) { const k = p.roasterName || '(unknown)'; (byR[k] = byR[k] || []).push(p.id); }
// 로스터리 내 셔플
for (const k of Object.keys(byR)) byR[k].sort(() => rnd() - 0.5);
const rosteries = Object.keys(byR).sort((a, b) => byR[b].length - byR[a].length);
const seq = [];
let more = true;
while (more) { more = false; for (const r of rosteries) { if (byR[r].length) { seq.push(byR[r].shift()); more = true; } } }
const batches = [];
for (let i = 0; i < seq.length; i += 25) batches.push(seq.slice(i, i + 25));

const outDir = path.join(ROOT, 'audit/golden');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'current-values.json'), JSON.stringify({ generatedAt: new Date().toISOString(), count: P.length, current }, null, 1));
fs.writeFileSync(path.join(outDir, 'batches.json'), JSON.stringify({ batchSize: 25, seed: 20260925, batches: batches.map((ids, i) => ({ n: i + 1, ids })) }, null, 1));
const grades = { A: 0, B: 0, C: 0 };
Object.values(current).forEach((c) => grades[c.evidenceGrade]++);
console.log(`products=${P.length} batches=${batches.length} grades=${JSON.stringify(grades)}`);
console.log('batch sizes:', batches.map((b) => b.length).join(','));
