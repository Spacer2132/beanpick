import type { Cafe24SourceConfig } from './cafe24OfficialAdapter';

export const OFFICIAL_MALL_CONFIGS: Record<string, Cafe24SourceConfig> = {
  namusairo: {
    sourceId: 'namusairo',
    roasterName: '나무사이로',
    sourceUrl: 'https://namusairo.com/category/coffee/91/',
    origin: 'https://namusairo.com',
    defaultWeight: 200,
    blockedWords: ['선물세트', '드립백', '파우더'],
  },
  coffeelibre: {
    sourceId: 'coffeelibre',
    roasterName: '커피리브레',
    sourceUrl: 'https://coffeelibre.kr/product/list.html?cate_no=47',
    origin: 'https://coffeelibre.kr',
    defaultWeight: 200,
    blockedWords: ['생두'],
  },
  lowkey: {
    sourceId: 'lowkey',
    roasterName: '로우키커피',
    sourceUrl: 'https://en.lowkeycoffee.co.kr/category/coffee/24/',
    origin: 'https://en.lowkeycoffee.co.kr',
    defaultWeight: 200,
    priceMultiplier: 1350,
    blockedWords: ['drip bag', 'cold brew', 'liquid', 'gift set'],
  },
  werk: {
    sourceId: 'werk',
    roasterName: '베르크커피',
    sourceUrl: 'https://werk.co.kr/',
    origin: 'https://werk.co.kr',
    defaultWeight: 200,
    blockedWords: ['캡슐', '콜드브루', '인스턴트', '드립백', '기프트'],
  },
};
