const { validateProducts } = require('./dataQuality.cjs');

const DEFAULT_OWNER = 'Spacer2132';
const DEFAULT_REPO = 'beanpick';
const DEFAULT_BRANCH = 'main';
const DEFAULT_PATH = 'docs/products.json';
const SMARTSTORE_DISCOUNT_GUARD_MIN_ROWS = 20;
const SMARTSTORE_DISCOUNT_GUARD_MIN_RATIO = 0.5;
const SMARTSTORE_DISCOUNT_GUARD_MIN_RATE = 0.10;
// 한두 곳 수집이 통째로 실패하면 상품/로스터리 수가 확 줄어든다. 빈약한 목록으로 기존 게시본을 덮어쓰지 않도록 막는다.
const COUNT_GUARD_MIN_PREVIOUS = 20;
const COUNT_GUARD_MIN_RATIO = 0.5;
const MAX_PUBLISH_ATTEMPTS = 3;
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
          weight: Number(row.option.weight || row.product.weight || 0),
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

  // 다른 용량의 정상가가 붙지 않도록, 복원할 정상가의 출처 용량이 이 옵션 용량과 같을 때만 인정한다.
  const optionWeight = Number(option?.weight || 0);
  const match = getSmartStoreMatchKeys(product, option)
    .map((key) => previousDiscounts.get(key))
    .find((item) => Number(item?.originalPrice || 0) > price
      && (!optionWeight || !item?.weight || Number(item.weight) === optionWeight));

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
    const options = Array.isArray(product?.priceOptions) ? product.priceOptions : [];
    // 용량 옵션이 있으면 상단 price/weight는 서로 다른 옵션(예: 200g 판매가 + 1kg 대표용량)이 섞여 있어,
    // 상단에 이전 정상가를 복원하면 엉뚱한 용량의 정상가가 붙는다. 옵션이 있으면 옵션별로만 복원한다.
    if (options.length === 0) {
      preservedCount += preserveOptionOriginalPrice(product, product, previousDiscounts);
    } else {
      for (const option of options) {
        preservedCount += preserveOptionOriginalPrice(product, option, previousDiscounts);
      }
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

function countDistinctRoasters(products) {
  return new Set(
    (Array.isArray(products) ? products : [])
      .map((product) => normalizeText(product?.roasterName))
      .filter(Boolean),
  ).size;
}

function getPublishBlockReason(previousSnapshot, snapshot) {
  const previousProducts = Array.isArray(previousSnapshot?.products) ? previousSnapshot.products : [];
  if (previousProducts.length === 0) return '';
  const nextProducts = Array.isArray(snapshot?.products) ? snapshot.products : [];

  // 전체 상품 수 또는 로스터리 수가 이전의 절반 밑으로 떨어지면 일부 로스터리 수집이 통째로 실패한 것으로 보고 막는다.
  if (previousProducts.length >= COUNT_GUARD_MIN_PREVIOUS) {
    if (nextProducts.length < Math.ceil(previousProducts.length * COUNT_GUARD_MIN_RATIO)) {
      return `상품 수가 이전 ${previousProducts.length}개에서 현재 ${nextProducts.length}개로 절반 이하로 줄어 게시를 중단했습니다. 일부 로스터리 수집이 실패했을 수 있습니다.`;
    }
    const previousRoasters = countDistinctRoasters(previousProducts);
    const nextRoasters = countDistinctRoasters(nextProducts);
    if (previousRoasters >= 2 && nextRoasters < Math.ceil(previousRoasters * COUNT_GUARD_MIN_RATIO)) {
      return `로스터리 수가 이전 ${previousRoasters}곳에서 현재 ${nextRoasters}곳으로 절반 이하로 줄어 게시를 중단했습니다. 일부 로스터리 수집이 실패했을 수 있습니다.`;
    }
  }

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  // 본문 읽기(json/text)까지 타이머 보호 안에 둔다.
  try {
    const response = await fetchImpl(githubContentsUrl({ owner, repo, path, branch }), {
      headers: githubHeaders(token),
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeoutId);
  }
}

function isRetryablePublishStatus(status) {
  // sha 충돌(409/422), 혼잡/한도(429), 일시적 서버 오류(5xx)는 재시도 가치가 있다. 잘못된 토큰·없는 경로는 재시도해도 소용없다.
  return status === 409 || status === 422 || status === 429 || status >= 500;
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

    const contentBase64 = Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8').toString('base64');
    let sha = existing.sha;
    let json = null;

    // 게시 충돌(sha 불일치)이나 일시적 GitHub 오류로 비싼 수집 결과를 통째로 잃지 않도록 몇 번 재시도한다.
    for (let attempt = 1; attempt <= MAX_PUBLISH_ATTEMPTS; attempt += 1) {
      const body = {
        message: `Update BeanPick iPhone snapshot (${snapshot.count} products)`,
        content: contentBase64,
        branch,
      };
      if (sha) body.sha = sha;

      const controller = new AbortController();
      // products.json(약 1MB) 업로드는 발행의 마지막 단계라 5초로는 위험하다.
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let response;
      let okJson = null;
      let errMessage = '';
      try {
        response = await fetchImpl(githubContentsUrl({ owner, repo, path, branch }), {
          method: 'PUT',
          headers: githubHeaders(token),
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        // 본문 읽기까지 타이머 보호 안에 둔다.
        if (response.ok) {
          okJson = await response.json();
        } else {
          errMessage = await response.text().catch(() => '');
        }
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        json = okJson;
        break;
      }

      const message = errMessage;
      if (attempt >= MAX_PUBLISH_ATTEMPTS || !isRetryablePublishStatus(response.status)) {
        throw new Error(message || `GitHub 게시 실패 (${response.status})`);
      }
      // sha 충돌(409/422)이면 최신 파일을 다시 읽어 sha를 갱신한 뒤 다시 시도한다.
      if (response.status === 409 || response.status === 422) {
        const refreshed = await readExistingFile({ fetchImpl, token, owner, repo, path, branch });
        sha = refreshed.sha;
      }
    }
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
