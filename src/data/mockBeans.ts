export type SortMode = 'score' | 'latest' | 'price' | 'unitPriceAsc' | 'unitPriceDesc';

export type BeanProduct = {
  id: string;
  roasterName: string;
  productName: string;
  origin: string;
  process: string;
  roastLevel: string;
  price: number;
  originalPrice?: number;
  discountRate?: number;
  weight: number;
  score: number;
  tastingNotes: string[];
  productUrl: string;
  imageUrl: string;
  isSoldOut: boolean;
  isNew: boolean;
  lastCheckedAt: string;
  checkedMinutesAgo: number;
  variety?: string;
  farm?: string;
  blendComposition?: Array<{ country: string; percent: number }>;
};

export const mockBeans: BeanProduct[] = [
  {
    id: 'fritz-worka-sakaro',
    roasterName: '프릳츠 커피 컴퍼니',
    productName: 'Ethiopia Worka Sakaro Natural',
    origin: 'Ethiopia · Yirgacheffe',
    process: 'Natural',
    roastLevel: 'Light',
    price: 28000,
    originalPrice: 40000,
    weight: 200,
    score: 92,
    tastingNotes: ['Blueberry', 'Floral', 'Honey'],
    productUrl: 'https://beanpick.local/mock/fritz-worka-sakaro',
    imageUrl: '/images/bean-ethiopia.jpg',
    isSoldOut: false,
    isNew: true,
    lastCheckedAt: '3분 전',
    checkedMinutesAgo: 3,
  },
  {
    id: 'libre-pink-bourbon',
    roasterName: '커피리브레',
    productName: 'Colombia La Pradera Pink Bourbon',
    origin: 'Colombia · Huila',
    process: 'Anaerobic Washed',
    roastLevel: 'Light-Medium',
    price: 32000,
    weight: 200,
    score: 88,
    tastingNotes: ['Tropical', 'Lychee', 'Wine'],
    productUrl: 'https://beanpick.local/mock/libre-pink-bourbon',
    imageUrl: '/images/bean-colombia.jpg',
    isSoldOut: false,
    isNew: false,
    lastCheckedAt: '8분 전',
    checkedMinutesAgo: 8,
  },
  {
    id: 'momos-janson-geisha',
    roasterName: '모모스커피',
    productName: 'Panama Janson Esmeralda Geisha',
    origin: 'Panama · Boquete',
    process: 'Washed',
    roastLevel: 'Light',
    price: 64000,
    weight: 100,
    score: 96,
    tastingNotes: ['Jasmine', 'Bergamot', 'Peach'],
    productUrl: 'https://beanpick.local/mock/momos-janson-geisha',
    imageUrl: '/images/bean-costa-rica.jpg',
    isSoldOut: false,
    isNew: true,
    lastCheckedAt: '12분 전',
    checkedMinutesAgo: 12,
  },
  {
    id: 'namusairo-brazil-cerrado',
    roasterName: '나무사이로',
    productName: 'Brazil Cerrado Pulped Natural',
    origin: 'Brazil · Cerrado',
    process: 'Pulped Natural',
    roastLevel: 'Medium',
    price: 22000,
    weight: 200,
    score: 78,
    tastingNotes: ['Nutty', 'Chocolate', 'Caramel'],
    productUrl: 'https://beanpick.local/mock/namusairo-brazil-cerrado',
    imageUrl: '/images/bean-brazil.jpg',
    isSoldOut: true,
    isNew: false,
    lastCheckedAt: '28분 전',
    checkedMinutesAgo: 28,
  },
  {
    id: 'anthracite-guatemala',
    roasterName: '앤트러사이트 커피',
    productName: 'Guatemala El Injerto Bourbon',
    origin: 'Guatemala · Huehuetenango',
    process: 'Washed',
    roastLevel: 'Medium-Light',
    price: 27000,
    weight: 200,
    score: 86,
    tastingNotes: ['Orange', 'Brown Sugar', 'Almond'],
    productUrl: 'https://beanpick.local/mock/anthracite-guatemala',
    imageUrl: '/images/bean-guatemala.jpg',
    isSoldOut: true,
    isNew: true,
    lastCheckedAt: '42분 전',
    checkedMinutesAgo: 42,
  },
  {
    id: 'terarosa-ethiopia-guji',
    roasterName: '테라로사',
    productName: 'Ethiopia Guji Hambela',
    origin: 'Ethiopia · Guji',
    process: 'Natural',
    roastLevel: 'Light',
    price: 25000,
    weight: 250,
    score: 83,
    tastingNotes: ['Strawberry', 'Tea-like', 'Cacao'],
    productUrl: 'https://beanpick.local/mock/terarosa-ethiopia-guji',
    imageUrl: '/images/bean-ethiopia.jpg',
    isSoldOut: false,
    isNew: false,
    lastCheckedAt: '1시간 전',
    checkedMinutesAgo: 60,
  },
];

export const dashboardStats = [
  { label: '추천 원두', value: String(mockBeans.length), delta: '+8' },
  { label: '새 상품', value: String(mockBeans.filter((bean) => bean.isNew).length), delta: '+3' },
  { label: '판매 중', value: String(mockBeans.filter((bean) => !bean.isSoldOut).length), delta: '+5' },
  { label: '품절', value: String(mockBeans.filter((bean) => bean.isSoldOut).length), delta: '-1' },
];

export const priceTrend = [72, 68, 74, 79, 76, 82, 85, 80, 88, 84, 91, 87, 93, 90];
