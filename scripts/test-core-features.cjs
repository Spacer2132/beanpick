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
expect(core.matchesCapacityFilter({ weight: 1200 }, 'exact1000') === true, '1kg 조건은 1kg 초과 2kg 이하 상품도 포함해야 합니다');
expect(core.matchesCapacityFilter({ weight: 2001 }, 'exact1000') === false, '1kg 조건은 2kg 초과 상품을 제외해야 합니다');
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

// 용량이 섞인 오염 데이터: 상단 price(200g 판매가) + originalPrice(1kg 정상가)가 묶여 할인율이 부풀려지면 안 된다.
// 옵션별 실제 할인(여기선 1kg 23.5%)만 반영되어야 한다.
const crossWeightProduct = core.normalizeProducts([{
  id: 'cross-weight-blend',
  roasterName: '아이덴티티커피랩',
  productName: '칠린 블렌드',
  price: 11000,
  originalPrice: 51000,
  weight: 1000,
  tastingNotes: [],
  isSoldOut: false,
  priceOptions: [
    { id: '200g-11000', price: 11000, weight: 200 },
    { id: '500g-23000', price: 23000, originalPrice: 26000, weight: 500 },
    { id: '1kg-39000', price: 39000, originalPrice: 51000, weight: 1000 },
  ],
}])[0];
expect(Math.round((crossWeightProduct.discountRate || 0) * 100) === 24, '용량이 섞인 상단 가격쌍이 아니라 옵션 기준(1kg 23.5%) 할인율을 써야 합니다', String(crossWeightProduct.discountRate));
expect(crossWeightProduct.originalPrice === undefined, '용량 옵션이 있으면 상단 originalPrice(1kg 정상가)를 200g 판매가에 붙이면 안 됩니다', String(crossWeightProduct.originalPrice));
expect(core.isDiscountedProduct(crossWeightProduct) === true, '실제 할인(23.5%) 상품은 할인 탭에 포함되어야 합니다');
// 같은 오염 상품을 할인율 정렬에 넣어도 78%가 아니라 23.5%로 취급되어 진짜 큰 할인 뒤에 와야 한다
const realBigDiscount = core.normalizeProducts([{ id: 'real-50', price: 20000, originalPrice: 40000, weight: 200, tastingNotes: [], isSoldOut: false }])[0];
const sortedByDiscount = core.sortProducts([crossWeightProduct, realBigDiscount], 'discount');
expect(sortedByDiscount[0]?.id === 'real-50', '할인율 정렬은 부풀려진 78%가 아니라 실제 23.5%로 비교해야 합니다', sortedByDiscount.map((p) => p.id).join(','));

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
expect(core.matchesSmartSearch('[6월의 커피] 에콰도르 루그마파타 시드라 워시드', 'ㅅㄷㄹ') === true, '시드라 초성 검색이 동작해야 합니다');
expect(core.matchesSmartSearch('게이샤,시드라', 'ㅅㄷㄹ') === true, '쉼표 뒤 단어도 초성 검색되어야 합니다');
expect(core.matchesSmartSearch('콜롬비아/에티오피아', 'ㅇㅌㅇㅍㅇ') === true, '슬래시 뒤 단어도 초성 검색되어야 합니다');
expect(core.matchesSmartSearch('[시즌]시드라', 'ㅅㄷㄹ') === true, '대괄호 뒤 단어도 초성 검색되어야 합니다');
expect(core.matchesSmartSearch('온두라스 마르칼라 마리&모이 카투아이 워시드', 'ㅁㅇ') === true, '앰퍼샌드 뒤 단어도 초성 검색되어야 합니다');
expect(core.matchesSmartSearch('🔥에티오피아 예가체프', 'ㅇㅌㅇㅍㅇ') === true, '이모지 뒤 단어도 초성 검색되어야 합니다');
expect(core.matchesSmartSearch('에티오피아 예가체프', '에티오피아예가') === true, '띄어쓰기를 무시하고 검색되어야 합니다');
expect(core.matchesSmartSearch('풀리 워시드', '풀리워시드') === true, '띄어쓰기 제거 검색은 계속 동작해야 합니다');
expect(core.matchesSmartSearch('케냐 니에리 뚱구리 AA TOP 워시드 라이트 로스트', '시드라') === false, '단어 경계를 넘어 만들어진 시드라는 매칭되면 안 됩니다');
expect(core.matchesSmartSearch('워시드 라이트', '드라이') === false, '단어 경계를 넘어 만들어진 드라이는 매칭되면 안 됩니다');
expect(core.matchesSmartSearch('[6월의 커피] 에콰도르 루그마파타 시드라 워시드', '시드라') === true, '실제 시드라 품종은 검색되어야 합니다');
expect(core.matchesSmartSearch('에티오피아 예가체프', '예가 에티') === true, '여러 단어는 모두 포함되면 매칭되어야 합니다');
expect(core.matchesSmartSearch('에티오피아 예가체프 워시드', '에티오피아 워시드') === true, '여러 단어 AND 검색이 유지되어야 합니다');
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
expect(core.isRealProductUrl('javascript:alert(1)') === false, '실행형 주소는 상품 링크로 인정하면 안 됩니다');
expect(core.isRealProductUrl('/products/bean-a') === false, '상대 경로는 외부 상품 링크로 인정하면 안 됩니다');

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

const boliviaDisplayInfo = core.formatProductDisplayInfo({
  productName: '볼리비아 일리마니 자바 워시드 200g',
  origin: '토치커피',
  process: '',
});
expect(!boliviaDisplayInfo.primary.startsWith('블렌드 -'), '상품명에 나라 이름이 있으면 블렌드로 표시하면 안 됩니다', JSON.stringify(boliviaDisplayInfo));

const typoEthiopiaDisplayInfo = core.formatProductDisplayInfo({
  productName: '디카페인 에티오파이 시다마 벤사 MWP 200g',
  origin: '커피정경',
  process: '',
});
expect(!typoEthiopiaDisplayInfo.primary.startsWith('블렌드 -'), '에티오피아 오타형도 나라 이름으로 보고 블렌드 표시를 막아야 합니다', JSON.stringify(typoEthiopiaDisplayInfo));

const processOnlyDisplayInfo = core.formatProductDisplayInfo({
  productName: '라 로마 워시드 200g',
  process: 'Washed',
});
expect(!processOnlyDisplayInfo.primary.startsWith('블렌드 -') && processOnlyDisplayInfo.process === '워시드', '가공법이 있는 단일 원두 후보는 블렌드로 추정하면 안 됩니다', JSON.stringify(processOnlyDisplayInfo));

const blendDisplayInfo = core.formatProductDisplayInfo({
  productName: '칠린 블렌드 200g',
  process: 'Blend',
});
expect(blendDisplayInfo.primary === '블렌드 - 칠린', '블렌드 원두는 이름 앞에 블렌드 접두어가 붙고 뒤쪽 블렌드는 중복 표시하면 안 됩니다', JSON.stringify(blendDisplayInfo));
expect(blendDisplayInfo.process === '' && blendDisplayInfo.farm === '', '블렌드 원두는 부제 줄 대신 테이스팅 노트를 우선 보여줘야 합니다', JSON.stringify(blendDisplayInfo));

const prefixedBlendDisplayInfo = core.formatProductDisplayInfo({
  productName: '블렌드 원두 200g',
  process: 'Blend',
});
expect(prefixedBlendDisplayInfo.primary === '블렌드 - 원두', '이미 블렌드로 시작하는 이름은 블렌드를 중복 표시하면 안 됩니다', JSON.stringify(prefixedBlendDisplayInfo));

const momosBeanPrefixBlendDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '모모스커피',
  productName: '원두 에스쇼콜라 200g',
});
expect(momosBeanPrefixBlendDisplayInfo.primary === '블렌드 - 에스쇼콜라', '모모스처럼 원두 접두어가 붙은 블렌드는 원두를 중복 표시하면 안 됩니다', JSON.stringify(momosBeanPrefixBlendDisplayInfo));

const momosDashedBeanPrefixBlendDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '모모스커피',
  productName: '원두 - 에스쇼콜라 200g',
});
expect(momosDashedBeanPrefixBlendDisplayInfo.primary === '블렌드 - 에스쇼콜라', '원두 - 이름 형식도 블렌드 이름만 남겨야 합니다', JSON.stringify(momosDashedBeanPrefixBlendDisplayInfo));

const momosExplicitBlendPrefixDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '모모스커피',
  productName: '원두 블렌드 에스쇼콜라 200g',
});
expect(momosExplicitBlendPrefixDisplayInfo.primary === '블렌드 - 에스쇼콜라', '원두 뒤에 블렌드가 있어도 블렌드를 중복 표시하면 안 됩니다', JSON.stringify(momosExplicitBlendPrefixDisplayInfo));

const hitteRevolveDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '히떼 로스터리',
  productName: '리볼브 200g',
});
expect(hitteRevolveDisplayInfo.primary === '블렌드 - 리볼브', '히떼 리볼브는 고유명 암묵 블렌드로 표시해야 합니다', JSON.stringify(hitteRevolveDisplayInfo));

const coffeeJgSoroDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '커피정경 로스터리',
  productName: '배합커피#1 소로 200g',
});
expect(coffeeJgSoroDisplayInfo.primary === '블렌드 - 배합커피#1 소로', '커피정경 배합커피#1 소로는 블렌드로 표시해야 합니다', JSON.stringify(coffeeJgSoroDisplayInfo));

const rubiaHwacheDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '루비아 커피',
  productName: '여름 시즈널 블렌딩 화채(Hwache) 수박맛 커피 200g',
});
expect(rubiaHwacheDisplayInfo.primary === '블렌드 - 여름 시즈널 화채 수박맛', '루비아 여름 시즈널 블렌딩 화채는 블렌드로 표시해야 합니다', JSON.stringify(rubiaHwacheDisplayInfo));

const filloutCinnamonDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '필아웃커피',
  productName: '시나몬 게이트 원두 200g',
});
expect(filloutCinnamonDisplayInfo.primary === '블렌드 - 시나몬 게이트', '필아웃 시나몬 게이트 원두는 블렌드로 표시해야 합니다', JSON.stringify(filloutCinnamonDisplayInfo));

const momosDashedExplicitBlendPrefixDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '모모스커피',
  productName: '원두 - 블렌드 에스쇼콜라 200g',
});
expect(momosDashedExplicitBlendPrefixDisplayInfo.primary === '블렌드 - 에스쇼콜라', '원두 - 블렌드 형식도 블렌드를 중복 표시하면 안 됩니다', JSON.stringify(momosDashedExplicitBlendPrefixDisplayInfo));

const momosUnknownOriginDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '모모스커피',
  productName: '원두 탄자니아 킬리만자로 200g',
});
expect(!momosUnknownOriginDisplayInfo.primary.startsWith('블렌드 -'), '모모스 원두여도 확인 안 된 싱글오리진 후보를 블렌드로 추정하면 안 됩니다', JSON.stringify(momosUnknownOriginDisplayInfo));

const libreVertigoDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '커피리브레',
  productName: '[대용량 원두] 버티고 1kg',
});
expect(libreVertigoDisplayInfo.primary === '블렌드 - 버티고', '커피리브레의 고유 블렌드명은 블렌드로 표시해야 합니다', JSON.stringify(libreVertigoDisplayInfo));

const libreNoSurpriseDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '커피리브레',
  productName: '노서프라이즈',
});
expect(libreNoSurpriseDisplayInfo.primary === '블렌드 - 노서프라이즈', '커피리브레의 용량 표기가 없는 고유 블렌드명도 블렌드로 표시해야 합니다', JSON.stringify(libreNoSurpriseDisplayInfo));

const libreSingleOriginDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '커피리브레',
  productName: '[싱글오리진] 케냐 카구모 [중강배전]',
  process: '워시드',
});
expect(!libreSingleOriginDisplayInfo.primary.startsWith('블렌드 -'), '커피리브레 싱글오리진은 블렌드로 표시하면 안 됩니다', JSON.stringify(libreSingleOriginDisplayInfo));

const fritzOldDogDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '프릳츠 커피 컴퍼니',
  productName: '[프릳츠] 올드독 200g',
});
expect(fritzOldDogDisplayInfo.primary === '블렌드 - 올드독', '프릳츠 고유 블렌드명은 블렌드로 표시해야 합니다', JSON.stringify(fritzOldDogDisplayInfo));

const fritzCinemaDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '프릳츠 커피 컴퍼니',
  productName: '[프릳츠] 서울 시네마 200g',
});
expect(fritzCinemaDisplayInfo.primary === '블렌드 - 서울 시네마', '프릳츠 서울 시네마도 블렌드로 표시해야 합니다', JSON.stringify(fritzCinemaDisplayInfo));

const typoBlendDisplayInfo = core.formatProductDisplayInfo({
  productName: '프루티 블랜드 200g',
});
expect(typoBlendDisplayInfo.primary === '블렌드 - 프루티', '블랜드 오타도 블렌드 이름으로 정리해야 합니다', JSON.stringify(typoBlendDisplayInfo));
expect(core.getProductProcessLabel({ productName: '프루티 블랜드 200g' }) === '블렌드', '블랜드 오타도 블렌드 필터에서 잡혀야 합니다');

const blendingDisplayInfo = core.formatProductDisplayInfo({
  productName: '프루티 블랜딩 200g',
});
expect(blendingDisplayInfo.primary === '블렌드 - 프루티', '블랜딩 표현도 블렌드 이름으로 정리해야 합니다', JSON.stringify(blendingDisplayInfo));
expect(core.getProductProcessLabel({ productName: '프루티 블랜딩 200g' }) === '블렌드', '블랜딩 표현도 블렌드 필터에서 잡혀야 합니다');

const prefixedBlendingDisplayInfo = core.formatProductDisplayInfo({
  productName: '블랜딩 프루티 200g',
});
expect(prefixedBlendingDisplayInfo.primary === '블렌드 - 프루티', '앞에 붙은 블랜딩 표현도 블렌드 이름으로 정리해야 합니다', JSON.stringify(prefixedBlendingDisplayInfo));

const countryTypoBlendDisplayInfo = core.formatProductDisplayInfo({
  productName: '브라질 프루티 블랜드 200g',
});
expect(countryTypoBlendDisplayInfo.primary === '블렌드 - 브라질 프루티', '나라 이름이 있어도 블랜드 오타가 있으면 블렌드 이름으로 정리해야 합니다', JSON.stringify(countryTypoBlendDisplayInfo));

const englishBlendDisplayInfo = core.formatProductDisplayInfo({
  productName: 'May Day Blend 200g',
  process: 'Blend',
});
expect(englishBlendDisplayInfo.primary === '블렌드 - May Day', '영어 Blend로 끝나는 이름도 블렌드를 중복 표시하면 안 됩니다', JSON.stringify(englishBlendDisplayInfo));

const specialtyBlendDisplayInfo = core.formatProductDisplayInfo({
  productName: 'SPECIALTY BLEND 이내 여름 200g',
});
expect(specialtyBlendDisplayInfo.primary === '블렌드 - 이내 여름', '영어 Specialty Blend 접두어도 블렌드 접두어와 중복되면 안 됩니다', JSON.stringify(specialtyBlendDisplayInfo));

const unknownDisplayInfo = core.formatProductDisplayInfo({
  productName: '라 로마 게이샤 워시드 200g',
});
expect(!unknownDisplayInfo.primary.startsWith('블렌드 -'), '정보가 부족한 일반 원두를 블렌드로 잘못 표시하면 안 됩니다', JSON.stringify(unknownDisplayInfo));

const sparseNonMomosDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '프릳츠 커피 컴퍼니',
  productName: '[프릳츠] 퀵커피 6개입',
});
expect(!sparseNonMomosDisplayInfo.primary.startsWith('블렌드 -'), '정보가 부족한 일반 상품을 블렌드로 잘못 표시하면 안 됩니다', JSON.stringify(sparseNonMomosDisplayInfo));

const fritzDecafDisplayInfo = core.formatProductDisplayInfo({
  roasterName: '프릳츠 커피 컴퍼니',
  productName: '[프릳츠] 디카페인 Decaffeinated 200g',
});
expect(!fritzDecafDisplayInfo.primary.startsWith('블렌드 -'), '프릳츠 디카페인은 고유 블렌드명 목록에 없으면 블렌드로 추정하면 안 됩니다', JSON.stringify(fritzDecafDisplayInfo));

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

// acidityScore 산출 및 정렬 검증 추가
const testProductsForScore = core.normalizeProducts([
  { id: 'p-acidic', tastingNotes: ['블루베리', '자스민'], isSoldOut: false, score: 85 },
  { id: 'p-nutty', tastingNotes: ['견과류', '초콜릿'], isSoldOut: false, score: 85 },
  { id: 'p-none', tastingNotes: [], isSoldOut: false, score: 80 }
]);
expect(testProductsForScore[0].acidityScore > 0, '산미형 원두의 acidityScore는 양수여야 합니다', testProductsForScore[0].acidityScore);
expect(testProductsForScore[1].acidityScore < 0, '고소한 단맛형 원두의 acidityScore는 음수여야 합니다', testProductsForScore[1].acidityScore);
expect(testProductsForScore[2].acidityScore === null, '테이스팅 노트가 없는 경우 acidityScore는 null이어야 합니다', testProductsForScore[2].acidityScore);

// tasteAxis 정렬 순서 검증 (사용자 요청: -1.0이 산미형, 1.0이 고소한 단맛형)
const sortedByAcidic = core.sortProducts(testProductsForScore, 'score', -1.0);
expect(sortedByAcidic[0].id === 'p-acidic', 'tasteAxis가 -1.0일 때 산미형 원두가 먼저 와야 합니다', ids(sortedByAcidic));
expect(sortedByAcidic[sortedByAcidic.length - 1].id === 'p-none', 'tasteAxis 정렬 시 맛 정보가 없는 원두는 맨 뒤에 위치해야 합니다', ids(sortedByAcidic));

const sortedBySweet = core.sortProducts(testProductsForScore, 'score', 1.0);
expect(sortedBySweet[0].id === 'p-nutty', 'tasteAxis가 1.0일 때 견과류 원두가 먼저 와야 합니다', ids(sortedBySweet));

// 홀빈 기준 및 분쇄 제외 테스트 추가
expect(core.isGroundCoffeeProduct('테스트 원두 200g 핸드드립 분쇄') === true, '핸드드립 분쇄는 분쇄 상품이어야 합니다');
expect(core.isGroundCoffeeProduct('테스트 원두 200g 에스프레소 분쇄') === true, '에스프레소 분쇄는 분쇄 상품이어야 합니다');
expect(core.isGroundCoffeeProduct('테스트 원두 200g ground coffee') === true, 'ground coffee는 분쇄 상품이어야 합니다');
expect(core.isGroundCoffeeProduct('테스트 원두 200g 홀빈') === false, '홀빈은 분쇄 상품이 아니어야 합니다');
expect(core.isGroundCoffeeProduct('테스트 원두 200g whole bean') === false, 'whole bean은 분쇄 상품이 아니어야 합니다');
expect(core.isGroundCoffeeProduct('테스트 원두 200g (분쇄요청불가)') === false, '분쇄요청불가는 분쇄 상품이 아니어야 합니다');
expect(core.isGroundCoffeeProduct('테스트 원두 200g 분쇄안함') === false, '분쇄안함은 분쇄 상품이 아니어야 합니다');

const testWholeBeanGrouping = core.groupProductsByNameAndWeight([
  { id: 'wb-1', roasterName: '테스트로스터', productName: '테스트 원두 200g 홀빈', price: 15000, weight: 200, score: 80, tastingNotes: [], isSoldOut: false },
  { id: 'wb-2', roasterName: '테스트로스터', productName: '테스트 원두 200g whole bean', price: 15000, weight: 200, score: 80, tastingNotes: [], isSoldOut: false },
  { id: 'wb-3', roasterName: '테스트로스터', productName: '테스트 원두 200g (분쇄요청불가)', price: 15000, weight: 200, score: 80, tastingNotes: [], isSoldOut: false },
  { id: 'wb-4', roasterName: '테스트로스터', productName: '테스트 원두 200g 분쇄안함', price: 15000, weight: 200, score: 80, tastingNotes: [], isSoldOut: false },
]);
expect(testWholeBeanGrouping.length === 1, '홀빈/whole bean/분쇄요청불가/분쇄안함 옵션 차이가 있는 상품들은 하나로 그룹화되어야 합니다', String(testWholeBeanGrouping.length));
expect(testWholeBeanGrouping[0]?.productName === '테스트 원두', '그룹화된 상품명에서는 홀빈 관련 문구가 제거되어야 합니다', testWholeBeanGrouping[0]?.productName);

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`실패: ${failure}`));
  process.exitCode = 1;
} else {
  console.log('핵심 기능 계약 테스트 통과');
}
