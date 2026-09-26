#!/usr/bin/env node
// 로스팅 관련 표현 corpus 수집 (FIX-3 §2)
// 사용: node audit/tools/collect-roast-vocabulary.mjs
// 출력: audit/fixes/roast-vocabulary.json
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const AUDIT_INPUT = '/home/hatch/workspace/audit-input-work/audit-input';
const OUT = join(ROOT, 'audit/fixes/roast-vocabulary.json');

// 조사 대상 표현 (정규식, 대소문자 무시)
const PATTERNS = [
  // 한국어 배전도
  '약배전', '중약배전', '중배전', '중강배전', '강배전',
  // 한국어 로스트
  '라이트\\s*로스트', '미디엄\\s*로스트', '미디엄\\s*다크\\s*로스트', '다크\\s*로스트',
  '라이트', '미디엄', '다크',
  // 영어
  'light\\s*roast', 'medium\\s*roast', 'medium-dark\\s*roast', 'medium\\s*dark\\s*roast', 'dark\\s*roast',
  '\\blight\\b', '\\bmedium\\b', 'medium[\\s-]*light', 'medium[\\s-]*dark', '\\bdark\\b',
  // 전통 로스트명
  '시나몬\\s*로스트', '시나몬', '시티\\s*로스트', '풀\\s*시티', '프렌치\\s*로스트', '프렌치',
  '이탈리안\\s*로스트', '이탈리안', '비엔나',
  // 용도별
  '필터\\s*로스트', '에스프레소\\s*로스트', '더치\\s*로스트', '모카포트',
  // 기타
  'well[\\s-]*done', '웰던',
  '볶음도', '배전도', '볶음',
  // 오탐 후보 (반드시 조사)
  '다크초콜릿', '다크\\s*초콜릿', '다크체리', '다크\\s*체리', '라이트\\s*바디',
  '다크우드', '필디카프',
  '로스팅\\s*날짜', '로스팅\\s*후', '로스팅일', '로스팅\\s*일자',
];

const RX = PATTERNS.map((p) => ({ src: p, rx: new RegExp(p, 'gi') }));

function* textSources() {
  // audit-input
  const dir = join(AUDIT_INPUT, 'products');
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    let d;
    try { d = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    const sr = d.snapshotRecord || {};
    const ev = d.evidence || {};
    yield { id: sr.id || f, field: 'productName', text: sr.productName || '' };
    const dc = ev.detailCache;
    if (typeof dc === 'string') yield { id: sr.id || f, field: 'detailCache', text: dc };
    else if (dc && typeof dc === 'object') {
      for (const [k, v] of Object.entries(dc)) {
        if (typeof v === 'string' && v.length > 0) yield { id: sr.id || f, field: `detailCache.${k}`, text: v };
      }
    }
    const ro = ev.rawObservations;
    if (typeof ro === 'string') yield { id: sr.id || f, field: 'rawObservations', text: ro };
    else if (Array.isArray(ro)) {
      for (const r of ro) {
        if (typeof r === 'string') yield { id: sr.id || f, field: 'rawObservations', text: r };
        else if (r && typeof r.text === 'string') yield { id: sr.id || f, field: 'rawObservations', text: r.text };
      }
    }
    const po = sr.priceOptions;
    if (Array.isArray(po)) {
      for (const o of po) {
        const t = [o.priceLabel, o.weightLabel, o.name, o.optionName, o.title].filter(Boolean).join(' | ');
        if (t) yield { id: sr.id || f, field: 'priceOptions', text: t };
      }
    }
  }
  // docs/products.json
  const docs = JSON.parse(readFileSync(join(ROOT, 'docs/products.json'), 'utf8'));
  for (const p of docs.products || []) {
    yield { id: p.id, field: 'docs.productName', text: p.productName || '' };
    for (const k of ['detailText', 'description', 'detail', 'optionsText']) {
      if (p[k]) yield { id: p.id, field: `docs.${k}`, text: String(p[k]) };
    }
    if (Array.isArray(p.priceOptions)) {
      const t = p.priceOptions.map((o) => [o.priceLabel, o.weightLabel, o.name, o.optionName].filter(Boolean).join(' ')).join(' | ');
      if (t) yield { id: p.id, field: 'docs.priceOptions', text: t };
    }
  }
}

function contextOf(text, idx, len) {
  const s = Math.max(0, idx - 40), e = Math.min(text.length, idx + len + 40);
  return text.slice(s, e).replace(/\s+/g, ' ');
}

const hits = {}; // pattern -> {count, products: {id: {field, contexts: []}}}
for (const { src, rx } of RX) {
  hits[src] = { count: 0, products: {} };
}

for (const { id, field, text } of textSources()) {
  if (!text) continue;
  for (const { src, rx } of RX) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text)) !== null) {
      const h = hits[src];
      h.count++;
      if (!h.products[id]) h.products[id] = { fields: new Set(), contexts: [] };
      h.products[id].fields.add(field);
      if (h.products[id].contexts.length < 3) {
        h.products[id].contexts.push(contextOf(text, m.index, m[0].length));
      }
      if (m[0].length === 0) break;
    }
  }
}

const out = { generatedAt: new Date().toISOString(), patterns: [] };
for (const { src } of RX) {
  const h = hits[src];
  const pids = Object.keys(h.products);
  out.patterns.push({
    pattern: src,
    count: h.count,
    productCount: pids.length,
    sampleProducts: pids.slice(0, 5).map((pid) => ({
      id: pid,
      fields: [...h.products[pid].fields],
      context: h.products[pid].contexts[0] || '',
    })),
  });
}
out.patterns.sort((a, b) => b.count - a.count);
writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
console.log(`wrote ${OUT}: ${out.patterns.length} patterns`);
for (const p of out.patterns.slice(0, 40)) {
  console.log(`${p.count}\t${p.productCount}\t${p.pattern}`);
}
