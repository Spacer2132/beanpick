export type ChannelType = 'officialMall' | 'smartStore' | 'selfHosted';
export type SourceStatus = 'ready' | 'planned' | 'paused';
export type AdapterKey = 'mockAdapter' | 'smartStoreAdapter' | 'officialHtmlAdapter';

export type RoasterySource = {
  id: string;
  roasterName: string;
  channelType: ChannelType;
  sourceUrl: string;
  adapterKey: AdapterKey;
  enabled: boolean;
  status: SourceStatus;
  productCount: number;
  lastCheckedAt: string;
  memo: string;
};

export const CHANNEL_LABEL: Record<ChannelType, string> = {
  officialMall: '공식몰',
  smartStore: '스마트스토어',
  selfHosted: '자사몰',
};

export const SOURCE_STATUS_LABEL: Record<SourceStatus, string> = {
  ready: '연동 가능',
  planned: '연동 예정',
  paused: '보류',
};

export const roasterySources: RoasterySource[] = [
  {
    id: 'fritz',
    roasterName: '프릳츠 커피 컴퍼니',
    channelType: 'officialMall',
    sourceUrl: 'https://fritz.co.kr',
    adapterKey: 'mockAdapter',
    enabled: true,
    status: 'ready',
    productCount: 1,
    lastCheckedAt: '3분 전',
    memo: '공식몰 상품 목록 구조를 확인할 예정입니다.',
  },
  {
    id: 'libre',
    roasterName: '커피리브레',
    channelType: 'officialMall',
    sourceUrl: 'https://coffeelibre.kr/product/list.html?cate_no=47',
    adapterKey: 'officialHtmlAdapter',
    enabled: true,
    status: 'ready',
    productCount: 0,
    lastCheckedAt: '수동 확인 전',
    memo: '원두 카테고리 공개 목록을 수동 버튼으로 불러옵니다.',
  },
  {
    id: 'namusairo',
    roasterName: '나무사이로',
    channelType: 'officialMall',
    sourceUrl: 'https://namusairo.com/category/coffee/91/',
    adapterKey: 'officialHtmlAdapter',
    enabled: true,
    status: 'ready',
    productCount: 0,
    lastCheckedAt: '수동 확인 전',
    memo: 'COFFEE 카테고리 공개 목록을 수동 버튼으로 불러옵니다.',
  },
  {
    id: 'momos',
    roasterName: '모모스커피',
    channelType: 'officialMall',
    sourceUrl: 'https://momos.co.kr/category/%EC%9B%90%EB%91%90/42/',
    adapterKey: 'officialHtmlAdapter',
    enabled: true,
    status: 'ready',
    productCount: 0,
    lastCheckedAt: '수동 확인 전',
    memo: '두 번째 실제 연동 대상입니다. 원두 카테고리 공개 목록을 수동 버튼으로 불러옵니다.',
  },
  {
    id: 'felt',
    roasterName: '펠트 커피',
    channelType: 'selfHosted',
    sourceUrl: 'https://feltcoffee.com',
    adapterKey: 'officialHtmlAdapter',
    enabled: true,
    status: 'planned',
    productCount: 1,
    lastCheckedAt: '21분 전',
    memo: 'HTML 구조 확인 후 어댑터를 연결합니다.',
  },
  {
    id: 'lowkey',
    roasterName: '로우키커피',
    channelType: 'officialMall',
    sourceUrl: 'https://en.lowkeycoffee.co.kr/category/coffee/24/',
    adapterKey: 'officialHtmlAdapter',
    enabled: true,
    status: 'ready',
    productCount: 0,
    lastCheckedAt: '수동 확인 전',
    memo: '공식 영문몰 공개 목록을 수동 버튼으로 불러옵니다. 달러 가격은 표시용 원화로 환산합니다.',
  },
  {
    id: 'werk',
    roasterName: '베르크커피',
    channelType: 'officialMall',
    sourceUrl: 'https://werk.co.kr/',
    adapterKey: 'officialHtmlAdapter',
    enabled: true,
    status: 'ready',
    productCount: 0,
    lastCheckedAt: '수동 확인 전',
    memo: '공식몰 메인 커피 목록을 수동 버튼으로 불러옵니다.',
  },
  {
    id: 'terarosa',
    roasterName: '테라로사',
    channelType: 'officialMall',
    sourceUrl: 'https://www.terarosa.com/market/product/list?categoryId=482',
    adapterKey: 'officialHtmlAdapter',
    enabled: true,
    status: 'ready',
    productCount: 0,
    lastCheckedAt: '수동 확인 전',
    memo: '첫 실제 연동 대상입니다. 공개 상품 목록을 수동 버튼으로 불러옵니다.',
  },
];
