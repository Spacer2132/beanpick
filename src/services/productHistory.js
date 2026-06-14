const HISTORY_STORAGE_KEY = 'beanpick.priceHistory.v1';
const PRODUCT_CACHE_STORAGE_KEY = 'beanpick.productCache.v1';

const MAX_POINTS_PER_PRODUCT = 60;
const MAX_TRACKED_PRODUCTS = 1000;

function safeReadJson(key, fallback) {
  if (typeof window === 'undefined') return fallback;

  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key, value) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 공간 부족 등으로 실패해도 앱 동작은 계속한다.
  }
}

function toHistoryPoint(product, checkedAt) {
  return {
    t: checkedAt,
    price: Number(product.price || 0),
    soldOut: Boolean(product.isSoldOut),
  };
}

function isSamePoint(a, b) {
  return Boolean(a && b) && a.price === b.price && a.soldOut === b.soldOut;
}

// 이력 객체에 현재 상품 상태를 더한 새 이력을 돌려준다.
// 가격이나 품절 상태가 직전 기록과 다를 때만 점을 추가한다.
function appendHistoryPoints(history, products, checkedAt) {
  const next = { ...history };

  products.forEach((product) => {
    if (!product?.id) return;
    const points = next[product.id] || [];
    const point = toHistoryPoint(product, checkedAt);

    if (isSamePoint(points[points.length - 1], point)) return;
    next[product.id] = [...points, point].slice(-MAX_POINTS_PER_PRODUCT);
  });

  // 추적 상품이 너무 많아지면 가장 오래전에 확인된 것부터 정리한다.
  const ids = Object.keys(next);
  if (ids.length > MAX_TRACKED_PRODUCTS) {
    ids
      .sort((a, b) => {
        const lastA = next[a][next[a].length - 1]?.t || 0;
        const lastB = next[b][next[b].length - 1]?.t || 0;
        return lastA - lastB;
      })
      .slice(0, ids.length - MAX_TRACKED_PRODUCTS)
      .forEach((id) => {
        delete next[id];
      });
  }

  return next;
}

function getProductHistory(history, productId) {
  return history?.[productId] || [];
}

// 직전 기록 대비 가격 변화. 변화가 없거나 비교 대상이 없으면 0.
function getPriceDelta(history, productId) {
  const points = getProductHistory(history, productId);
  if (points.length < 2) return 0;
  const current = points[points.length - 1];
  const previous = points[points.length - 2];
  if (!current.price || !previous.price) return 0;
  return current.price - previous.price;
}

function loadPriceHistory() {
  return safeReadJson(HISTORY_STORAGE_KEY, {});
}

function recordPriceHistory(products, checkedAt = Date.now()) {
  const next = appendHistoryPoints(loadPriceHistory(), products, checkedAt);
  safeWriteJson(HISTORY_STORAGE_KEY, next);
  return next;
}

function loadProductCache() {
  const cache = safeReadJson(PRODUCT_CACHE_STORAGE_KEY, null);
  if (!cache || !Array.isArray(cache.products) || cache.products.length === 0) return null;
  return cache;
}

function saveProductCache(products, savedAt = Date.now()) {
  safeWriteJson(PRODUCT_CACHE_STORAGE_KEY, { products, savedAt });
}

export {
  appendHistoryPoints,
  getPriceDelta,
  getProductHistory,
  loadPriceHistory,
  loadProductCache,
  recordPriceHistory,
  saveProductCache,
};
