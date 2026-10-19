const assert = require('node:assert/strict');
const fs = require('node:fs');
const notes = require('../src/services/tastingNotes.cjs');
const parser = require('../src/services/adapters/cafe24DetailParser.cjs');
const { buildGithubSnapshot } = require('../electron/githubPublisher.cjs');

function loadAdapter(file) {
  const output = require('esbuild').transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', output)(module, module.exports, (name) => {
    if (name.includes('tastingNotes')) return notes;
    if (name.includes('stockStatus')) return require('../src/services/adapters/stockStatus.cjs');
    throw new Error(`Unexpected import: ${name}`);
  });
  return module.exports;
}

const source = fs.readFileSync('electron/main.cjs', 'utf8');
const start = source.indexOf('async function enrichOfficialDetailNotes(');
const helper = start < 0 ? '' : source.slice(start, source.indexOf('async function buildDetailDataFromDetails('));
const enrich = source.slice(source.indexOf('async function enrichImwebDetailOptions('), source.indexOf('async function enrichPagesWithDetailStock('));
const failures = [];
let passed = 0;

async function run(sourceId, scenario) {
  let now = 0;
  const events = [];
  const details = new Map();
  const items = [1, 2].map((id) => ({ productNo: String(id), detailUrl: `https://example.com/shop_view/${id}`, productName: '콜롬비아 테스트 워시드' }));
  const priceOptions = [{ price: 18000, weight: 200 }];
  const html = '<img class="fr-dib" src="https://cdn.imweb.me/upload/S1/notes.png">';
  const deps = {
    Date: { now: () => now },
    extractImwebListItemLinks: () => items,
    isLikelyMomosBeanProductName: () => true,
    fetchHtmlPage: async () => ({ html }),
    fetchImwebOmsProduct: async (_url, id) => { events.push(`price:${id}`); if (scenario === 'expired' && events.length === items.length) now = 101; return {}; },
    extractImwebOmsPriceOptions: () => priceOptions,
    fetchImwebOptionPage: async () => { throw new Error('OMS 옵션이 있으면 폴백 불필요'); },
    extractImwebPriceOptions: () => [],
    parseCafe24DetailInfo: () => ({ weight: 200, process: 'Washed', ...(scenario === 'text' ? { tastingNotes: '꿀' } : {}) }),
    injectDetailMarkerIntoImwebBlock: (page, id, info) => { details.set(id, info); return page; },
    extractDetailContentImageUrls: parser.extractDetailContentImageUrls,
    extractBlendComposition: parser.extractBlendComposition,
    mergeTastingNoteEvidence: notes.mergeTastingNoteEvidence,
    absolutizeImageUrl: (url, base) => new URL(url, base).href,
    readOfficialMallImageText: async (url, options) => {
      events.push('ocr');
      assert.equal(events.filter((event) => event.startsWith('price:')).length, 2);
      assert.equal(options.productName, items[0].productName);
      if (scenario === 'failure') throw new Error('판독 실패');
      options.onEvidence(notes.createTastingNoteEvidence(['사과'], url, 'image-model'));
      return 'Tasting Note: 사과';
    },
  };
  const fn = new Function(...Object.keys(deps), `${helper}\n${enrich}; return enrichImwebDetailOptions;`)(...Object.values(deps));
  await fn([{ html: 'list' }], { sourceId, sourceUrl: 'https://example.com/shop', detailOrigin: 'https://example.com' }, scenario === 'expired' ? 100 : Infinity);
  assert.equal(details.size, 2);
  for (const detail of details.values()) {
    assert.deepEqual(detail.priceOptions, priceOptions);
    if (scenario === 'success') {
      assert.equal(detail.ocrText, 'Tasting Note: 사과');
      assert.deepEqual(detail.tastingNoteEvidence.map((entry) => entry.text), ['사과']);
      const properties = JSON.stringify({ idx: 1, name: items[0].productName, price: 18000 });
      const block = `<div class="_shop_item" data-product-properties='${properties}'>${parser.buildDetailInfoMarker(detail)}</div>`;
      const products = sourceId === 'momos'
        ? loadAdapter('src/services/adapters/momosOfficialAdapter.ts').parseMomosHtmlProducts(block)
        : loadAdapter('src/services/adapters/cafe24OfficialAdapter.ts').parseImwebProducts(block, {
          sourceId, roasterName: '센터커피', origin: 'https://example.com', defaultWeight: 200,
        });
      const published = buildGithubSnapshot(products).products;
      assert.equal(published.length, 1);
      assert.deepEqual(published[0].tastingNotes, ['사과']);
      assert.equal(published[0].price, 18000);
      assert.equal(published[0].weight, 200);
    }
    if (scenario === 'text') assert.equal(detail.tastingNotes, '꿀');
  }
  assert.equal(events.filter((event) => event === 'ocr').length, ['success', 'failure'].includes(scenario) ? 2 : 0);
}

(async () => {
  for (const sourceId of ['centercoffee', 'momos']) {
    for (const scenario of ['success', 'failure', 'expired', 'text']) {
      try { await run(sourceId, scenario); passed++; }
      catch (error) { failures.push(`${sourceId}/${scenario}: ${error.message}`); }
    }
  }
  console.log(JSON.stringify({ total: 8, passed, failed: failures.length, failures }));
  if (failures.length) process.exitCode = 1;
})();
