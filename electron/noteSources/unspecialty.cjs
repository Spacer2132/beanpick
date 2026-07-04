const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeTastingNotes } = require('../../src/services/tastingNotes.cjs');
const { mergeNotesFromMatchedProducts } = require('../naverShoppingSearch.cjs');

const UNSPECIALTY_ORIGIN = 'https://unspecialty.com';
const CACHE_VERSION = 1;
const USER_AGENT = 'BeanPick/0.1 local desktop app';
const NOTE_SOURCES = {
  malik: {
    sourceId: 'malik',
    roasterName: '말릭커피',
    listUrls: [`${UNSPECIALTY_ORIGIN}/product/list.html?cate_no=90`],
    detailLimit: 0,
    trustListRoaster: true,
  },
  identity: {
    sourceId: 'identity',
    roasterName: '아이덴티티 커피랩',
    listUrls: [UNSPECIALTY_ORIGIN],
    detailLimit: 2,
  },
};

function getUnspecialtyNoteCacheDir(env = process.env, tempDir = os.tmpdir()) {
  if (env.BEANPICK_NOTE_SOURCE_CACHE_DIR) return env.BEANPICK_NOTE_SOURCE_CACHE_DIR;

  const baseDir = env.LOCALAPPDATA
    || env.XDG_CACHE_HOME
    || (env.HOME ? path.join(env.HOME, '.cache') : '');
  return baseDir ? path.join(baseDir, 'BeanPick', 'note-source-cache') : path.join(tempDir, 'beanpick-note-source-cache');
}

function getUnspecialtyNoteCachePath(env = process.env, tempDir = os.tmpdir()) {
  return path.join(getUnspecialtyNoteCacheDir(env, tempDir), 'unspecialty-notes.json');
}

function decodeEscapedUnicode(value) {
  return String(value || '').replace(/\\u([0-9a-fA-F]{4})/g, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

function decodeHtml(value) {
  return decodeEscapedUnicode(String(value || ''))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(value) {
  return decodeHtml(String(value || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function cleanUnspecialtyProductName(productName) {
  return stripHtml(productName)
    .replace(/^상품명\s*:?\s*/i, '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim();
}

function normalizeCacheKey(roasterName, productName) {
  return `${roasterName}::${cleanUnspecialtyProductName(productName).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '')}`;
}

function extractPayloads(text) {
  const payloads = [];
  for (const match of String(text || '').matchAll(/U:(\{[\s\S]*?\}):U/g)) {
    try {
      payloads.push(JSON.parse(decodeEscapedUnicode(decodeHtml(match[1]))));
    } catch {
      // 상품요약정보가 깨진 한 상품 때문에 전체 수집을 멈추지 않는다.
    }
  }
  return payloads;
}

function extractNameFromBlock(block) {
  const nameBlock = String(block || '').match(/<div class=["']name["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
  const spans = [...nameBlock.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
  return cleanUnspecialtyProductName(spans[spans.length - 1] || nameBlock);
}

function extractProductUrlFromBlock(block, sourceUrl = UNSPECIALTY_ORIGIN) {
  const href = String(block || '').match(/href=["']([^"']*product\/detail\.html\?product_no=\d+[^"']*)["']/i)?.[1] || '';
  if (!href) return '';
  return new URL(decodeHtml(href), sourceUrl).href;
}

function toNoteProduct(productName, payload, sourceUrl) {
  const rawProductName = stripHtml(productName);
  const roasterFromName = rawProductName.match(/^\[([^\]]+)\]/)?.[1] || '';
  const tastingNotes = normalizeTastingNotes(payload?.cupNotes || '');
  if (!productName || tastingNotes.length === 0) return null;
  return {
    productName: cleanUnspecialtyProductName(rawProductName),
    roasterName: payload?.roastery || roasterFromName,
    tastingNotes,
    sourceUrl,
  };
}

function dedupeProducts(products) {
  const byKey = new Map();
  for (const product of products) {
    const key = normalizeCacheKey(product.roasterName || '', product.productName);
    if (!key.endsWith('::') && !byKey.has(key)) byKey.set(key, product);
  }
  return [...byKey.values()];
}

function extractProductsFromListBlocks(html, sourceUrl = UNSPECIALTY_ORIGIN) {
  const products = [];
  const blocks = [...String(html || '').matchAll(/<li\b[^>]*id=["']anchorBoxId_[\s\S]*?(?=<li\b[^>]*id=["']anchorBoxId_|<\/ul>|$)/gi)]
    .map((match) => match[0]);

  for (const block of blocks) {
    const productName = extractNameFromBlock(block);
    for (const payload of extractPayloads(block)) {
      const noteProduct = toNoteProduct(productName, payload, extractProductUrlFromBlock(block, sourceUrl) || sourceUrl);
      if (noteProduct) products.push(noteProduct);
    }
  }

  return products;
}

function extractProductsFromJsonLd(html, sourceUrl = UNSPECIALTY_ORIGIN) {
  const products = [];
  for (const match of String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1].trim());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item?.['@type'] !== 'Product') continue;
        for (const payload of extractPayloads(item.description || '')) {
          const noteProduct = toNoteProduct(item.name || '', payload, item.offers?.url || sourceUrl);
          if (noteProduct) products.push(noteProduct);
        }
      }
    } catch {
      // JSON-LD가 일부 깨져도 나머지 파싱은 계속한다.
    }
  }
  return products;
}

function extractDetailUrlsForRoaster(html, roasterName, sourceUrl = UNSPECIALTY_ORIGIN) {
  const urls = [];
  const blocks = [...String(html || '').matchAll(/<li\b[^>]*id=["']anchorBoxId_[\s\S]*?(?=<li\b[^>]*id=["']anchorBoxId_|<\/ul>|$)/gi)]
    .map((match) => match[0]);
  for (const block of blocks) {
    if (!stripHtml(block).includes(roasterName)) continue;
    const url = extractProductUrlFromBlock(block, sourceUrl);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function extractUnspecialtyProductsFromHtml(html, sourceUrl = UNSPECIALTY_ORIGIN) {
  return dedupeProducts([
    ...extractProductsFromListBlocks(html, sourceUrl),
    ...extractProductsFromJsonLd(html, sourceUrl),
  ]);
}

function readCache(cachePath = getUnspecialtyNoteCachePath()) {
  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    return cache?.version === CACHE_VERSION && cache.entries && typeof cache.entries === 'object'
      ? cache
      : { version: CACHE_VERSION, entries: {} };
  } catch {
    return { version: CACHE_VERSION, entries: {} };
  }
}

function writeCache(cache, cachePath = getUnspecialtyNoteCachePath()) {
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // 영구 캐시는 보조 수단이라 쓰기 실패해도 상품 수집은 계속한다.
  }
}

function productsFromCache(cache, roasterName) {
  return Object.values(cache.entries || {})
    .filter((entry) => entry?.roasterName === roasterName)
    .map((entry) => ({
      productName: entry.productName,
      roasterName: entry.roasterName,
      tastingNotes: Array.isArray(entry.tastingNotes) ? entry.tastingNotes : [],
      sourceUrl: entry.sourceUrl || UNSPECIALTY_ORIGIN,
    }))
    .filter((product) => product.productName && product.tastingNotes.length > 0);
}

function mergeProductsIntoCache(cache, products, now = new Date().toISOString()) {
  const nextCache = { version: CACHE_VERSION, entries: { ...(cache.entries || {}) } };
  for (const product of products) {
    const key = normalizeCacheKey(product.roasterName || '', product.productName);
    if (!product.roasterName || key.endsWith('::') || product.tastingNotes.length === 0) continue;
    nextCache.entries[key] = {
      productName: product.productName,
      roasterName: product.roasterName,
      tastingNotes: product.tastingNotes,
      sourceUrl: product.sourceUrl || UNSPECIALTY_ORIGIN,
      cachedAt: now,
    };
  }
  return nextCache;
}

async function fetchText(url, { fetchImpl = fetch, timeoutMs = 15000, referer = UNSPECIALTY_ORIGIN } = {}) {
  const controller = new AbortController();
  let timeoutId;
  try {
    const request = fetchImpl(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': USER_AGENT,
        Referer: referer,
      },
      signal: controller.signal,
    }).then((response) => (response?.ok ? response.text() : '')).catch(() => '');

    return await Promise.race([
      request,
      new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          resolve('');
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function collectUnspecialtyNotesForSource(sourceId, options = {}) {
  const config = NOTE_SOURCES[sourceId];
  if (!config) return { products: [], fetchedCount: 0, cachedCount: 0 };

  const cachePath = options.cachePath || getUnspecialtyNoteCachePath(options.env || process.env);
  let cache = readCache(cachePath);
  const cachedProducts = productsFromCache(cache, config.roasterName);
  const fetchedProducts = [];
  const detailUrls = [];

  for (const listUrl of config.listUrls) {
    const html = await fetchText(listUrl, options);
    if (!html) continue;

    const matchingProducts = extractUnspecialtyProductsFromHtml(html, listUrl)
      .filter((product) => product.roasterName === config.roasterName || (config.trustListRoaster && !product.roasterName));
    fetchedProducts.push(...matchingProducts.map((product) => ({ ...product, roasterName: config.roasterName })));

    if (matchingProducts.length === 0 && config.detailLimit > 0) {
      detailUrls.push(...extractDetailUrlsForRoaster(html, config.roasterName, listUrl));
    }
  }

  for (const detailUrl of [...new Set(detailUrls)].slice(0, options.detailLimit ?? config.detailLimit)) {
    const html = await fetchText(detailUrl, { ...options, referer: UNSPECIALTY_ORIGIN });
    const parsedProducts = extractUnspecialtyProductsFromHtml(html, detailUrl)
      .filter((product) => product.roasterName === config.roasterName || product.productName.includes(config.roasterName));
    fetchedProducts.push(...parsedProducts.map((product) => ({ ...product, roasterName: config.roasterName })));
  }

  const freshProducts = dedupeProducts(fetchedProducts);
  if (freshProducts.length > 0) {
    cache = mergeProductsIntoCache(cache, freshProducts);
    writeCache(cache, cachePath);
  }

  return {
    products: dedupeProducts([...freshProducts, ...cachedProducts]),
    fetchedCount: freshProducts.length,
    cachedCount: cachedProducts.length,
  };
}

async function enrichProductsWithUnspecialtyNotes(sourceId, products, options = {}) {
  if (!Array.isArray(products) || products.every((product) => product.tastingNotes?.length > 0)) return products;

  const result = await collectUnspecialtyNotesForSource(sourceId, options);
  if (result.products.length === 0) return products;
  return mergeNotesFromMatchedProducts(products, result.products);
}

module.exports = {
  NOTE_SOURCES,
  collectUnspecialtyNotesForSource,
  enrichProductsWithUnspecialtyNotes,
  getUnspecialtyNoteCacheDir,
  getUnspecialtyNoteCachePath,
  _test: {
    cleanUnspecialtyProductName,
    extractDetailUrlsForRoaster,
    extractPayloads,
    extractUnspecialtyProductsFromHtml,
    mergeProductsIntoCache,
    normalizeCacheKey,
    productsFromCache,
  },
};
