import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getProductCountryLabel,
  getProductOriginLabel,
  getProductProcessLabel,
  isDecafProduct,
  isGroundCoffeeProduct,
} from '../../src/services/coreFeatures.js';
import { getDisplayTastingNotes } from '../../src/services/tastingNotes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit-input/snapshot-products.json'), 'utf8'));
const P = snap.products;

// ---------- helpers ----------
const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
const isSmartstore = (p) => { try { return new URL(p.productUrl).hostname === 'smartstore.naver.com'; } catch { return false; } };
// raw origin: blank OR equals roasterName (collector fixed value = effectively undetermined)
const rawOriginMissing = (p) => isBlank(p.origin) || p.origin === p.roasterName;
const isBlendText = (p) => /\bblend\b|블[렌랜]드|블[렌랜]딩/i.test([p.productName, p.variety, p.origin, p.process].filter(Boolean).join(' ').toLowerCase());

function productType(p) {
  const name = String(p.productName || '');
  if (isDecafProduct(p)) return 'decaf';
  if (isBlendText(p)) return 'blend';
  if (/드립\s*백|drip/i.test(name)) return 'dripbag';
  if (/캡슐|capsule/i.test(name)) return 'capsule';
  if (isGroundCoffeeProduct(p)) return 'ground';
  if (/굿즈|머그|텀블러|에코백|드리퍼/i.test(name)) return 'goods';
  if (getProductCountryLabel(p) !== '') return 'single';
  return 'other';
}

// per-product displayed values (computed with real functions)
const rows = P.map((p) => {
  const country = getProductCountryLabel(p);
  const processL = getProductProcessLabel(p);
  const notes = getDisplayTastingNotes(p);
  const type = productType(p);
  return {
    id: p.id, roasterName: p.roasterName, isSoldOut: !!p.isSoldOut, smartstore: isSmartstore(p),
    type,
    raw: {
      originMissing: rawOriginMissing(p),
      processMissing: isBlank(p.process),
      varietyMissing: isBlank(p.variety),
      roastMissing: isBlank(p.roastLevel) || p.roastLevel === '확인 필요',
      notesMissing: !Array.isArray(p.tastingNotes) || p.tastingNotes.length === 0,
    },
    displayed: {
      originMissing: country === '', // pure country label; blend fallback lives in getProductOriginLabel
      processMissing: processL === '',
      varietyMissing: isBlank(p.variety), // app shows product.variety via displayInfo.variety (rule-matched or fallback)
      roastMissing: isBlank(p.roastLevel) || p.roastLevel === '확인 필요', // app displays roastLevel as-is
      notesMissing: notes.length === 0,
    },
    roastLevel: p.roastLevel, notesCount: notes.length,
  };
});

const active = rows.filter(r => !r.isSoldOut);
const count = (arr) => arr.length;

const byRoastery = {};
rows.forEach((r) => {
  const k = r.roasterName || '(unknown)';
  byRoastery[k] = byRoastery[k] || { roastery: k, total: 0, active: 0, smartstore: 0, official: 0,
    missingOriginRaw: 0, missingOriginDisp: 0, missingProcessRaw: 0, missingProcessDisp: 0,
    missingVarietyRaw: 0, missingRoast: 0, missingNotesRaw: 0, missingNotesDisp: 0,
    missingNotesDispActive: 0, types: {}, soldOut: 0 };
  const b = byRoastery[k];
  b.total++; if (!r.isSoldOut) b.active++; else b.soldOut++;
  r.smartstore ? b.smartstore++ : b.official++;
  b.types[r.type] = (b.types[r.type] || 0) + 1;
  if (r.raw.originMissing) b.missingOriginRaw++;
  if (r.displayed.originMissing) b.missingOriginDisp++;
  if (r.raw.processMissing) b.missingProcessRaw++;
  if (r.displayed.processMissing) b.missingProcessDisp++;
  if (r.raw.varietyMissing) b.missingVarietyRaw++;
  if (r.raw.roastMissing) b.missingRoast++;
  if (r.raw.notesMissing) b.missingNotesRaw++;
  if (r.displayed.notesMissing) b.missingNotesDisp++;
  if (r.displayed.notesMissing && !r.isSoldOut) b.missingNotesDispActive++;
});

const total = rows.length;
const typeCounts = {};
rows.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
const activeTypeCounts = {};
active.forEach(r => { activeTypeCounts[r.type] = (activeTypeCounts[r.type] || 0) + 1; });

const missingOriginDisp = rows.filter(r => r.displayed.originMissing);
const missingOriginDispNoBlend = missingOriginDisp.filter(r => r.type !== 'blend');

const notesMissingDispActive = active.filter(r => r.displayed.notesMissing);
const notesDist = {};
notesMissingDispActive.forEach(r => { notesDist[r.roasterName] = (notesDist[r.roasterName] || 0) + 1; });

const metrics = {
  snapshot: { publishedAt: snap.publishedAt, count: snap.count, productsLength: total, quality: snap.quality },
  totals: {
    total,
    soldOut: rows.filter(r => r.isSoldOut).length,
    active: active.length,
    smartstore: rows.filter(r => r.smartstore).length,
    official: rows.filter(r => !r.smartstore).length,
    roasteries: Object.keys(byRoastery).length,
    decaf: typeCounts.decaf || 0,
  },
  productTypes: typeCounts,
  productTypesActive: activeTypeCounts,
  fieldsRaw: {
    originMissing: count(rows.filter(r => r.raw.originMissing)),
    originBlankOnly: count(rows.filter(r => isBlank(r.origin))),
    originEqualsRoaster: count(rows.filter(r => !isBlank(r.origin) && r.origin === r.roasterName)),
    processMissing: count(rows.filter(r => r.raw.processMissing)),
    varietyMissing: count(rows.filter(r => r.raw.varietyMissing)),
    roastMissing_confirmNeeded: count(rows.filter(r => r.raw.roastMissing)),
    roastLevelValues: {},
    notesMissing: count(rows.filter(r => r.raw.notesMissing)),
  },
  fieldsDisplayed: {
    originMissing: missingOriginDisp.length,
    originMissingExclBlend: missingOriginDispNoBlend.length,
    processMissing: count(rows.filter(r => r.displayed.processMissing)),
    varietyMissing: count(rows.filter(r => r.displayed.varietyMissing)),
    roastMissing: count(rows.filter(r => r.displayed.roastMissing)),
    notesMissing: count(rows.filter(r => r.displayed.notesMissing)),
    notesMissingActive: notesMissingDispActive.length,
    notesMissingActiveByRoastery: notesDist,
    notesMissingRawActive: count(active.filter(r => r.raw.notesMissing)),
  },
  roasteries: Object.values(byRoastery).sort((a, b) => b.total - a.total),
  missingOriginDispByRoastery: (() => { const m = {}; missingOriginDisp.forEach(r => { m[r.roasterName] = (m[r.roasterName] || 0) + 1; }); return m; })(),
};
rows.forEach(r => { const k = String(r.roastLevel); metrics.fieldsRaw.roastLevelValues[k] = (metrics.fieldsRaw.roastLevelValues[k] || 0) + 1; });

fs.mkdirSync(path.join(ROOT, 'audit'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'audit/baseline-metrics.json'), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify({
  total, soldOut: metrics.totals.soldOut, active: metrics.totals.active,
  smartstore: metrics.totals.smartstore, official: metrics.totals.official,
  roasteries: metrics.totals.roasteries, types: typeCounts,
  rawOriginMissing: metrics.fieldsRaw.originMissing,
  dispOriginMissing: metrics.fieldsDisplayed.originMissing,
  dispOriginMissingExclBlend: metrics.fieldsDisplayed.originMissingExclBlend,
  rawProcessMissing: metrics.fieldsRaw.processMissing,
  dispProcessMissing: metrics.fieldsDisplayed.processMissing,
  rawVarietyMissing: metrics.fieldsRaw.varietyMissing,
  roastMissing: metrics.fieldsDisplayed.roastMissing,
  roastLevelValues: metrics.fieldsRaw.roastLevelValues,
  rawNotesMissing: metrics.fieldsRaw.notesMissing,
  dispNotesMissing: metrics.fieldsDisplayed.notesMissing,
  dispNotesMissingActive: metrics.fieldsDisplayed.notesMissingActive,
  notesDist: metrics.fieldsDisplayed.notesMissingActiveByRoastery,
}, null, 2));
