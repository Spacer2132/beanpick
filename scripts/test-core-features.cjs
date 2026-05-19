const fs = require('node:fs');
const esbuild = require('esbuild');
const tastingNoteTools = require('../src/services/tastingNotes.cjs');

function loadJsModule(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const output = esbuild.transformSync(code, { loader: 'js', format: 'cjs', target: 'es2020' }).code;
  const module = { exports: {} };

  new Function('exports', 'module', 'require', output)(module.exports, module, (request) => {
    if (String(request).includes('tastingNotes')) return tastingNoteTools;
    return {};
  });
  return module.exports;
}

const core = loadJsModule('src/services/coreFeatures.js');
const failures = [];

function expect(condition, message, details = '') {
  if (!condition) failures.push(`${message}${details ? `: ${details}` : ''}`);
}

function ids(products) {
  return products.map((product) => product.id).sort();
}

const baseProducts = [
  {
    id: 'orange-available',
    roasterName: '센터커피',
    productName: '콜롬비아 세로 아줄 게이샤 허니 200g',
    origin: 'Colombia',
    process: 'Honey',
    roastLevel: 'Light',
    price: 22000,
    weight: 200,
    score: 90,
    tastingNotes: ['오렌지', '샤인머스캣'],
    productUrl: 'https://example.com/orange-200',
    isSoldOut: false,
    checkedMinutesAgo: 10,
  },
  {
    id: 'chocolate-soldout',
    roasterName: '테스트커피',
    productName: '초콜릿 블렌드 200g',
    origin: 'Blend',
    process: 'Blend',
    roastLevel: 'Medium',
    price: 18000,
    weight: 200,
    score: 80,
    tastingNotes: ['초콜릿'],
    productUrl: 'https://example.com/chocolate-200',
    isSoldOut: true,
    checkedMinutesAgo: 20,
  },
  {
    id: 'berry-available',
    roasterName: '테스트커피',
    productName: '베리 싱글오리진 200g',
    origin: 'Ethiopia',
    process: 'Natural',
    roastLevel: 'Light',
    price: 25000,
    weight: 200,
    score: 85,
    tastingNotes: ['베리'],
    productUrl: 'https://example.com/berry-200',
    isSoldOut: false,
    checkedMinutesAgo: 5,
  },
];

const orFiltered = core.filterProductsBySearchAndNotes(baseProducts, '', ['오렌지', '초콜릿']);
expect(
  JSON.stringify(ids(orFiltered)) === JSON.stringify(['chocolate-soldout', 'orange-available']),
  '테이스팅노트 다중 선택은 OR 조건으로 동작해야 합니다',
  ids(orFiltered).join(', '),
);

const stockCounts = core.getStockCounts(orFiltered);
expect(stockCounts.all === 2 && stockCounts.available === 1 && stockCounts.soldout === 1, '판매상태 숫자는 현재 필터 결과 안에서 계산되어야 합니다', JSON.stringify(stockCounts));
expect(core.filterProductsByStockStatus(orFiltered, 'available').length === 1, '판매 중 탭은 판매 중 상품만 남겨야 합니다');
expect(core.filterProductsByStockStatus(orFiltered, 'soldout')[0]?.id === 'chocolate-soldout', '품절 탭은 품절 상품만 남겨야 합니다');

const grouped = core.groupProductsByNameAndWeight([
  {
    id: 'blend-200',
    roasterName: '테스트커피',
    productName: '데일리 블렌드 200g',
    price: 15000,
    weight: 200,
    score: 80,
    tastingNotes: ['Chocolate', 'Brazil', 'Washed'],
    productUrl: 'https://example.com/blend-200',
    imageUrl: '',
    isSoldOut: false,
    isNew: false,
    checkedMinutesAgo: 12,
  },
  {
    id: 'blend-500',
    roasterName: '테스트커피',
    productName: '데일리 블렌드 500g',
    price: 32000,
    weight: 500,
    score: 82,
    tastingNotes: ['Orange'],
    productUrl: 'https://example.com/blend-500',
    imageUrl: '',
    isSoldOut: false,
    isNew: true,
    checkedMinutesAgo: 8,
  },
  {
    id: 'blend-1000',
    roasterName: '테스트커피',
    productName: '데일리 블렌드 1kg',
    price: 59000,
    weight: 1000,
    score: 84,
    tastingNotes: ['Green Apple'],
    productUrl: 'https://example.com/blend-1000',
    imageUrl: '',
    isSoldOut: false,
    isNew: false,
    checkedMinutesAgo: 6,
  },
]);

expect(grouped.length === 1, '같은 원두명은 용량별로 한 카드에 묶여야 합니다', String(grouped.length));
expect(grouped[0]?.productName === '데일리 블렌드', '묶인 카드명에서는 용량 문구가 제거되어야 합니다', grouped[0]?.productName);
expect(grouped[0]?.priceOptions.length === 3, '묶인 카드에는 용량별 가격 옵션이 모두 남아야 합니다', String(grouped[0]?.priceOptions.length));
expect(
  grouped[0]?.priceOptions.some((option) => option.weightLabel === '1kg' && option.productUrl === 'https://example.com/blend-1000'),
  '가격 옵션은 자기 상품 링크를 유지해야 합니다',
);
expect(grouped[0]?.priceOptions[0]?.unitPriceLabel === '7,500원/100g', '100g당 가격 표기는 가격 옵션에 남아야 합니다', grouped[0]?.priceOptions[0]?.unitPriceLabel);
expect(grouped[0]?.tastingNotes.includes('초콜릿') && grouped[0]?.tastingNotes.includes('오렌지') && grouped[0]?.tastingNotes.includes('청사과'), '묶인 카드의 테이스팅노트는 한글 대표 태그로 합쳐져야 합니다', grouped[0]?.tastingNotes.join(', '));
expect(!grouped[0]?.tastingNotes.includes('Brazil') && !grouped[0]?.tastingNotes.includes('Washed'), '나라명과 가공방식은 테이스팅노트로 남으면 안 됩니다', grouped[0]?.tastingNotes.join(', '));

const discountCandidates = [
  { id: 'discount-30', price: 28000, originalPrice: 40000, tastingNotes: [], isSoldOut: false },
  { id: 'discount-25', price: 30000, originalPrice: 40000, tastingNotes: [], isSoldOut: false },
  { id: 'no-original-price', price: 22000, tastingNotes: [], isSoldOut: false },
];
const discountOnly = core.filterDiscountProducts(core.normalizeProducts(discountCandidates));
expect(JSON.stringify(ids(discountOnly)) === JSON.stringify(['discount-30']), '30% 이상 할인상품만 할인 탭에 포함되어야 합니다', ids(discountOnly).join(', '));
expect(core.calculateDiscountRate(28000, 40000) === 0.3, '할인율은 원래가 대비 판매가로 계산되어야 합니다');
expect(core.isDiscountedProduct({ price: 30000, originalPrice: 40000, tastingNotes: [] }) === false, '25% 할인은 할인상품 기준에서 제외되어야 합니다');
expect(core.isDiscountedProduct({ price: 22000, tastingNotes: [] }) === false, '원래가가 없으면 할인상품으로 추측하면 안 됩니다');

const groupedDiscount = core.groupProductsByNameAndWeight([
  {
    id: 'sale-blend-200',
    roasterName: '테스트커피',
    productName: '세일 블렌드 200g',
    price: 20000,
    weight: 200,
    score: 80,
    tastingNotes: ['Chocolate'],
    productUrl: 'https://example.com/sale-200',
    imageUrl: '',
    isSoldOut: false,
    isNew: false,
    checkedMinutesAgo: 12,
  },
  {
    id: 'sale-blend-500',
    roasterName: '테스트커피',
    productName: '세일 블렌드 500g',
    price: 28000,
    originalPrice: 40000,
    weight: 500,
    score: 81,
    tastingNotes: ['Orange'],
    productUrl: 'https://example.com/sale-500',
    imageUrl: '',
    isSoldOut: false,
    isNew: false,
    checkedMinutesAgo: 8,
  },
]);
expect(groupedDiscount.length === 1 && core.isDiscountedProduct(groupedDiscount[0]), '묶인 원두 중 한 용량만 30% 이상 할인이어도 할인상품에 포함되어야 합니다');
expect(groupedDiscount[0]?.priceOptions.some((option) => option.weightLabel === '500g' && option.originalPrice === 40000 && option.discountRate >= 0.3), '용량별 가격 옵션은 원래가와 할인율을 보존해야 합니다');

expect(core.getTasteNoteGroup('오렌지') === 'light', '오렌지는 라이트 그룹이어야 합니다');
expect(core.getTasteNoteGroup('버터스카치') === 'medium', '버터스카치는 미디움 그룹이어야 합니다');
expect(core.getTasteNoteGroup('다크초콜릿') === 'dark', '다크초콜릿은 다크 그룹이어야 합니다');
expect(core.getTasteNoteGroup('샤인머스캣') === 'light', '샤인머스캣은 라이트 그룹이어야 합니다');
expect(core.isRealProductUrl('https://example.com/product') === true, '실제 상품 링크는 클릭 가능한 링크로 인정되어야 합니다');
expect(core.isRealProductUrl('https://beanpick.local/mock/test') === false, '샘플 로컬 링크는 실제 상품 링크로 인정하면 안 됩니다');

const displayInfo = core.formatProductDisplayInfo({
  productName: '원두 온드라스 COE 라 페냐 파카스 워시드 200g',
  origin: 'Honduras',
  process: 'Washed',
});
expect(displayInfo.primary === '온두라스 - 파카스', '카드 첫 줄은 나라-품종(한글)으로 정리되어야 합니다', JSON.stringify(displayInfo));
expect(displayInfo.process === '워시드', '카드 둘째 줄은 가공법을 보여줘야 합니다', JSON.stringify(displayInfo));
expect(displayInfo.farm === '라 페냐', '카드 셋째 줄은 농장을 보여줘야 합니다', JSON.stringify(displayInfo));
expect(displayInfo.variety === '파카스', '품종 정보는 데이터에 남아 있어야 합니다', JSON.stringify(displayInfo));
expect(!displayInfo.primary.includes('200g'), '카드 표시용 원두 정보에는 그램 수가 들어가면 안 됩니다', JSON.stringify(displayInfo));

const sourceText = `${fs.readFileSync('src/data/roasterySources.ts', 'utf8')}\n${fs.readFileSync('src/data/mockBeans.ts', 'utf8')}`;
expect(!/펠트|felt/i.test(sourceText), '펠트커피는 로스터리와 샘플 원두에서 제외되어 있어야 합니다');

const removedRoasteryText = [
  'src/App.jsx',
  'src/data/roasterySources.ts',
  'src/data/mockBeans.ts',
  'src/services/adapters/officialMallConfigs.ts',
  'src/services/monitoring.ts',
  'electron/main.cjs',
].map((file) => fs.readFileSync(file, 'utf8')).join('\n');
expect(!/lowkey|lowkeycoffee|로우키/i.test(removedRoasteryText), '로우키커피는 등록과 샘플에서 완전히 제외되어 있어야 합니다');

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`실패: ${failure}`));
  process.exitCode = 1;
} else {
  console.log('핵심 기능 계약 테스트 통과');
}
