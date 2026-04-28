import type { BeanProduct } from '../../data/mockBeans';

export type FetchProductsResult = {
  products: BeanProduct[];
  fetchedAt: string;
  sourceUrl: string;
  usedFallback?: boolean;
  warning?: string;
};

export type RoasteryAdapter = {
  sourceId: string;
  sourceUrl: string;
  fetchProducts(): Promise<FetchProductsResult>;
  parseProducts(html: string): BeanProduct[];
};
