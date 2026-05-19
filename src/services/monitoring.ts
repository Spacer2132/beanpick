import type { BeanProduct } from '../data/mockBeans';
import type { RoasterySource } from '../data/roasterySources';

export type ProductSnapshotItem = {
  id: string;
  roasterName: string;
  productName: string;
  price: number;
  isSoldOut: boolean;
  score: number;
};

export type ProductChange = {
  id: string;
  type: 'newProduct' | 'priceChanged' | 'soldOut' | 'restocked';
  label: string;
  detail: string;
};

export type MonitorSummary = {
  sourceCount: number;
  enabledSourceCount: number;
  readySourceCount: number;
  productCount: number;
  soldOutCount: number;
  newProductCount: number;
  changes: ProductChange[];
  hasSavedBaseline: boolean;
};

const SNAPSHOT_STORAGE_KEY = 'beanpick.productSnapshot.v1';
export const FAVORITE_STORAGE_KEY = 'beanpick.favoriteProducts.v1';

const fallbackPreviousSnapshot: ProductSnapshotItem[] = [
  {
    id: 'libre-pink-bourbon',
    roasterName: '커피리브레',
    productName: 'Colombia La Pradera Pink Bourbon',
    price: 34000,
    isSoldOut: false,
    score: 86,
  },
  {
    id: 'namusairo-brazil-cerrado',
    roasterName: '나무사이로',
    productName: 'Brazil Cerrado Pulped Natural',
    price: 22000,
    isSoldOut: false,
    score: 78,
  },
];

function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function buildProductSnapshot(products: BeanProduct[]): ProductSnapshotItem[] {
  return products.map((product) => ({
    id: product.id,
    roasterName: product.roasterName,
    productName: product.productName,
    price: product.price,
    isSoldOut: product.isSoldOut,
    score: product.score,
  }));
}

export function loadSavedSnapshot(): ProductSnapshotItem[] | null {
  return safeReadJson<ProductSnapshotItem[] | null>(SNAPSHOT_STORAGE_KEY, null);
}

export function saveProductSnapshot(products: BeanProduct[]) {
  safeWriteJson(SNAPSHOT_STORAGE_KEY, buildProductSnapshot(products));
}

export function loadFavoriteProductIds(): string[] {
  return safeReadJson<string[]>(FAVORITE_STORAGE_KEY, []);
}

export function saveFavoriteProductIds(ids: string[]) {
  safeWriteJson(FAVORITE_STORAGE_KEY, [...new Set(ids)]);
}

export function diffProductSnapshots(current: ProductSnapshotItem[], previous: ProductSnapshotItem[]): ProductChange[] {
  const previousMap = new Map(previous.map((item) => [item.id, item]));
  const changes: ProductChange[] = [];

  current.forEach((item) => {
    const before = previousMap.get(item.id);

    if (!before) {
      changes.push({
        id: item.id,
        type: 'newProduct',
        label: '새 상품',
        detail: `${item.roasterName} · ${item.productName}`,
      });
      return;
    }

    if (before.price !== item.price) {
      changes.push({
        id: item.id,
        type: 'priceChanged',
        label: '가격 변경',
        detail: `${item.productName} · ${before.price.toLocaleString('ko-KR')}원 → ${item.price.toLocaleString('ko-KR')}원`,
      });
    }

    if (!before.isSoldOut && item.isSoldOut) {
      changes.push({
        id: item.id,
        type: 'soldOut',
        label: '품절 전환',
        detail: `${item.roasterName} · ${item.productName}`,
      });
    }

    if (before.isSoldOut && !item.isSoldOut) {
      changes.push({
        id: item.id,
        type: 'restocked',
        label: '재입고',
        detail: `${item.roasterName} · ${item.productName}`,
      });
    }
  });

  return changes;
}

export function createMonitorSummary(products: BeanProduct[], sources: RoasterySource[]): MonitorSummary {
  const currentSnapshot = buildProductSnapshot(products);
  const savedSnapshot = loadSavedSnapshot();
  const previousSnapshot = savedSnapshot ?? fallbackPreviousSnapshot;

  return {
    sourceCount: sources.length,
    enabledSourceCount: sources.filter((source) => source.enabled).length,
    readySourceCount: sources.filter((source) => source.status === 'ready').length,
    productCount: products.length,
    soldOutCount: products.filter((product) => product.isSoldOut).length,
    newProductCount: products.filter((product) => product.isNew).length,
    changes: diffProductSnapshots(currentSnapshot, previousSnapshot),
    hasSavedBaseline: Boolean(savedSnapshot),
  };
}
