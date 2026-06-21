const { validateProducts } = require('./dataQuality.cjs');

const DEFAULT_OWNER = 'Spacer2132';
const DEFAULT_REPO = 'beanpick';
const DEFAULT_BRANCH = 'main';
const DEFAULT_PATH = 'docs/products.json';
const SMARTSTORE_DISCOUNT_GUARD_MIN_ROWS = 20;
const SMARTSTORE_DISCOUNT_GUARD_MIN_RATIO = 0.5;
const SMARTSTORE_DISCOUNT_GUARD_MIN_RATE = 0.10;
const SMARTSTORE_SLUG_BY_ROASTER = {
  '커피정경 로스터리': 'coffeejg',
};

function isSmartStoreUrl(url) {
  return /smartstore\.naver\.com/i.test(String(url || ''));
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getSmartStoreSlugFromUrl(url) {
  const slug = String(url || '').match(/smartstore\.naver\.com\/([^/?#]+)/i)?.[1] || '';
  return slug && slug !== 'main' ? slug.toLowerCase() : '';
}

function getSmartStoreProductNo(url) {
  return String(url || '').match(/\/products\/(\d+)/i)?.[1] || '';
}

function normalizeSmartStoreProductUrl(url, product, option = {}) {
  const productNo = getSmartStoreProductNo(url);
  const storeSlug = productNo ? getSmartStoreSlug(product, option) : '';
  return isNaverMainProductUrl(url) && storeSlug
    ? `https://smartstore.naver.com/${storeSlug}/products/${productNo}`
    : String(url || '');
}

function getSmartStoreSlug(product, option = {}) {
  return getSmartStoreSlugFromUrl(option.productUrl)
    || getSmartStoreSlugFromUrl(product.productUrl)
    || getSmartStoreSlugFromUrl(option.storeUrl)
    || getSmartStoreSlugFromUrl(product.storeUrl)
    || SMARTSTORE_SLUG_BY_ROASTER[product.roasterName]
    || '';
}

function getSmartStoreMatchKeys(product, option = {}) {
  const productUrl = option.productUrl || product.productUrl || '';
  const productNo = getSmartStoreProductNo(productUrl);
  const storeSlug = getSmartStoreSlug(product, option);
  const productName = normalizeText(option.productName || product.productName);
  const roasterName = normalizeText(product.roasterName);
  const weight = Number(option.weight || product.weight || 0);
  const keys = [];

  if (storeSlug && productNo) keys.push(`product:${storeSlug}:${productNo}`);
  if (storeSlug && productName && weight > 0) keys.push(`name:${storeSlug}:${productName}:${weight}`);
  if (roasterName && productName && weight > 0) keys.push(`roaster:${roasterName}:${productName}:${weight}`);

  return keys;
}

function isSmartStoreProduct(product, option = {}) {
  return isSmartStoreUrl(product.productUrl)
    || isSmartStoreUrl(product.storeUrl)
    || isSmartStoreUrl(option.productUrl)
    || isSmartStoreUrl(option.storeUrl);
}

function getPriceRows(products) {
  const rows = [];

  for (const product of Array.isArray(products) ? products : []) {
    rows.push({ product, option: product });
    for (const option of Array.isArray(product?.priceOptions) ? product.priceOptions : []) {
      rows.push({ product, option });
    }
  }

  return rows;
}

function isDiscountRow(row) {
  const price = Number(row?.option?.price || 0);
  const originalPrice = Number(row?.option?.originalPrice || 0);
  return price > 0 && originalPrice > price;
}

function isNaverMainProductUrl(url) {
  return /smartstore\.naver\.com\/main\/products\//i.test(String(url || ''));
}

function isDirectSmartStoreProductUrl(url) {
  return isSmartStoreUrl(url) && !isNaverMainProductUrl(url) && /\/products\/\d+/i.test(String(url || ''));
}

function isGuardDiscountOption(option) {
  const price = Number(option?.price || 0);
  const originalPrice = Number(option?.originalPrice || 0);
  return price > 0 && originalPrice > price && (originalPrice - price) / originalPrice >= SMARTSTORE_DISCOUNT_GUARD_MIN_RATE;
}

function isGuardDiscountProduct(product) {
  if (product?.isSoldOut || !isSmartStoreProduct(product)) return false;
  if (isGuardDiscountOption(product)) return true;
  return (Array.isArray(product?.priceOptions) ? product.priceOptions : [])
    .some((option) => isSmartStoreProduct(product, option) && isGuardDiscountOption(option));
}

function buildPreviousSmartStoreDiscountMap(previousSnapshot) {
  const map = new Map();
  const previousProducts = Array.isArray(previousSnapshot?.products) ? previousSnapshot.products : [];

  for (const row of getPriceRows(previousProducts)) {
    if (!isSmartStoreProduct(row.product, row.option) || !isDiscountRow(row)) continue;
    const originalPrice = Number(row.option.originalPrice);

    for (const key of getSmartStoreMatchKeys(row.product, row.option)) {
      const current = map.get(key);
      if (!current || originalPrice > current.originalPrice) {
        map.set(key, {
          originalPrice,
          productUrl: isDirectSmartStoreProductUrl(row.option.productUrl) ? row.option.productUrl : '',
          storeUrl: isSmartStoreUrl(row.product.storeUrl) ? row.product.storeUrl : '',
        });
      }
    }
  }

  return map;
}

function cloneProducts(products) {
  return (Array.isArray(products) ? products : []).map((product) => ({
    ...product,
    priceOptions: Array.isArray(product?.priceOptions)
      ? product.priceOptions.map((option) => ({ ...option }))
      : product?.priceOptions,
  }));
}

function preserveOptionOriginalPrice(product, option, previousDiscounts) {
  const price = Number(option?.price || 0);
  const currentOriginal = Number(option?.originalPrice || 0);
  if (price <= 0 || currentOriginal > price || !isSmartStoreProduct(product, option)) return 0;

  const match = getSmartStoreMatchKeys(product, option)
    .map((key) => previousDiscounts.get(key))
    .find((item) => Number(item?.originalPrice || 0) > price);

  if (!match) return 0;
  option.originalPrice = Number(match.originalPrice);
  if (isNaverMainProductUrl(option.productUrl) && match.productUrl) {
    option.productUrl = match.productUrl;
  }
  if (!product.storeUrl && match.storeUrl) {
    product.storeUrl = match.storeUrl;
  }
  return 1;
}

function preservePreviousSmartStoreDiscounts(products, previousSnapshot) {
  const cloned = cloneProducts(products);
  const previousDiscounts = buildPreviousSmartStoreDiscountMap(previousSnapshot);
  let preservedCount = 0;

  if (previousDiscounts.size === 0) {
    return { products: cloned, preservedCount };
  }

  for (const product of cloned) {
    preservedCount += preserveOptionOriginalPrice(product, product, previousDiscounts);
    for (const option of Array.isArray(product?.priceOptions) ? product.priceOptions : []) {
      preservedCount += preserveOptionOriginalPrice(product, option, previousDiscounts);
    }
  }

  return { products: cloned, preservedCount };
}

function normalizeSmartStoreProductUrls(products) {
  for (const product of products) {
    if (isNaverMainProductUrl(product.productUrl)) {
      product.productUrl = normalizeSmartStoreProductUrl(product.productUrl, product);
    }
    for (const option of Array.isArray(product?.priceOptions) ? product.priceOptions : []) {
      if (isNaverMainProductUrl(option.productUrl)) {
        option.productUrl = normalizeSmartStoreProductUrl(option.productUrl, product, option);
      }
    }
  }
  return products;
}

function getSmartStoreDiscountStats(products) {
  const smartStoreProducts = (Array.isArray(products) ? products : [])
    .filter((product) => isSmartStoreProduct(product));
  return {
    total: smartStoreProducts.length,
    discountCount: smartStoreProducts.filter(isGuardDiscountProduct).length,
  };
}

function getPublishBlockReason(previousSnapshot, snapshot) {
  const previousProducts = Array.isArray(previousSnapshot?.products) ? previousSnapshot.products : [];
  if (previousProducts.length === 0) return '';

  const previousStats = getSmartStoreDiscountStats(previousProducts);
  const nextStats = getSmartStoreDiscountStats(snapshot.products);
  if (
    previousStats.discountCount >= SMARTSTORE_DISCOUNT_GUARD_MIN_ROWS
    && nextStats.total >= SMARTSTORE_DISCOUNT_GUARD_MIN_ROWS
    && nextStats.discountCount < Math.ceil(previousStats.discountCount * SMARTSTORE_DISCOUNT_GUARD_MIN_RATIO)
  ) {
    return `스마트스토어 정상가/할인 정보가 이전 ${previousStats.discountCount}개에서 현재 ${nextStats.discountCount}개로 크게 줄어 게시를 중단했습니다.`;
  }

  return '';
}

function buildGithubSnapshot(products, publishedAt = new Date().toISOString(), { previousSnapshot = null } = {}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const preserved = preservePreviousSmartStoreDiscounts(safeProducts, previousSnapshot);
  const normalizedProducts = normalizeSmartStoreProductUrls(preserved.products);
  const { clean, excluded, flagged, report } = validateProducts(normalizedProducts);

  return {
    publishedAt,
    count: clean.length,
    products: clean,
    quality: { ...report, excluded, flagged, preservedDiscountCount: preserved.preservedCount },
  };
}

function githubContentsUrl({ owner = DEFAULT_OWNER, repo = DEFAULT_REPO, path = DEFAULT_PATH, branch = DEFAULT_BRANCH } = {}) {
  const encodedPath = String(path).split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'BeanPick',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function parseGithubSnapshotContent(content) {
  if (!content) return null;

  try {
    const text = Buffer.from(String(content).replace(/\s+/g, ''), 'base64').toString('utf8');
    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.products) ? parsed : null;
  } catch {
    return null;
  }
}

async function readExistingFile({ fetchImpl, token, owner, repo, path, branch }) {
  const response = await fetchImpl(githubContentsUrl({ owner, repo, path, branch }), {
    headers: githubHeaders(token),
  });

  if (response.ok) {
    const json = await response.json();
    return {
      sha: json?.sha || '',
      snapshot: parseGithubSnapshotContent(json?.content),
    };
  }

  if (response.status === 404) return { sha: '', snapshot: null };

  const message = await response.text().catch(() => '');
  throw new Error(message || `GitHub 파일 확인 실패 (${response.status})`);
}

async function publishProductsToGitHub({
  products,
  token = process.env.GITHUB_TOKEN || '',
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  path = DEFAULT_PATH,
  branch = DEFAULT_BRANCH,
  fetchImpl = fetch,
  now = () => new Date().toISOString(),
} = {}) {
  if (!token) {
    return { ok: false, error: 'GitHub 토큰이 없습니다. .env 파일의 GITHUB_TOKEN= 뒤에 토큰을 붙여넣고 앱을 다시 실행해주세요.' };
  }

  try {
    const existing = await readExistingFile({ fetchImpl, token, owner, repo, path, branch });
    const snapshot = buildGithubSnapshot(products, now(), { previousSnapshot: existing.snapshot });
    const blockReason = getPublishBlockReason(existing.snapshot, snapshot);
    if (blockReason) {
      return {
        ok: false,
        error: blockReason,
        count: snapshot.count,
        preservedDiscountCount: snapshot.quality.preservedDiscountCount,
      };
    }

    const body = {
      message: `Update BeanPick iPhone snapshot (${snapshot.count} products)`,
      content: Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8').toString('base64'),
      branch,
    };

    if (existing.sha) body.sha = existing.sha;

    const response = await fetchImpl(githubContentsUrl({ owner, repo, path, branch }), {
      method: 'PUT',
      headers: githubHeaders(token),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(message || `GitHub 게시 실패 (${response.status})`);
    }

    const json = await response.json();
    return {
      ok: true,
      count: snapshot.count,
      publishedAt: snapshot.publishedAt,
      path: json?.content?.path || path,
      commitSha: json?.commit?.sha || '',
      excludedCount: snapshot.quality.excludedCount,
      flaggedCount: snapshot.quality.flaggedCount,
      preservedDiscountCount: snapshot.quality.preservedDiscountCount,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'GitHub 게시 중 알 수 없는 오류가 발생했습니다.',
    };
  }
}

module.exports = {
  buildGithubSnapshot,
  publishProductsToGitHub,
};
