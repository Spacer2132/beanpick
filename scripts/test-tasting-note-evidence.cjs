const assert = require('node:assert/strict');
const fs = require('node:fs');
const esbuild = require('esbuild');
const notes = require('../src/services/tastingNotes.cjs');
const { _test: collector, enrichProductsWithThumbnailOcr } = require('../electron/naverShoppingSearch.cjs');
const { buildGithubSnapshot } = require('../electron/githubPublisher.cjs');
const contract = require('../electron/collection/contract.cjs');

function loadModule(file) {
  const output = esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', output)(module, module.exports, (name) => {
    if (name.includes('tastingNotes')) return notes;
    if (name.includes('stockStatus')) return require('../src/services/adapters/stockStatus.cjs');
    throw new Error(`Unexpected import: ${name}`);
  });
  return module.exports;
}

async function main() {
  let checks = 0;
  function equal(actual, expected) { assert.deepEqual(actual, expected); checks++; }
  const sourceUrl = 'https://example.com/product/detail.html?product_no=7001';
  const mainSource = fs.readFileSync('electron/main.cjs', 'utf8');
  const loaderSource = mainSource.slice(mainSource.indexOf('async function loadSmartStorePageWithRetry('), mainSource.indexOf('// 숨김 창 안에서'));
  let pageLoads = 0;
  const loadPage = new Function('loadUrlWithTimeout', 'SMARTSTORE_PAGE_LOAD_RETRIES', 'SMARTSTORE_PAGE_LOAD_TIMEOUT_MS', 'delay', `${loaderSource}; return loadSmartStorePageWithRetry;`)(async () => { pageLoads++; }, 1, 25000, async () => {});
  await assert.rejects(loadPage({ webContents: { getURL: () => 'https://nid.naver.com/nidlogin.login?url=test' } }, sourceUrl), { code: 'SMARTSTORE_LOGIN_REQUIRED' });
  checks++;
  equal(pageLoads, 1);
  await loadPage({ webContents: { getURL: () => 'https://smartstore.naver.com/example' } }, sourceUrl);
  equal(pageLoads, 2);
  const raw = ['백도', '라즈베리잼', '오렌지 블로섬', '화이트 와인'];
  equal(notes.normalizeTastingNotes(['BERRY', 'BLUEBERRY', 'BLACKBERRY']), ['블루베리', '검은딸기']);
  const evidence = notes.createTastingNoteEvidence(raw, sourceUrl);
  equal(evidence.map((entry) => entry.text), raw);
  equal(notes.createTastingNoteEvidence(raw, 'javascript:alert(1)'), []);
  equal(notes.createTastingNoteEvidence(['<script>', {}, null], sourceUrl), []);
  equal(notes.extractTastingNoteEvidence('원산지 에티오피아, 브랜드 ROSE COFFEE', sourceUrl), []);
  equal(notes.extractTastingNoteEvidence(`컵노트: ${raw.join(', ')}\n가공: Washed`, sourceUrl), evidence);
  equal(notes.createTastingNoteEvidence(['백도', '라즈베리잼', '오렌지꽃', '자스민', '꿀', '초콜릿'], sourceUrl).length, 6);
  equal(notes.mergeTastingNoteEvidence(evidence, evidence), evidence);

  const blendEvidence = [];
  equal(await collector.getOcrTasteNotes(sourceUrl, { productName: 'Blue 블랜딩', onEvidence: entries => blendEvidence.push(...entries) }, {
    env: { GEMINI_API_KEY: 'test-only' },
    readGeminiText: async () => JSON.stringify([
      { text: 'FLORAL', group: '블루 블렌딩', scope: 'product' },
      { text: 'BERRY', group: '블루 블렌딩', scope: 'product' },
      { text: 'MILK CHOCOLATE', group: '블루 블렌딩', scope: 'product' },
      { text: '오렌지', group: '온두라스 워시드', process: 'WASHED', scope: 'component' },
    ]),
    readOcrText: async () => { throw new Error('Component notes must not fall back'); },
  }), notes.normalizeTastingNotes(['FLORAL', 'BERRY', 'MILK CHOCOLATE']));
  equal(blendEvidence.at(-1).reviewReason, 'blend-component');
  equal(notes.mergeTastingNoteEvidence(blendEvidence).at(-1).reviewReason, 'blend-component');
  equal(await collector.getOcrTasteNotes(sourceUrl, {}, {
    env: { GEMINI_API_KEY: 'test-only' },
    readGeminiText: async () => JSON.stringify([{
      text: '잘 익은 사과의 산뜻한 산미, 달콤한 캐러멜 향과 깔끔한 여운의 에스프레소&드립 겸용 커피',
      scope: 'product',
    }]),
    readOcrText: async () => { throw new Error('Explicit model evidence must not fall back'); },
  }), ['사과', '캐러멜']);
  equal(collector.parseGeminiEvidence('[{"text":"오렌지","group":"온두라스 워시드","process":"WASHED"}]', sourceUrl, 'Blue 블랜딩')[0].reviewReason, 'blend-component');
  equal(collector.parseGeminiEvidence('[{"text":"오렌지","group":"Split A","process":"Washed"}]', sourceUrl, '테스트 워시드')[0].reviewReason, undefined);
  equal(collector.parseGeminiEvidence('[{"text":"다크초콜릿","group":"다크딥 블렌딩"},{"text":"딸기","group":"에티오피아","process":"내추럴"}]', sourceUrl).at(-1).reviewReason, 'blend-component');
  equal(collector.parseGeminiEvidence('[{"text":"오렌지","group":"Split A (Washed)","process":"Washed"}]', sourceUrl, '테스트 블렌드')[0].reviewReason, undefined);

  const imageEvidence = [];
  const imageText = await collector.readOfficialMallImageText('https://example.com/notes.png', {
    onEvidence: (entries) => imageEvidence.push(...entries),
  }, {
    env: { GEMINI_API_KEY: 'test-only' },
    readGeminiText: async () => JSON.stringify(raw),
    readOcrText: async () => { throw new Error('Recognized image must not need fallback'); },
  });
  equal(imageEvidence.map((entry) => entry.text), raw);
  equal(imageEvidence.every((entry) => entry.method === 'image-model'), true);
  equal(imageText, `Tasting Note: ${notes.normalizeTastingNotes(raw).join(', ')}`);
  const detailEvidence = [];
  await collector.extractNotesFromDetail(`컵노트: ${raw.join(', ')}`, {
    maxImages: 0, sourceUrl, onEvidence: (entries) => detailEvidence.push(...entries),
  });
  equal(detailEvidence, evidence);

  const groupedRaw = [{ text: '청포도', group: 'Split A', process: 'Honey' }, { text: '청포도', group: 'Split B', process: 'Honey' }];
  const groupedEvidence = collector.parseGeminiEvidence(JSON.stringify(groupedRaw), sourceUrl, '에티오피아 허니');
  equal(groupedEvidence.length, 2);
  equal(notes.mergeTastingNoteEvidence(groupedEvidence), groupedEvidence);
  equal(notes.getDisplayTastingNotes({ tastingNotes: ['청포도'], tastingNoteEvidence: groupedEvidence }), ['청포도']);
  equal(notes.extractTastingNoteEvidence('Split A\n컵노트: 청포도\nSplit B\n컵노트: 홍차', sourceUrl).map((entry) => entry.group), ['Split A', 'Split B']);
  equal(collector.hasProcessingConflict('수마트라 길링 바사 (웻 훌)', 'Washed'), true);
  equal(collector.hasProcessingConflict('에티오피아 무산소 내추럴', 'Anaerobic Natural'), false);
  equal(collector.hasProcessingConflict('블렌드 워시드 내추럴', 'Washed'), false);
  const conflictEvidence = [];
  const conflictText = await collector.readOfficialMallImageText(sourceUrl, { productName: '수마트라 길링 바사 (웻 훌)', onEvidence: (items) => conflictEvidence.push(...items) }, {
    env: { GEMINI_API_KEY: 'test-only' }, readGeminiText: async () => JSON.stringify([{ text: '카카오', process: 'Washed' }]),
    readOcrText: async () => { throw new Error('Conflicting source must not fall back'); },
  });
  equal(conflictText, '');
  equal(conflictEvidence[0].reviewReason, 'process-conflict');
  equal(notes.getPendingTastingNotes({ tastingNotes: ['카카오'], tastingNoteEvidence: conflictEvidence }), conflictEvidence);
  const imageOrder = [];
  await collector.extractNotesFromDetail('<img src="https://example.com/banner.png">', { maxImages: 1, imageUrls: ['https://example.com/detail.png'], productName: '테스트 워시드' }, {
    getOcrTasteNotes: async (url, options) => { imageOrder.push([url, options.productName]); return ['사과']; },
  });
  equal(imageOrder, [['https://example.com/detail.png', '테스트 워시드']]);
  equal(await collector.getOcrTasteNotes(sourceUrl, { allowUnlabeled: false }, {
    env: {}, readOcrText: async () => '초콜릿',
  }), []);
  let readableNaverImageUrl = '';
  equal(await collector.getOcrTasteNotes('https://shop-phinf.pstatic.net/example.png?type=f80_80', {}, {
    env: { GEMINI_API_KEY: 'test-only' },
    readGeminiText: async (url) => {
      readableNaverImageUrl = url;
      return '[{"text":"다크초콜릿","scope":"product"}]';
    },
    readOcrText: async () => { throw new Error('Readable model evidence must not fall back'); },
  }), ['다크초콜릿']);
  equal(readableNaverImageUrl, 'https://shop-phinf.pstatic.net/example.png?type=f750_750');
  const savedKey = process.env.GEMINI_API_KEY;
  try {
    process.env.GEMINI_API_KEY = 'test-only';
    equal(await collector.getOcrTasteNotes(sourceUrl, { process: 'Washed' }, {
      readGeminiText: async () => '[{"text":"사과","process":"Washed"}]',
      readOcrText: async () => { throw new Error('Real process.env must select the model path'); },
    }), ['사과']);
  } finally {
    if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = savedKey;
  }
  const ambiguousTarget = [{ productName: '에티오피아 테스트 커피', tastingNotes: [] }];
  equal(collector.mergeNotesFromMatchedProducts(ambiguousTarget, [
    { productName: '에티오피아 테스트 커피 워시드', tastingNotes: ['사과'] },
    { productName: '에티오피아 테스트 커피 내추럴', tastingNotes: ['딸기'] },
  ]), ambiguousTarget);

  const unsupportedThumbnail = await enrichProductsWithThumbnailOcr([
    { productName: '근거 없는 썸네일', imageUrl: sourceUrl, tastingNotes: [], tastingNoteEvidence: [] },
  ], {
    readNotes: async () => ['복숭아'],
  });
  equal(unsupportedThumbnail[0].tastingNotes, []);
  const supportedThumbnailEvidence = notes.createTastingNoteEvidence(['복숭아'], sourceUrl, 'image-model');
  const supportedThumbnail = await enrichProductsWithThumbnailOcr([
    { productName: '근거 있는 썸네일', imageUrl: sourceUrl, tastingNotes: [], tastingNoteEvidence: [] },
  ], {
    readNotes: async (_url, options) => {
      options.onEvidence(supportedThumbnailEvidence);
      return ['복숭아'];
    },
  });
  equal(supportedThumbnail[0].tastingNotes, ['복숭아']);
  equal(collector.mergeNotesFromMatchedProducts(ambiguousTarget, [
    { productName: '에티오피아 테스트 커피', tastingNotes: ['사과'] },
    { productName: '에티오피아 테스트 커피', tastingNotes: ['딸기'] },
  ]), ambiguousTarget);

  const core = loadModule('src/services/coreFeatures.js');
  const product = {
    id: 'evidence-7001', roasterName: '원문 검증 로스터리', productName: '에티오피아 구지 원문검증 200g',
    origin: 'Ethiopia', process: 'Washed', roastLevel: 'Light', price: 20000, weight: 200, score: 85,
    productUrl: sourceUrl, imageUrl: '', isSoldOut: false, isNew: false,
    lastCheckedAt: '2026-09-12T00:00:00.000Z', checkedMinutesAgo: 0,
    tastingNotes: notes.normalizeTastingNotes(raw), tastingNoteEvidence: evidence,
  };
  const [normalized] = core.normalizeProducts([product]);
  const [grouped] = core.groupProductsByNameAndWeight([normalized]);
  equal(grouped.tastingNoteEvidence, evidence);
  const [evidenceFromSecondOption] = core.groupProductsByNameAndWeight([
    { ...product, id: 'evidence-200', productName: '에티오피아 구지 원문검증 200g', weight: 200, tastingNotes: [], tastingNoteEvidence: [] },
    { ...product, id: 'evidence-500', productName: '에티오피아 구지 원문검증 500g', weight: 500 },
  ]);
  equal(evidenceFromSecondOption.tastingNoteEvidence, evidence);
  equal(notes.getDisplayTastingNotes(grouped), ['복숭아', '라즈베리', '오렌지꽃']);
  equal(notes.getPendingTastingNotes(grouped).map((entry) => entry.text), ['화이트 와인']);
  equal(core.matchesNoteQuery(grouped, '라즈베리잼'), true);
  equal(core.matchesNoteQuery(grouped, '', '백도'), false);
  equal(core.filterProductsBySearchAndNotes([grouped], '', ['복숭아']).length, 1);
  equal(notes.getDisplayTastingNotes({ tastingNotes: ['자스민'] }), ['자스민']);
  const conflicting = { tastingNotes: ['복숭아'], tastingNoteEvidence: notes.createTastingNoteEvidence(['자스민'], sourceUrl) };
  equal(notes.getDisplayTastingNotes(conflicting), ['복숭아']);
  equal(notes.getPendingTastingNotes(conflicting).map((entry) => entry.text), ['자스민']);
  equal(contract.toLegacyProduct(contract.fromLegacyProduct(product, { channelId: 'test' })).tastingNoteEvidence, evidence);
  const contextualProduct = { ...product, tastingNotes: ['청포도'], tastingNoteEvidence: [...groupedEvidence, ...conflictEvidence] };
  equal(core.normalizeProducts([contextualProduct])[0].tastingNoteEvidence, contextualProduct.tastingNoteEvidence);
  equal(contract.toLegacyProduct(contract.fromLegacyProduct(contextualProduct, { channelId: 'test' })).tastingNoteEvidence, contextualProduct.tastingNoteEvidence);
  equal(buildGithubSnapshot([contextualProduct], '2026-09-12T00:00:00.000Z').products[0].tastingNoteEvidence, contextualProduct.tastingNoteEvidence);

  const snapshot = buildGithubSnapshot([grouped], '2026-09-12T00:00:00.000Z');
  equal(snapshot.products.length, 1);
  equal(snapshot.products[0].tastingNoteEvidence, evidence);
  const restored = buildGithubSnapshot([{ ...product, tastingNotes: [], tastingNoteEvidence: [] }], '2026-09-12T01:00:00.000Z', {
    previousSnapshot: snapshot,
  });
  equal(restored.products[0].tastingNoteEvidence, evidence);
  const other = buildGithubSnapshot([{ ...product, id: 'different', tastingNotes: [], tastingNoteEvidence: [] }], '2026-09-12T01:00:00.000Z', { previousSnapshot: snapshot });
  equal(other.products[0].tastingNoteEvidence, []);
  const unsupportedPrevious = buildGithubSnapshot([{ ...product, id: 'legacy-no-evidence', tastingNotes: [], tastingNoteEvidence: [] }], '2026-09-12T01:00:00.000Z', {
    previousSnapshot: { products: [{ ...product, id: 'legacy-no-evidence', tastingNotes: ['초코무스'], tastingNoteEvidence: [] }] },
  });
  equal(unsupportedPrevious.products[0].tastingNotes, []);
  const unsupportedCurrent = buildGithubSnapshot([{ ...product, id: 'current-no-evidence', tastingNotes: ['꿀'], tastingNoteEvidence: [] }], '2026-09-12T01:00:00.000Z');
  equal(unsupportedCurrent.products[0].tastingNotes, []);
  const correctedCurrent = buildGithubSnapshot([{ ...product, id: 'current-conflict', tastingNotes: ['복숭아'], tastingNoteEvidence: notes.createTastingNoteEvidence(['자스민'], sourceUrl) }], '2026-09-12T01:00:00.000Z');
  equal(correctedCurrent.products[0].tastingNotes, ['자스민']);

  const detail = { tastingNotes: raw.join(', '), weight: 200 };
  const marker = JSON.stringify(detail).replace(/"/g, '&quot;');
  const html = `<div><ul><li id="anchorBoxId_7001"><a href="/product/detail.html?product_no=7001&cate_no=47"><img src="https://example.com/bean.png" alt="에티오피아 구지 200g" /></a><p class="name"><a>에티오피아 구지 200g</a></p><span class="price">20,000원</span><span data-beanpick-detail="${marker}"></span></li></ul></div>`;
  const cafe24 = loadModule('src/services/adapters/cafe24OfficialAdapter.ts');
  const configs = loadModule('src/services/adapters/officialMallConfigs.ts').OFFICIAL_MALL_CONFIGS;
  const [official] = cafe24.parseCafe24Products(html, configs.coffeelibre);
  equal(official.tastingNoteEvidence.map((entry) => entry.text), raw);
  const momos = loadModule('src/services/adapters/momosOfficialAdapter.ts');
  const momosHtml = html.replace('/product/detail.html?product_no=7001&cate_no=47', '/product/coffee/7001/category/42/')
    .replace('<p class="name">', '<div class="name">').replace('</a></p>', '</a></div>');
  const [momosProduct] = momos.parseMomosHtmlProducts(momosHtml);
  equal(momosProduct.tastingNoteEvidence.map((entry) => entry.text), raw);
  const terarosa = loadModule('src/services/adapters/terarosaOfficialAdapter.ts');
  const tera = terarosa.parseTerarosaDetailProduct(`<input name="ItemName" value="에티오피아 구지 200g"><div class="cont_title_info">Tasting Note: ${raw.join(', ')}</div>`, sourceUrl);
  equal(tera.tastingNoteEvidence.map((entry) => entry.text), raw);
  equal(fs.readFileSync('src/services/tastingNotes.js', 'utf8').replace('export {', 'module.exports = {'), fs.readFileSync('src/services/tastingNotes.cjs', 'utf8'));

  if (process.argv.includes('--write-browser-fixture')) {
    const directory = 'output/tasting-note-review/browser';
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(`${directory}/index.html`, fs.readFileSync('dist/index.html', 'utf8').replaceAll('./assets/', '/dist/assets/'));
    const legacy = { ...product, id: 'legacy-7002', productName: '콜롬비아 레거시검증 200g', origin: 'Colombia', tastingNotes: ['초콜릿'], tastingNoteEvidence: [] };
    const blend = { ...product, id: 'blend-7003', productName: 'Blue 블랜딩 200g', origin: 'Blend', process: 'Blend', tastingNotes: notes.normalizeTastingNotes(['FLORAL', 'BERRY', 'MILK CHOCOLATE']), tastingNoteEvidence: blendEvidence };
    fs.writeFileSync(`${directory}/products.json`, JSON.stringify({ ...snapshot, count: 3, products: [...snapshot.products, legacy, blend] }, null, 2));
  }
  console.log(`[tasting-note-evidence] ${checks}/${checks} checks passed (offline; no model calls)`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
