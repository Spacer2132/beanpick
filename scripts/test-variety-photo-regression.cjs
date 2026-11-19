const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

(async () => {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  const { buildGithubSnapshot, getPublishBlockReason } = require(path.join(root, 'electron/githubPublisher.cjs'));
  const { evaluateListCompleteness } = require(path.join(root, 'electron/collection/contract.cjs'));
  const { getMatchingPriceOptions, getRepresentativePriceOption } = await import(require('node:url').pathToFileURL(path.join(root, 'src/services/coreFeatures.js')).href);
  const tests = [];
  const check = (name, fn) => tests.push({ name, fn });

  const imageUrl = 'https://example.com/photo.jpg';
  const product = { id: 'one', roasterName: '히떼', productName: '페루 게이샤', productUrl: 'https://example.com/products/1', price: 34000, weight: 100 };
  const snapshot = (current, previous = [{ ...product, imageUrl }]) => buildGithubSnapshot(
    [current], '2026-11-19T00:00:00Z', { previousSnapshot: { products: previous } },
  ).products[0];
  check('같은 상품만 사진을 보존하고 가격은 현재 값 유지', () => {
    assert.equal(snapshot({ ...product, price: 35000 }).imageUrl, imageUrl);
    assert.equal(snapshot({ ...product, price: 35000 }).price, 35000);
  });
  check('새 사진 우선', () => {
    assert.equal(snapshot({ ...product, imageUrl: 'https://example.com/new.jpg' }).imageUrl, 'https://example.com/new.jpg');
  });
  check('다른 상품 링크·이름, 모호한 매칭, 비HTTPS 사진 제외', () => {
    assert.ok(!snapshot({ ...product, productUrl: 'https://example.com/products/2' }).imageUrl);
    assert.ok(!snapshot({ ...product, productName: '파나마 게이샤' }).imageUrl);
    assert.ok(!snapshot(product, [{ ...product, imageUrl }, { ...product, imageUrl }]).imageUrl);
    assert.ok(!snapshot(product, [{ ...product, imageUrl: 'http://example.com/photo.jpg' }]).imageUrl);
  });
  const source = fs.readFileSync(path.join(root, 'electron/main.cjs'), 'utf8');
  const pickFunction = (name) => {
    const start = source.indexOf('async function ' + name + '(');
    return source.slice(start, source.indexOf('\n}', start) + 2);
  };
  const crawl = async (page) => {
    let time = 0;
    const run = vm.runInNewContext(pickFunction('waitForSmartStoreProducts') + '\n'
      + pickFunction('crawlSmartStoreCategory') + '\ncrawlSmartStoreCategory', {
      BrowserWindow: class {
        webContents = { executeJavaScript: async () => page };
        close() {}
      },
      Date: { now: () => time },
      delay: async (ms) => { time += ms; },
      extractSmartStoreCategoryItemsScript() {},
      loadSmartStoreCategoryEntry: async () => {},
      readSmartStoreListMarkup: async () => '',
      SMARTSTORE_DEFAULT_PAGE_SIZE: 40,
      MAX_CATEGORY_PAGES: 3,
      evaluateListCompleteness,
    });
    return run('fixture');
  };
  check('미확인 첫 페이지는 수집 실패이며 게시 보호는 유지', async () => {
    const result = await crawl({ total: 0, products: [] });
    assert.equal(result.endReason, 'firstPageUnconfirmed');
    assert.equal(result.completeness, 'failed');
    assert.equal(result.pagesFetched, 0);
    assert.match(getPublishBlockReason(null, { products: [product] }, [{ status: result.completeness, sourceId: 'cafedoan' }]), /수집 실패/);
  });
  check('명시된 0개와 정상 첫 페이지는 각각 빈 목록, 완전 수집', async () => {
    assert.equal((await crawl({ total: 0, products: [], emptyConfirmed: true })).completeness, 'empty');
    assert.equal((await crawl({ total: 1, products: [product] })).completeness, 'complete');
  });
  check('HTTP 429는 재시도하지 않고 요청 제한으로 반환', async () => {
    const events = new (require('node:events').EventEmitter)();
    let loads = 0;
    const load = vm.runInNewContext(pickFunction('loadSmartStorePageWithRetry') + '\nloadSmartStorePageWithRetry', {
      SMARTSTORE_PAGE_LOAD_RETRIES: 1,
      SMARTSTORE_PAGE_LOAD_TIMEOUT_MS: 25000,
      loadUrlWithTimeout: async () => {
        loads += 1;
        events.emit('did-navigate', {}, 'https://example.com/category', 429);
      },
      delay: async () => {},
      console,
    });
    events.getURL = () => 'https://example.com/category';
    await assert.rejects(load({ webContents: events }, 'https://example.com/category'), { code: 'SMARTSTORE_RATE_LIMITED' });
    assert.equal(loads, 1);
    assert.equal(events.listenerCount('did-navigate'), 0);
  });
  check('지도 100g만 매칭하고 그 옵션 가격을 사용', () => {
    const p = { ...product, priceOptions: [{ weight: 40, price: 20000 }, { weight: 100, price: 34000 }, { weight: 1000, price: 191000 }] };
    assert.deepEqual(getMatchingPriceOptions(p, { capacityFilter: 'exact100' }).map(({ weight }) => weight), [100]);
    assert.equal(getRepresentativePriceOption(p, { capacityFilter: 'exact100' }).option.price, 34000);
    assert.equal(getMatchingPriceOptions(p, { capacityFilter: 'exact100', budget: 'under30000' }).length, 0);
    assert.equal(getMatchingPriceOptions(p, { capacityFilter: 'under100' }).length, 2);
  });

  let pass = 0;
  for (const { name, fn } of tests) {
    try { await fn(); pass += 1; }
    catch (error) { console.error(name + ': ' + error.message); }
  }
  console.log(`total=${tests.length} pass=${pass} fail=${tests.length - pass}`);
  process.exitCode = pass === tests.length ? 0 : 1;
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
