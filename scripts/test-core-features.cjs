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

const lowerUnitPriceProduct = {
  id: 'unit-compare',
  productName: '단가 비교 원두',
  price: 5000,
  weight: 100,
  score: 70,
  tastingNotes: [],
  isSoldOut: false,
};
expect(
  core.sortProducts([grouped[0], lowerUnitPriceProduct], 'unitPriceAsc')[0]?.id === 'unit-compare',
  '묶인 카드는 최저 가격과 대표 용량을 섞지 말고 실제 가격 옵션의 100g당 단가로 정렬해야 합니다',
);
const representativePrice = core.getRepresentativePriceOption(grouped[0]);
expect(representativePrice.option?.weightLabel === '1kg', '목록 카드는 100g당 가장 싼 대표 용량 하나를 골라야 합니다', representativePrice.option?.weightLabel);
expect(representativePrice.extraCount === 2, '목록 카드는 숨겨진 다른 용량 개수를 알려줘야 합니다', String(representativePrice.extraCount));
expect(core.matchesCapacityFilter({ weight: 100 }, 'under100') === true, '100g 조건은 100g 상품을 포함해야 합니다');
expect(core.matchesCapacityFilter({ weight: 200 }, 'under100') === false, '100g 조건은 200g 상품을 제외해야 합니다');
expect(core.matchesCapacityFilter({ weight: 200 }, 'over200') === true, '200g 조건은 200g 상품을 포함해야 합니다');
expect(core.matchesCapacityFilter({ weight: 500 }, 'over500') === true, '500g 조건은 500g 상품을 포함해야 합니다');
expect(core.matchesCapacityFilter({ weight: 1000 }, 'exact1000') === true, '1kg 조건은 1000g 상품을 포함해야 합니다');
expect(core.matchesCapacityFilter({ weight: 1200 }, 'exact1000') === false, '1kg 조건은 1kg 초과 상품을 제외해야 합니다');
expect(
  core.matchesCapacityFilter({ weight: 200, priceOptions: [{ weight: 1000 }] }, 'exact1000') === true,
  '묶인 카드의 용량 필터는 숨겨진 가격 옵션 용량까지 봐야 합니다',
);

const discountCandidates = [
  { id: 'discount-30', price: 28000, originalPrice: 40000, tastingNotes: [], isSoldOut: false },
  { id: 'discount-20', price: 32000, originalPrice: 40000, tastingNotes: [], isSoldOut: false },
  { id: 'discount-15', price: 34000, originalPrice: 40000, tastingNotes: [], isSoldOut: false },
  { id: 'discount-10', price: 36000, originalPrice: 40000, tastingNotes: [], isSoldOut: false },
  { id: 'discount-9', price: 36400, originalPrice: 40000, tastingNotes: [], isSoldOut: false },
  { id: 'no-original-price', price: 22000, tastingNotes: [], isSoldOut: false },
];
const discountOnly = core.filterDiscountProducts(core.normalizeProducts(discountCandidates));
expect(JSON.stringify([...ids(discountOnly)].sort()) === JSON.stringify(['discount-10', 'discount-15', 'discount-20', 'discount-30']), '10% 이상 할인상품은 모두 할인 탭에 포함되어야 합니다', ids(discountOnly).join(', '));
expect(core.calculateDiscountRate(28000, 40000) === 0.3, '할인율은 원래가 대비 판매가로 계산되어야 합니다');
expect(core.isDiscountedProduct({ price: 36400, originalPrice: 40000, tastingNotes: [] }) === false, '10% 미만 할인은 소폭 할인으로 보고 제외되어야 합니다');
expect(core.isDiscountedProduct({ price: 22000, tastingNotes: [] }) === false, '원래가가 없으면 할인상품으로 추측하면 안 됩니다');
expect(core.calculateDiscountRate(1000, 19800) === 0, '옵션 추가금처럼 보이는 1,000원 가격은 할인율 계산에서 제외해야 합니다');

const suspiciousPriceProduct = core.normalizeProducts([{
  id: 'lubia-option-price',
  roasterName: '루비아 커피',
  productName: '에티오피아 구지 벤티 넨카 디카페인 200g',
  price: 1000,
  originalPrice: 19800,
  weight: 200,
  tastingNotes: [],
  isSoldOut: false,
}])[0];
expect(suspiciousPriceProduct.price === 19800, '옵션 추가금처럼 보이는 1,000원은 원래가로 보정되어야 합니다', String(suspiciousPriceProduct.price));
expect(!suspiciousPriceProduct.originalPrice && !suspiciousPriceProduct.discountRate, '보정된 가격은 할인 상품으로 표시하면 안 됩니다');
expect(suspiciousPriceProduct.unitPriceLabel === '9,900원/100g', '보정된 가격 기준 100g당 가격을 다시 계산해야 합니다', suspiciousPriceProduct.unitPriceLabel);

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
expect(groupedDiscount.length === 1 && core.isDiscountedProduct(groupedDiscount[0]), '묶인 원두 중 한 용량만 20% 이상 할인이어도 할인상품에 포함되어야 합니다');

// 루비아 뚱구리처럼 대용량 상품에만 [그란데] 수식어가 붙는 경우도 같은 원두로 묶여야 한다
const grandeGroup = core.groupProductsByNameAndWeight([
  {
    id: 'ddong-1kg',
    roasterName: '루비아 커피',
    productName: '[그란데] 케냐 니에리 뚱구리 AA TOP 워시드 라이트 로스트',
    price: 52000,
    weight: 1000,
    score: 80,
    tastingNotes: [],
    productUrl: 'https://example.com/ddong-1kg',
    imageUrl: '',
    isSoldOut: false,
    isNew: false,
    checkedMinutesAgo: 5,
  },
  {
    id: 'ddong-200g',
    roasterName: '루비아 커피',
    productName: '케냐 니에리 뚱구리 AA TOP 워시드 라이트 로스트',
    price: 14000,
    weight: 200,
    score: 80,
    tastingNotes: [],
    productUrl: 'https://example.com/ddong-200g',
    imageUrl: '',
    isSoldOut: false,
    isNew: false,
    checkedMinutesAgo: 5,
  },
]);
expect(grandeGroup.length === 1, '[그란데] 수식어가 붙은 용량도 같은 원두로 묶여야 합니다', String(grandeGroup.length));
expect(grandeGroup[0]?.priceOptions.length === 2, '묶인 뚱구리 카드에 200g·1kg 가격 옵션이 모두 남아야 합니다', String(grandeGroup[0]?.priceOptions.length));

// 표기 차이(접두 라벨·띄어쓰기·요청불가)만 다른 같은 원두는 한 카드로 묶여야 한다
function groupNames(names) {
  return core.groupProductsByNameAndWeight(names.map((productName, index) => ({
    id: `g-${index}`,
    roasterName: '테스트커피',
    productName,
    price: 20000 + index * 1000,
    weight: 200 + index * 100,
    score: 80,
    tastingNotes: [],
    productUrl: `https://example.com/g-${index}`,
    imageUrl: '',
    isSoldOut: false,
    isNew: false,
    checkedMinutesAgo: 5,
  })));
}
expect(groupNames(['[6월 먼슬리] 과테말라 세이바 풀리 워시드', '[그란데] 과테말라 세이바 풀리 워시드']).length === 1, '행사/대용량 접두 라벨만 다르면 묶여야 합니다');
expect(groupNames(['콜롬비아 엘 파라이소 리치 피치 라이트', '콜롬비아 엘 파라이소 리치피치 라이트']).length === 1, '띄어쓰기만 다른 같은 원두는 묶여야 합니다');
expect(groupNames(['칠린 블렌드', '칠린 블렌드 ( 요청불가)']).length === 1, '(요청불가) 같은 안내 문구만 다르면 묶여야 합니다');
// 반대로, 상품이 실제로 다른 표기([생두]·[디카페인])는 묶이면 안 된다
expect(groupNames(['에티오피아 첼베사 워시드', '[생두] 에티오피아 첼베사 워시드']).length === 2, '생두/원두처럼 실제로 다른 상품은 묶이면 안 됩니다');
expect(groupedDiscount[0]?.priceOptions.some((option) => option.weightLabel === '500g' && option.originalPrice === 40000 && option.discountRate >= 0.3), '용량별 가격 옵션은 원래가와 할인율을 보존해야 합니다');

const featuredPicks = core.pickFeaturedProducts([
  { id: 'normal-high-score', productName: '평범한 블렌드 200g', origin: 'Blend', score: 99 },
  { id: 'geisha-low-score', productName: 'Panama Geisha Washed 100g', origin: 'Panama', score: 60 },
  { id: 'pacamara-low-score', productName: 'El Salvador Pacamara Natural 200g', origin: 'El Salvador', score: 58 },
  { id: 'sidra-low-score', productName: 'Colombia El Paraiso 200g', variety: '시드라', origin: 'Colombia', score: 55 },
  { id: 'normal-mid-score', productName: '과테말라 워시드 200g', origin: 'Guatemala', score: 80 },
], 4);
expect(featuredPicks.map((product) => product.id).join(',') === 'geisha-low-score,pacamara-low-score,sidra-low-score,normal-mid-score', '추천 원두는 게이샤, 파카마라, 시드라를 먼저 포함하고 블렌드는 제외해야 합니다', featuredPicks.map((product) => product.id).join(','));

const manyVarietyPicks = core.pickFeaturedProducts([
  { id: 'geisha-1', productName: 'Panama Geisha A 100g', origin: 'Panama', score: 90 },
  { id: 'geisha-2', productName: 'Colombia Geisha B 100g', origin: 'Colombia', score: 88 },
  { id: 'geisha-3', productName: 'Ethiopia Geisha C 100g', origin: 'Ethiopia', score: 86 },
  { id: 'pacamara-1', productName: 'El Salvador Pacamara 200g', origin: 'El Salvador', score: 84 },
  { id: 'sidra-1', productName: 'Colombia Sidra 200g', origin: 'Colombia', score: 82 },
  { id: 'normal-1', productName: '과테말라 워시드 200g', origin: 'Guatemala', score: 95 },
], 4);
expect(manyVarietyPicks.map((product) => product.id).join(',') === 'geisha-1,geisha-2,geisha-3,pacamara-1,sidra-1', '특수 품종은 추천 개수 제한과 상관없이 전부 포함되어야 합니다', manyVarietyPicks.map((product) => product.id).join(','));

expect(core.getChoseong('에티오피아') === 'ㅇㅌㅇㅍㅇ', '초성 추출이 정확해야 합니다', core.getChoseong('에티오피아'));
expect(core.getChoseong('블루베리 200g') === 'ㅂㄹㅂㄹ 200g', '한글이 아닌 글자는 그대로 남아야 합니다', core.getChoseong('블루베리 200g'));
expect(core.matchesSmartSearch('에티오피아 예가체프 워시드', 'ㅇㄱㅊㅍ') === true, '초성 검색이 동작해야 합니다');
expect(core.matchesSmartSearch('에티오피아 예가체프', '에티오피아예가') === true, '띄어쓰기를 무시하고 검색되어야 합니다');
expect(core.matchesSmartSearch('에티오피아 예가체프', '예가 에티') === true, '여러 단어는 모두 포함되면 매칭되어야 합니다');
expect(core.matchesSmartSearch('에티오피아 예가체프', '케냐') === false, '없는 단어는 매칭되면 안 됩니다');
expect(core.matchesSmartSearch('콜롬비아 게이샤', '') === true, '빈 검색어는 전체 매칭이어야 합니다');

const noteQueryProduct = { tastingNotes: ['밀크초콜릿', '헤이즐넛', '캐러멜'] };
expect(core.matchesNoteQuery(noteQueryProduct, '초콜릿 캐러멜', '') === true, '포함 단어가 노트에 모두 있으면 매칭되어야 합니다');
expect(core.matchesNoteQuery(noteQueryProduct, '초콜릿 오렌지', '') === false, '포함 단어 중 하나라도 없으면 제외되어야 합니다');
expect(core.matchesNoteQuery(noteQueryProduct, '', '초콜릿') === false, '제외 단어가 노트에 있으면 걸러져야 합니다');
expect(core.matchesNoteQuery(noteQueryProduct, '캐러멜', '오렌지, 플로럴') === true, '제외 단어가 노트에 없으면 통과해야 합니다');
expect(core.matchesNoteQuery(noteQueryProduct, '', '') === true, '둘 다 비어 있으면 전체 통과여야 합니다');
expect(core.matchesNoteQuery({ tastingNotes: [] }, '초콜릿', '') === false, '노트가 없는 원두는 포함 검색에서 제외되어야 합니다');

expect(core.getTasteNoteGroup('오렌지') === 'light', '오렌지는 라이트 그룹이어야 합니다');
expect(core.getTasteNoteGroup('버터스카치') === 'medium', '버터스카치는 미디움 그룹이어야 합니다');
expect(core.getTasteNoteGroup('다크초콜릿') === 'dark', '다크초콜릿은 다크 그룹이어야 합니다');
expect(core.getTasteNoteGroup('샤인머스캣') === 'light', '샤인머스캣은 라이트 그룹이어야 합니다');
expect(core.isRealProductUrl('https://example.com/product') === true, '실제 상품 링크는 클릭 가능한 링크로 인정되어야 합니다');
expect(core.isRealProductUrl('https://beanpick.local/mock/test') === false, '샘플 로컬 링크는 실제 상품 링크로 인정하면 안 됩니다');
expect(core.isRealProductUrl('https://smartstore.naver.com/main/products/13181681419') === false, '네이버 main 상품 링크는 로그인 화면으로 갈 수 있어 직접 링크로 인정하면 안 됩니다');

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

const sidraDisplayInfo = core.formatProductDisplayInfo({
  productName: '콜롬비아 엘 파라이소 시드라 내추럴 200g',
  origin: 'Colombia',
  process: 'Natural',
});
expect(sidraDisplayInfo.variety === '시드라', '시드라 품종도 카드 정보에 표시되어야 합니다', JSON.stringify(sidraDisplayInfo));

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
