import { normalizeTastingNotes, sortTastingNotes } from './tastingNotes.js';

// 10% 이상 싸게 팔면 할인 상품으로 본다. (1~9%는 표기 오차/소폭 할인이라 제외)
const DISCOUNT_THRESHOLD = 0.10;
const FEATURED_VARIETY_RULES = [
  { label: '게이샤', aliases: ['geisha', 'gesha', '게이샤', '게샤'] },
  { label: '파카마라', aliases: ['pacamara', '파카마라'] },
  { label: '시드라', aliases: ['sidra', '시드라'] },
];
const OPTION_ONLY_PRICE_MAX = 1000;
const OPTION_ONLY_ORIGINAL_MIN = 10000;

const TASTE_NOTE_GROUPS = {
  light: new Set([
    '자몽',
    '토마토',
    '오렌지',
    '레몬',
    '라임',
    '시트러스',
    '베리',
    '블루베리',
    '딸기',
    '라즈베리',
    '체리',
    '멜론',
    '사과',
    '청사과',
    '배',
    '복숭아',
    '살구',
    '천도복숭아',
    '열대과일',
    '망고',
    '파인애플',
    '자두',
    '말린자두',
    '포도',
    '청포도',
    '적포도',
    '샤인머스캣',
    '건과일',
    '대추야자',
    '리치',
    '쥬시',
    '달콤한 산미',
    '청량감',
    '플로럴',
    '자스민',
    '베르가못',
    '노란 백합',
    '홍차',
    '녹차',
    '차',
    '다즐링티',
    '와이니',
  ]),
  medium: new Set([
    '꿀',
    '캐러멜',
    '달고나',
    '당밀',
    '둘세데레체',
    '브라운슈가',
    '바닐라',
    '버터스카치',
    '구운 사과',
    '화이트 초콜릿',
    '코코넛',
    '호박',
    '단맛',
    '메이플시럽',
    '부드러움',
    '크리미',
    '시러피',
  ]),
};

function formatPrice(value) {
  if (!value) return '가격 확인 필요';
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}

function formatWeight(value) {
  if (!value) return '';
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}kg`;
  return `${value}g`;
}

function formatPricePer100g(price, weight) {
  if (!price || !weight) return '';
  return `${new Intl.NumberFormat('ko-KR').format(Math.round((price / weight) * 100))}원/100g`;
}

function getPricePer100g(product) {
  if (product.unitPriceLabel) return product.unitPriceLabel;
  return getLowestUnitPriceCandidate(product)?.label || '';
}

function isSuspiciousOptionOnlyPrice(price, originalPrice) {
  const salePrice = Number(price || 0);
  const basePrice = Number(originalPrice || 0);
  return salePrice > 0
    && salePrice <= OPTION_ONLY_PRICE_MAX
    && basePrice >= OPTION_ONLY_ORIGINAL_MIN
    && basePrice / salePrice >= 10;
}

function getReliableSalePrice(price, originalPrice) {
  const salePrice = Number(price || 0);
  const basePrice = Number(originalPrice || 0);
  if (isSuspiciousOptionOnlyPrice(salePrice, basePrice)) return basePrice;
  return salePrice;
}

function getLowestUnitPriceCandidate(product) {
  const options = Array.isArray(product.priceOptions) && product.priceOptions.length > 0
    ? product.priceOptions
    : [product];

  return options
    .map((option, index) => {
      const price = getReliableSalePrice(option.price, option.originalPrice);
      const weight = Number(option.weight || 0);
      const priceWasAdjusted = price !== Number(option.price || 0);
      const label = priceWasAdjusted ? formatPricePer100g(price, weight) : (option.unitPriceLabel || formatPricePer100g(price, weight));
      return price > 0 && weight > 0 && label ? { index, label, value: price / weight } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.value - b.value)[0];
}

function getRepresentativePriceOption(product) {
  const options = Array.isArray(product.priceOptions) && product.priceOptions.length > 0
    ? product.priceOptions
    : createPriceOptions([product]);
  const candidate = getLowestUnitPriceCandidate({ ...product, priceOptions: options });
  return {
    option: options[candidate?.index ?? 0],
    extraCount: Math.max(0, options.length - 1),
  };
}

function calculateDiscountRate(price, originalPrice) {
  const salePrice = getReliableSalePrice(price, originalPrice);
  const basePrice = Number(originalPrice || 0);
  if (!Number.isFinite(salePrice) || !Number.isFinite(basePrice)) return 0;
  if (salePrice <= 0 || basePrice <= salePrice) return 0;
  return (basePrice - salePrice) / basePrice;
}

function formatDiscountRate(rate) {
  if (!rate || rate <= 0) return '';
  return `${Math.round(rate * 100)}% 할인`;
}

function normalizePriceOptionDiscount(option) {
  const price = getReliableSalePrice(option.price, option.originalPrice);
  const priceWasAdjusted = price !== Number(option.price || 0);
  const discountRate = calculateDiscountRate(price, option.originalPrice);
  const originalPrice = discountRate > 0 ? Number(option.originalPrice) : undefined;

  return {
    ...option,
    price,
    priceLabel: priceWasAdjusted ? formatPrice(price) : (option.priceLabel || formatPrice(price)),
    originalPrice,
    originalPriceLabel: originalPrice ? formatPrice(originalPrice) : '',
    discountRate,
    discountLabel: formatDiscountRate(discountRate),
    unitPriceLabel: priceWasAdjusted ? formatPricePer100g(price, option.weight) : option.unitPriceLabel,
  };
}

function normalizeDiscountProduct(product) {
  const price = getReliableSalePrice(product.price, product.originalPrice);
  const priceWasAdjusted = price !== Number(product.price || 0);
  const priceDiscountRate = calculateDiscountRate(price, product.originalPrice);
  const priceOptions = Array.isArray(product.priceOptions)
    ? product.priceOptions.map(normalizePriceOptionDiscount)
    : product.priceOptions;
  const hasPriceOptions = Array.isArray(priceOptions) && priceOptions.length > 0;
  const optionDiscountRate = Array.isArray(priceOptions)
    ? Math.max(0, ...priceOptions.map((option) => Number(option.discountRate || 0)))
    : 0;
  const discountRate = Math.max(priceDiscountRate, optionDiscountRate);

  return {
    ...product,
    price,
    priceLabel: priceWasAdjusted ? formatPrice(price) : product.priceLabel,
    unitPriceLabel: hasPriceOptions ? '' : (priceWasAdjusted ? formatPricePer100g(price, product.weight) : product.unitPriceLabel),
    originalPrice: priceDiscountRate > 0 ? Number(product.originalPrice) : undefined,
    discountRate: discountRate > 0 ? discountRate : undefined,
    priceOptions,
  };
}

function isDiscountedProduct(product, threshold = DISCOUNT_THRESHOLD) {
  return Number(normalizeDiscountProduct(product).discountRate || 0) >= threshold;
}

function filterDiscountProducts(products, threshold = DISCOUNT_THRESHOLD) {
  return products.filter((product) => isDiscountedProduct(product, threshold));
}

function isRealProductUrl(url) {
  return Boolean(url && !url.includes('beanpick.local') && !/smartstore\.naver\.com\/main\/products\//i.test(url));
}

function createPriceOption(product, weightLabel = '') {
  return normalizePriceOptionDiscount({
    id: `${weightLabel || formatWeight(product.weight) || 'unknown'}-${product.price || 0}`,
    price: product.price,
    originalPrice: product.originalPrice,
    weight: product.weight,
    priceLabel: formatPrice(product.price),
    weightLabel: weightLabel || formatWeight(product.weight) || '용량 확인 필요',
    unitPriceLabel: getPricePer100g(product),
    productUrl: isRealProductUrl(product.productUrl) ? product.productUrl : '',
  });
}

function unitPrice(product) {
  return getLowestUnitPriceCandidate(product)?.value || Number.POSITIVE_INFINITY; // 1g당 가격
}

function featuredVarietyLabel(product) {
  const text = [
    product.productName,
    product.variety,
    product.origin,
  ].filter(Boolean).join(' ').toLowerCase();

  return FEATURED_VARIETY_RULES.find((rule) => (
    rule.aliases.some((alias) => text.includes(alias.toLowerCase()))
  ))?.label || '';
}

function isBlendProduct(product) {
  const text = [
    product.productName,
    product.variety,
    product.origin,
    product.process,
  ].filter(Boolean).join(' ').toLowerCase();

  return /\bblend\b|블렌드/.test(text);
}

function pickFeaturedProducts(products, limit = 8) {
  const selected = [];
  const selectedIds = new Set();

  function addProduct(product, ignoreLimit = false) {
    if (!product || selectedIds.has(product.id)) return;
    if (!ignoreLimit && selected.length >= limit) return;
    selected.push(product);
    selectedIds.add(product.id);
  }

  // 특수 품종(게이샤·파카마라·시드라)은 개수 제한 없이 전부 추천에 넣는다.
  FEATURED_VARIETY_RULES.forEach((rule) => {
    products
      .filter((product) => featuredVarietyLabel(product) === rule.label)
      .forEach((product) => addProduct(product, true));
  });
  products.filter((product) => !isBlendProduct(product)).forEach((product) => addProduct(product));

  return selected;
}

function sortProducts(products, sortMode) {
  return [...products].sort((a, b) => {
    if (sortMode === 'latest') return a.checkedMinutesAgo - b.checkedMinutesAgo;
    if (sortMode === 'unitPriceAsc') return unitPrice(a) - unitPrice(b);
    if (sortMode === 'unitPriceDesc') return unitPrice(b) - unitPrice(a);
    if (sortMode === 'discount') return calculateDiscountRate(b.price, b.originalPrice) - calculateDiscountRate(a.price, a.originalPrice);
    return b.score - a.score;
  });
}

function createPriceOptions(products) {
  const optionMap = new Map();

  [...products]
    .sort((a, b) => (a.weight || Number.POSITIVE_INFINITY) - (b.weight || Number.POSITIVE_INFINITY)
      || (a.price || Number.POSITIVE_INFINITY) - (b.price || Number.POSITIVE_INFINITY))
    .forEach((product) => {
      const weightLabel = formatWeight(product.weight);
      const key = weightLabel || `${product.productName}-${product.price || 0}`;
      const current = optionMap.get(key);

      if (!current || (product.price && (!current.price || product.price < current.price))) {
        optionMap.set(key, createPriceOption(product, weightLabel));
      }
    });

  return [...optionMap.values()];
}

function isUsefulProductInfo(value) {
  return value && value !== '확인 필요';
}

function uniqueProductMeta(product) {
  const values = [product.roasterName, product.origin].filter(Boolean);
  return values.filter((value, index) => (
    values.findIndex((item) => item.trim().toLowerCase() === value.trim().toLowerCase()) === index
  ));
}

function productInfoItems(product) {
  return [
    product.process,
  ].filter(isUsefulProductInfo);
}

const COUNTRY_DISPLAY_RULES = [
  { label: '온두라스', aliases: ['honduras', '온두라스', '온드라스'] },
  { label: '페루', aliases: ['peru', '페루'] },
  { label: '케냐', aliases: ['kenya', '케냐'] },
  { label: '파나마', aliases: ['panama', '파나마'] },
  { label: '과테말라', aliases: ['guatemala', '과테말라'] },
  { label: '콜롬비아', aliases: ['colombia', '콜롬비아'] },
  { label: '코스타리카', aliases: ['costa rica', 'costarica', '코스타리카'] },
  { label: '에티오피아', aliases: ['ethiopia', 'ehiopia', '에티오피아'] },
  { label: '브라질', aliases: ['brazil', '브라질'] },
  { label: '르완다', aliases: ['rwanda', '르완다'] },
  { label: '니카라과', aliases: ['nicaragua', '니카라과'] },
  { label: '멕시코', aliases: ['mexico', '멕시코'] },
  { label: '인도', aliases: ['india', '인도'] },
  { label: '엘살바도르', aliases: ['el salvador', '엘살바도르'] },
  { label: '예멘', aliases: ['yemen', '예멘'] },
  { label: '에콰도르', aliases: ['ecuador', '에콰도르'] },
  { label: '파푸아뉴기니', aliases: ['papua new guinea', '파푸아뉴기니'] },
];

const PROCESS_DISPLAY_RULES = [
  { label: '무산소 워시드', aliases: ['anaerobic washed', 'anaerobic wash', '무산소 워시드', '무산소 워시', '아나에어로빅 워시드'] },
  { label: '무산소 내추럴', aliases: ['anaerobic natural', '무산소 내추럴', '무산소 네추럴', '아나에어로빅 내추럴', 'asd 내추럴', 'asd natural'] },
  { label: '워시드', aliases: ['washed', 'wash', '워시드', '워시'] },
  { label: '내추럴', aliases: ['natural', '내추럴', '네추럴'] },
  { label: '허니', aliases: ['honey', '허니'] },
  { label: '블렌드', aliases: ['blend', '블렌드'] },
];

const VARIETY_DISPLAY_RULES = [
  ...FEATURED_VARIETY_RULES,
  { label: '파카스', aliases: ['pacas', '파카스'] },
  { label: '핑크 버번', aliases: ['pink bourbon', '핑크 버번', '핑크버번'] },
  { label: '버번', aliases: ['bourbon', '버번'] },
  { label: '카투라', aliases: ['caturra', '카투라'] },
  { label: '카투아이', aliases: ['catuai', '카투아이'] },
  { label: '티피카', aliases: ['typica', '티피카'] },
  { label: 'SL28', aliases: ['sl28'] },
  { label: 'SL34', aliases: ['sl34'] },
  { label: '카스티요', aliases: ['castillo', '카스티요'] },
  { label: '피베리', aliases: ['peaberry', '피베리'] },
  { label: '헤어룸', aliases: ['heirloom', '헤어룸'] },
];

const DISPLAY_STOP_WORDS = [
  '원두',
  '커피',
  'coffee',
  'bean',
  'beans',
  'coe',
  'cup of excellence',
  '로스터스 픽',
  "roaster's pick",
  'roasters pick',
  '골드문트',
  '싱글오리진',
  'single origin',
];

function hasAlias(text, aliases) {
  const lowerText = String(text || '').toLowerCase();
  return aliases.some((alias) => lowerText.includes(alias.toLowerCase()));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeAliases(text, aliases) {
  return aliases.reduce((current, alias) => (
    current.replace(new RegExp(escapeRegExp(alias), 'gi'), ' ')
  ), text);
}

function firstAliasIndex(text, aliases) {
  const lowerText = String(text || '').toLowerCase();
  return aliases.reduce((bestIndex, alias) => {
    const index = lowerText.indexOf(alias.toLowerCase());
    if (index < 0) return bestIndex;
    return bestIndex < 0 ? index : Math.min(bestIndex, index);
  }, -1);
}

function compactDisplayText(value) {
  return String(value || '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[·•|/&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findCountryDisplay(product) {
  const nameMatches = COUNTRY_DISPLAY_RULES
    .map((rule) => ({ rule, index: firstAliasIndex(product.productName, rule.aliases) }))
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index);

  if (nameMatches.length > 0) return nameMatches[0].rule;
  return COUNTRY_DISPLAY_RULES.find((rule) => hasAlias(product.origin, rule.aliases));
}

function findProcessDisplay(product) {
  const text = `${product.process || ''} ${product.productName || ''}`;
  return PROCESS_DISPLAY_RULES.find((rule) => hasAlias(text, rule.aliases));
}

function findVarietyDisplays(productName) {
  const labels = VARIETY_DISPLAY_RULES
    .filter((rule) => hasAlias(productName, rule.aliases))
    .map((rule) => rule.label)
    .filter((label, index, labels) => labels.indexOf(label) === index);

  if (labels.includes('핑크 버번')) return labels.filter((label) => label !== '버번');
  return labels;
}

function inferFarmName(productName, countryRule, processRule, varietyLabels) {
  const varietyRules = VARIETY_DISPLAY_RULES.filter((rule) => varietyLabels.includes(rule.label));
  let farmName = compactDisplayText(normalizeProductNameForGroup(productName));

  if (countryRule) farmName = removeAliases(farmName, countryRule.aliases);
  if (processRule) farmName = removeAliases(farmName, processRule.aliases);
  varietyRules.forEach((rule) => {
    farmName = removeAliases(farmName, rule.aliases);
  });
  farmName = removeAliases(farmName, DISPLAY_STOP_WORDS);

  return compactDisplayText(farmName);
}

function getProductCountryLabel(product) {
  return findCountryDisplay(product)?.label || '';
}

function getProductProcessLabel(product) {
  return findProcessDisplay(product)?.label || '';
}

function isDecafProduct(product) {
  const text = [product.productName, product.origin, product.process].filter(Boolean).join(' ');
  return /디카페인|decaf/i.test(text);
}

// 1+1 같은 증정 이벤트는 정상가·판매가 두 가격이 아니라 상품명으로만 드러난다. (예: "[커피 페스타 1+1] ...")
function isOnePlusOneProduct(product) {
  return /1\s*[+＋]\s*1|원\s*플러스\s*원/i.test(String(product.productName || ''));
}

function productWeights(product) {
  return [
    product.weight,
    ...(Array.isArray(product.priceOptions) ? product.priceOptions.map((option) => option.weight) : []),
  ]
    .map((weight) => Number(weight || 0))
    .filter((weight) => Number.isFinite(weight) && weight > 0);
}

function matchesCapacityFilter(product, capacityFilter = 'all') {
  if (capacityFilter === 'all') return true;

  const weights = productWeights(product);
  if (weights.length === 0) return false;
  // 각 구간은 겹치지 않는 범위로 본다. (200g 선택 시 500g·1kg이 같이 잡히지 않도록)
  if (capacityFilter === 'under100') return weights.some((weight) => weight < 200);
  if (capacityFilter === 'over200') return weights.some((weight) => weight >= 200 && weight < 500);
  if (capacityFilter === 'over500') return weights.some((weight) => weight >= 500 && weight < 1000);
  if (capacityFilter === 'exact1000') return weights.some((weight) => weight === 1000);
  return true;
}

function preferKoreanText(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (!/[가-힣]/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^([\s\S]*?)\s*[A-Za-z]/);
  if (!match) return trimmed;
  const koreanSide = match[1].trim().replace(/[,/·\s]+$/, '').trim();
  return koreanSide || trimmed;
}

function formatProductDisplayInfo(product) {
  const cleanName = compactDisplayText(normalizeProductNameForGroup(product.productName));
  const varietyHint = preferKoreanText(product.variety || '');
  const countryRule = findCountryDisplay(product);
  const processRule = findProcessDisplay(product);
  const varietyLabels = findVarietyDisplays(`${cleanName} ${varietyHint}`.trim());
  const detailFarm = preferKoreanText(product.farm || '');
  const farmName = detailFarm || inferFarmName(cleanName, countryRule, processRule, varietyLabels);
  const varietyLabel = varietyLabels.slice(0, 2).join(' / ');
  // 규칙에 없는 품종이라도 상세에서 한글 값을 찾았으면 그것을 폴백으로 쓴다.
  const koreanVarietyHint = /[가-힣]/.test(varietyHint) ? varietyHint : '';
  const primary = [countryRule?.label, varietyLabel || koreanVarietyHint].filter(Boolean).join(' - ') || cleanName;

  const isBlend = (!countryRule && !processRule && varietyLabels.length === 0)
    || processRule?.label === '블렌드';

  if (isBlend) {
    // 블렌드 상품은 부제 줄을 비워 둔다. 사용자가 보고 싶은 건 실제 테이스팅 노트.
    return {
      primary: cleanName,
      variety: '',
      process: '',
      farm: '',
    };
  }

  const rawProcess = processRule?.label || preferKoreanText(product.process || '');
  return {
    primary,
    variety: varietyLabel,
    process: /^확인\s*필요$/.test(rawProcess) ? '' : rawProcess,
    farm: /^확인\s*필요$/.test(farmName) ? '' : farmName,
  };
}

function normalizeProductNameForGroup(productName) {
  return String(productName || '')
    .replace(/[★☆]/g, ' ')
    // "[그란데]"(대용량), "[6월 먼슬리]"(행사), "(요청불가)" 같은 수식어 때문에
    // 같은 원두가 따로 표시되는 것을 막는다. 단 [생두]·[디카페인]처럼 상품이 달라지는 표기는 남긴다.
    .replace(/[[(]\s*(?:그란데|대용량|벌크|점보|뉴크롭|new\s*crop|(?:\d+월\s*)?먼슬리|(?:분쇄\s*)?요청불가)\s*[\])]/gi, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:kg|g)\b/gi, ' ')
    .replace(/\b\d+\s*개\b/g, ' ')
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createProductGroupKey(product) {
  // 비교용 키에서는 띄어쓰기를 모두 없앤다. ("풀리 워시드"와 "풀리워시드"를 같게 본다)
  return [
    product.roasterName,
    normalizeProductNameForGroup(product.productName),
  ].join('::').toLowerCase().replace(/\s+/g, '');
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function createGroupedProductId(product) {
  return createProductGroupKey(product).replace(/[^a-z0-9가-힣]+/gi, '-').replace(/^-+|-+$/g, '');
}

function groupProductsByNameAndWeight(products) {
  const groups = new Map();

  products.forEach((product) => {
    const key = createProductGroupKey(product);
    groups.set(key, [...(groups.get(key) || []), product]);
  });

  return [...groups.values()].map((rawItems) => {
    const items = rawItems.map(normalizeDiscountProduct);

    if (items.length === 1) {
      return normalizeDiscountProduct({
        ...items[0],
        tastingNotes: normalizeTastingNotes(items[0].tastingNotes),
      });
    }

    const sortedByWeight = [...items].sort((a, b) => (a.weight || 0) - (b.weight || 0));
    const sortedByPrice = [...items].sort((a, b) => (a.price || Number.POSITIVE_INFINITY) - (b.price || Number.POSITIVE_INFINITY));
    const bestUnitPriceProduct = [...items]
      .filter((item) => item.price > 0 && item.weight > 0)
      .sort((a, b) => (a.price / a.weight) - (b.price / b.weight))[0];
    const representative = bestUnitPriceProduct || sortedByPrice[0] || sortedByWeight[0];
    const minPriceProduct = sortedByPrice[0] || representative;
    const weights = uniqueValues(sortedByWeight.map((item) => formatWeight(item.weight)));
    const priceOptions = createPriceOptions(items);
    const discountRate = Math.max(
      0,
      ...items.map((item) => Number(item.discountRate || 0)),
      ...priceOptions.map((option) => Number(option.discountRate || 0)),
    );

    return {
      ...representative,
      id: createGroupedProductId(representative),
      productName: normalizeProductNameForGroup(representative.productName),
      price: minPriceProduct.price,
      originalPrice: minPriceProduct.originalPrice,
      discountRate: discountRate > 0 ? discountRate : undefined,
      priceLabel: formatPrice(minPriceProduct.price),
      weight: representative.weight,
      weightLabel: weights.join(' / '),
      unitPriceLabel: '',
      priceOptions,
      score: Math.max(...items.map((item) => item.score || 0)),
      tastingNotes: normalizeTastingNotes(items.flatMap((item) => item.tastingNotes)),
      imageUrl: representative.imageUrl || items.find((item) => item.imageUrl)?.imageUrl || '',
      isSoldOut: items.every((item) => item.isSoldOut),
      isNew: items.some((item) => item.isNew),
      checkedMinutesAgo: Math.min(...items.map((item) => item.checkedMinutesAgo || 0)),
      groupedProductCount: items.length,
    };
  });
}

function getTasteNoteGroup(note) {
  if (TASTE_NOTE_GROUPS.light.has(note)) return 'light';
  if (TASTE_NOTE_GROUPS.medium.has(note)) return 'medium';
  return 'dark';
}

function normalizeProducts(products) {
  return products.map((product) => normalizeDiscountProduct({
    ...product,
    tastingNotes: normalizeTastingNotes(product.tastingNotes),
  }));
}

function getNoteOptions(products) {
  return sortTastingNotes(products.flatMap((product) => product.tastingNotes));
}

// 한글 음절에서 초성만 뽑아낸다. (예: "에티오피아" → "ㅇㅌㅇㅍㅇ")
const CHOSEONG_LIST = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

function getChoseong(text) {
  return [...String(text)].map((char) => {
    const code = char.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) return char;
    return CHOSEONG_LIST[Math.floor(code / 588)];
  }).join('');
}

// 띄어쓰기 무시 + 초성(ㅇㅌㅇㅍㅇ) 검색을 지원하는 매칭.
// 여러 단어를 입력하면 모든 단어가 들어 있어야 한다.
function matchesSmartSearch(text, query) {
  const tokens = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const compactText = String(text).toLowerCase().replace(/\s+/g, '');
  const choseongText = getChoseong(compactText);

  return tokens.every((token) => (
    compactText.includes(token)
    || (/^[ㄱ-ㅎ]+$/.test(token) && choseongText.includes(token))
  ));
}

// 노트 상세검색: 포함 단어는 노트에 모두 들어 있어야 하고, 제외 단어는 하나도 없어야 한다.
function matchesNoteQuery(product, includeQuery = '', excludeQuery = '') {
  const noteText = (product.tastingNotes || []).join(' ');

  if (!matchesSmartSearch(noteText, String(includeQuery).replace(/,/g, ' '))) return false;

  const excludeTokens = String(excludeQuery).trim().split(/[\s,]+/).filter(Boolean);
  return !excludeTokens.some((token) => matchesSmartSearch(noteText, token));
}

function filterProductsBySearchAndNotes(products, searchQuery = '', activeNotes = []) {
  const query = searchQuery.trim().toLowerCase();

  return products.filter((product) => {
    const searchable = [
      product.roasterName,
      product.productName,
      product.origin,
      product.process,
      product.roastLevel,
      ...product.tastingNotes,
    ].join(' ').toLowerCase();

    const matchesSearch = query.length === 0 || searchable.includes(query);
    const matchesNotes = activeNotes.length === 0 || activeNotes.some((note) => product.tastingNotes.includes(note));
    return matchesSearch && matchesNotes;
  });
}

function getStockCounts(products) {
  return {
    all: products.length,
    available: products.filter((product) => !product.isSoldOut).length,
    soldout: products.filter((product) => product.isSoldOut).length,
  };
}

function filterProductsByStockStatus(products, stockFilter = 'all') {
  return products.filter((product) => {
    if (stockFilter === 'available') return !product.isSoldOut;
    if (stockFilter === 'soldout') return product.isSoldOut;
    return true;
  });
}

function getFilteredProducts(products, { searchQuery = '', activeNotes = [], stockFilter = 'all', sortMode = 'score' } = {}) {
  const searchMatchedProducts = filterProductsBySearchAndNotes(products, searchQuery, activeNotes);
  return sortProducts(filterProductsByStockStatus(searchMatchedProducts, stockFilter), sortMode);
}

export {
  createPriceOption,
  createPriceOptions,
  calculateDiscountRate,
  filterDiscountProducts,
  filterProductsBySearchAndNotes,
  filterProductsByStockStatus,
  formatDiscountRate,
  formatPrice,
  formatProductDisplayInfo,
  formatWeight,
  getChoseong,
  getFilteredProducts,
  getNoteOptions,
  getPricePer100g,
  getProductCountryLabel,
  getProductProcessLabel,
  getRepresentativePriceOption,
  getStockCounts,
  getTasteNoteGroup,
  groupProductsByNameAndWeight,
  isDecafProduct,
  isDiscountedProduct,
  isOnePlusOneProduct,
  isRealProductUrl,
  matchesCapacityFilter,
  matchesNoteQuery,
  matchesSmartSearch,
  normalizeProductNameForGroup,
  normalizeProducts,
  pickFeaturedProducts,
  productInfoItems,
  sortProducts,
  uniqueProductMeta,
};
