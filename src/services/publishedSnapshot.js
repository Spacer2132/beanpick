import { normalizeProducts } from './coreFeatures.js';

async function loadPublishedSnapshot(fetchImpl = fetch, url = './products.json') {
  if (typeof fetchImpl !== 'function') return null;

  try {
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response?.ok) return null;

    const snapshot = await response.json();
    if (!snapshot || !Array.isArray(snapshot.products)) return null;

    return {
      publishedAt: typeof snapshot.publishedAt === 'string' ? snapshot.publishedAt : '',
      count: Number(snapshot.count || snapshot.products.length),
      // 게시 파일은 과거 실행에서 계산된 표시값을 포함할 수 있으므로,
      // 현재 가격·중량·정상가로 단가와 할인 라벨을 다시 맞춘다.
      products: normalizeProducts(snapshot.products),
    };
  } catch {
    return null;
  }
}

function getPublishButtonLabel(publishState = {}) {
  if (publishState.status === 'loading') return '게시 중';
  if (publishState.status === 'success') return '게시 완료';
  if (publishState.status === 'error') return '게시 실패';
  return '아이폰 게시';
}

export {
  getPublishButtonLabel,
  loadPublishedSnapshot,
};
