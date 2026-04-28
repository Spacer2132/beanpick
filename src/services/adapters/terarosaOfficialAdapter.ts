import type { BeanProduct } from '../../data/mockBeans';
import type { FetchProductsResult, RoasteryAdapter } from './types';

export const TERAROSA_SOURCE_ID = 'terarosa';
export const TERAROSA_SOURCE_URL = 'https://www.terarosa.com/market/product/list?categoryId=482';

const TERAROSA_ORIGIN = 'https://www.terarosa.com';

type TerarosaRow = Record<string, unknown>;
type TerarosaDetailPage = {
  url: string;
  html: string;
};

function textValue(row: TerarosaRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim().length > 0) {
      return String(value).trim();
    }
  }

  return '';
}

function numberValue(row: TerarosaRow, keys: string[]) {
  const raw = textValue(row, keys);
  const parsed = Number(raw.replace(/[^\d]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toAbsoluteUrl(url: string) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${TERAROSA_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

function createProductId(seed: string, index: number) {
  return `terarosa-${seed || index + 1}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function inferWeight(productName: string) {
  const match = productName.match(/(\d{2,4})\s*g/i);
  return match ? Number(match[1]) : 250;
}

const COUNTRY_LABELS: Array<[string, string[]]> = [
  ['Honduras', ['honduras', '온두라스']],
  ['Rwanda', ['rwanda', '르완다']],
  ['Panama', ['panama', '파나마']],
  ['Ethiopia', ['ethiopia', '에티오피아']],
  ['Kenya', ['kenya', '케냐']],
  ['Colombia', ['colombia', '콜롬비아']],
  ['Brazil', ['brazil', '브라질']],
  ['Guatemala', ['guatemala', '과테말라']],
  ['Costa Rica', ['costa rica', '코스타리카']],
  ['Indonesia', ['indonesia', '인도네시아']],
  ['El Salvador', ['el salvador', '엘살바도르']],
  ['Peru', ['peru', '페루']],
  ['Bolivia', ['bolivia', '볼리비아']],
];

const PROCESS_LABELS: Array<[string, RegExp]> = [
  ['Anaerobic Washed', /anaerobic\s+washed|무산소\s*워시드/i],
  ['Anaerobic Natural', /anaerobic\s+natural|무산소\s*내추럴/i],
  ['Pulped Natural', /pulped\s+natural|펄프드\s*내추럴/i],
  ['Washed', /washed|워시드/i],
  ['Natural', /natural|내추럴/i],
  ['Honey', /honey|허니/i],
];

const PROCESS_WORDS = new Set([
  'washed',
  'natural',
  'honey',
  'anaerobic',
  'pulped',
  'special',
  'exclusive',
  'online',
  'blend',
]);

const VARIETY_WORDS = new Set([
  'geisha',
  'catuai',
  'bourbon',
  'typica',
  'caturra',
  'sl28',
  'sl34',
  'pacamara',
]);

const KOREAN_REGION_LABELS: Array<[RegExp, string]> = [
  [/마헴베/i, 'Mahembe'],
  [/마르칼라/i, 'Marcala'],
  [/호세/i, 'Jose'],
  [/구지/i, 'Guji'],
  [/함벨라/i, 'Hambela'],
];

function isLikelyBeanProduct(productName: string) {
  const name = productName.toLowerCase();
  const blockedWords = [
    '드립백',
    '선물세트',
    '선물대전',
    '쿨러백',
    'rtd',
    '캡슐',
    '콜드브루',
    '텀블러',
    '머그',
    'cup',
    'bag',
    'set',
  ];
  const beanSignals = [
    '원두',
    'ethiopia',
    'kenya',
    'colombia',
    'brazil',
    'guatemala',
    'panama',
    'rwanda',
    'honduras',
    'costa rica',
    'washed',
    'natural',
    'honey',
    'geisha',
    'bourbon',
    'blend',
    '에티오피아',
    '케냐',
    '콜롬비아',
    '브라질',
    '과테말라',
    '파나마',
    '르완다',
    '온두라스',
    '코스타리카',
    '워시드',
    '내추럴',
    '허니',
    '게이샤',
    '부르봉',
    '블렌드',
  ];

  if (blockedWords.some((word) => name.includes(word))) return false;
  return beanSignals.some((signal) => name.includes(signal));
}

function inferScore(productName: string, index: number) {
  const text = productName.toLowerCase();
  if (text.includes('geisha') || text.includes('게이샤')) return 91;
  if (text.includes('ethiopia') || text.includes('에티오피아')) return 87;
  if (text.includes('kenya') || text.includes('케냐')) return 86;
  return 82 + (index % 5);
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function extractInputValue(html: string, id: string) {
  return html.match(new RegExp(`<input[^>]+id=["']${id}["'][^>]+value=["']([^"']*)["']`, 'i'))?.[1]?.trim() || '';
}

function extractClassHtml(html: string, className: string) {
  return html.match(new RegExp(`<div class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`, 'i'))?.[1] || '';
}

function parsePriceFromDetail(html: string) {
  const inputPrice = Number(extractInputValue(html, 'ItemPrice').replace(/[^\d]/g, ''));
  if (inputPrice > 0) return inputPrice;

  const visiblePrice = Number((html.match(/product_view_text_price[\s\S]*?<span class=["']comma["']>([\d,]+)/i)?.[1] || '').replace(/[^\d]/g, ''));
  return Number.isFinite(visiblePrice) ? visiblePrice : 0;
}

function inferCountry(text: string) {
  const lowerText = text.toLowerCase();
  const found = COUNTRY_LABELS.find(([, aliases]) => aliases.some((alias) => lowerText.includes(alias.toLowerCase())));
  return found?.[0] || '';
}

function inferOriginFromText(text: string) {
  if (/blend|블렌드/i.test(text)) return 'Blend';

  const country = inferCountry(text);
  if (!country) return '확인 필요';

  const countryPattern = new RegExp(`${country.replace(/\s+/g, '\\s+')}[A-Za-z&.\\-\\s]*`, 'i');
  const englishPart = text.match(countryPattern)?.[0] || '';
  const words = englishPart.split(/\s+/).filter(Boolean);
  const countryIndex = words.findIndex((word) => word.toLowerCase() === country.toLowerCase().split(' ')[0]);
  const regionWords = countryIndex >= 0
    ? words
      .slice(countryIndex + country.split(' ').length)
      .filter((word) => {
        const clean = word.toLowerCase().replace(/[^a-z0-9&.-]/g, '');
        return clean && !PROCESS_WORDS.has(clean) && !VARIETY_WORDS.has(clean);
      })
      .slice(0, 2)
    : [];

  if (regionWords.length === 0) {
    const koreanRegion = KOREAN_REGION_LABELS.find(([pattern]) => pattern.test(text))?.[1];
    if (koreanRegion) return `${country} · ${koreanRegion}`;
  }

  return regionWords.length > 0 ? `${country} · ${regionWords.join(' ')}` : country;
}

function inferProcessFromText(text: string) {
  if (/blend|블렌드/i.test(text)) return 'Blend';
  return PROCESS_LABELS.find(([, pattern]) => pattern.test(text))?.[0] || '확인 필요';
}

function parseTastingNotes(infoHtml: string) {
  const text = stripHtml(infoHtml);
  const mappedNotes = [
    ['Jasmine', /재스민|jasmine/i],
    ['Melon', /멜론|melon/i],
    ['Orange', /오렌지|orange/i],
    ['Date', /대추야자|date/i],
    ['Sweet', /단맛|sweet/i],
    ['Berry', /베리|berry/i],
    ['Floral', /꽃|플로럴|floral|blossom/i],
    ['Citrus', /시트러스|citrus/i],
    ['Chocolate', /초콜릿|chocolate/i],
    ['Nutty', /견과|nutty|nuts/i],
    ['Honey', /꿀|허니|honey/i],
  ]
    .filter(([, pattern]) => pattern.test(text))
    .map(([note]) => note);

  if (mappedNotes.length > 0) return [...new Set(mappedNotes)].slice(0, 4);

  const notes = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => line.split(/[,/·]|(?:\s*그리고\s*)/))
    .map((note) => note.replace(/하우스 블렌드|커피$/g, '').trim())
    .filter((note) => !/\d{2,4}\s*g|정상가|할인|[0-9,]+\s*원|^\d+원?$/i.test(note))
    .filter((note) => !note.includes('원'))
    .filter((note) => note.length >= 2)
    .slice(0, 4);

  return notes.length > 0 ? [...new Set(notes)] : ['확인 필요'];
}

export function parseTerarosaDetailProduct(html: string, url: string) {
  const detailStart = html.indexOf('<div class="product_view_text_wrap">');
  const detailHtml = detailStart >= 0 ? html.slice(detailStart) : html;
  const productName = extractInputValue(html, 'ItemName') || stripHtml(extractClassHtml(detailHtml, 'product_view_text_title'));
  const englishName = extractInputValue(html, 'ItemNameEng') || stripHtml(extractClassHtml(detailHtml, 'cont_title_en'));
  const infoHtml = extractClassHtml(detailHtml, 'cont_title_info');
  const infoText = stripHtml(infoHtml);
  const combinedText = `${productName} ${englishName} ${infoText}`;
  const weightMatch = combinedText.match(/(\d{2,4})\s*g/i);
  const imageUrl = toAbsoluteUrl(html.match(/products_swiper_main[\s\S]*?<source[^>]+srcset=["']([^"']+)/i)?.[1] || '');

  return {
    productUrl: url,
    productName,
    origin: inferOriginFromText(combinedText),
    process: inferProcessFromText(combinedText),
    roastLevel: '확인 필요',
    price: parsePriceFromDetail(html),
    weight: weightMatch ? Number(weightMatch[1]) : inferWeight(combinedText),
    tastingNotes: parseTastingNotes(infoHtml),
    imageUrl,
    isNew: /NEW|신상|신상품|\[\d+월/i.test(productName),
    isSoldOut: /value=["']현재 품절된 상품입니다["'][^>]*disabled/i.test(html),
  };
}

export function enrichTerarosaProducts(products: BeanProduct[], detailPages: TerarosaDetailPage[] = []) {
  const detailByItemCode = new Map(
    detailPages.map((page) => [page.url.match(/ItemCode=([^&]+)/i)?.[1] || page.url, parseTerarosaDetailProduct(page.html, page.url)]),
  );

  return products.map((product) => {
    const itemCode = product.productUrl.match(/ItemCode=([^&]+)/i)?.[1] || product.productUrl;
    const detail = detailByItemCode.get(itemCode);
    if (!detail) return product;

    return {
      ...product,
      productName: detail.productName || product.productName,
      origin: detail.origin,
      process: detail.process,
      roastLevel: detail.roastLevel,
      price: detail.price || product.price,
      weight: detail.weight || product.weight,
      tastingNotes: detail.tastingNotes,
      imageUrl: detail.imageUrl || product.imageUrl,
      isNew: detail.isNew,
      isSoldOut: detail.isSoldOut,
    };
  }).filter((product) => isLikelyBeanProduct(product.productName));
}

function isSoldOutRow(row: TerarosaRow) {
  const status = textValue(row, ['soldout', 'soldOut', 'soldoutYn', 'soldOutYn', 'status', 'stockStatus']);
  const stock = numberValue(row, ['stock', 'stockQty', 'quantity']);
  return /품절|sold\s*out|soldout|^y$/i.test(status) || stock === 0;
}

function isNewRow(row: TerarosaRow) {
  const badge = textValue(row, ['isNew', 'newYn', 'badge', 'icon', 'label']);
  return /new|신상|신상품|^y$/i.test(badge);
}

export function normalizeTerarosaApiRows(rows: unknown[]): BeanProduct[] {
  return rows
    .filter((row): row is TerarosaRow => Boolean(row) && typeof row === 'object')
    .map((row, index) => {
      const itemKey = textValue(row, ['itemkey', 'itemKey', 'ItemCode', 'itemCode', 'id']);
      const productName = textValue(row, ['itemname', 'itemName', 'productName', 'name', 'title']) || `테라로사 원두 ${index + 1}`;
      const price = numberValue(row, ['saleprice', 'salePrice', 'price', 'stdprice', 'stdPrice']);
      const imageUrl = toAbsoluteUrl(textValue(row, ['img_list', 'imgList', 'imageUrl', 'image', 'thumbnail', 'thumb']));
      const productUrl = itemKey
        ? `${TERAROSA_ORIGIN}/product/detail/?ItemCode=${encodeURIComponent(itemKey)}`
        : TERAROSA_SOURCE_URL;

      return {
        id: createProductId(itemKey || productName, index),
        roasterName: '테라로사',
        productName,
        origin: inferOriginFromText(productName),
        process: inferProcessFromText(productName),
        roastLevel: '확인 필요',
        price,
        weight: inferWeight(productName),
        score: inferScore(productName, index),
        tastingNotes: ['확인 필요'],
        productUrl,
        imageUrl,
        isSoldOut: isSoldOutRow(row),
        isNew: isNewRow(row),
        lastCheckedAt: '방금 전',
        checkedMinutesAgo: 0,
      };
    })
    .filter((product) => isLikelyBeanProduct(product.productName))
    .filter((product) => product.productName.trim().length > 0);
}

export function parseTerarosaHtmlProducts(html: string): BeanProduct[] {
  const listWrapMatches = [...html.matchAll(/<div class=["']listWrap["']>([\s\S]*?)<\/div>\s*<\/div>\s*<\/a>\s*<\/div>/gi)];
  const legacyMatches = [...html.matchAll(/GoDetail\(['"]?([^'")]+)['"]?\)[\s\S]{0,900}?class=["'][^"']*itemname[^"']*["'][^>]*>([\s\S]*?)<\//gi)];
  const seen = new Set<string>();

  const products = listWrapMatches.map((match, index) => {
    const block = match[1];
    const itemKey = (block.match(/ItemCode=([^"']+)/i)?.[1] || '').trim();
    const productName = (block.match(/<div class=["'][^"']*cont_title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const imageUrl = toAbsoluteUrl(block.match(/<source[^>]+srcset=["']([^"']+)/i)?.[1] || '');
    const price = Number((block.match(/<span class=["'][^"']*sale[^"']*["'][^>]*>([\d,]+)/i)?.[1] || '').replace(/[^\d]/g, '')) || 0;

    seen.add(itemKey || productName);

    return {
      id: createProductId(itemKey || productName, index),
      roasterName: '테라로사',
      productName,
      origin: inferOriginFromText(productName),
      process: inferProcessFromText(productName),
      roastLevel: '확인 필요',
      price,
      weight: inferWeight(productName),
      score: inferScore(productName, index),
      tastingNotes: ['확인 필요'],
      productUrl: itemKey ? `${TERAROSA_ORIGIN}/product/detail/?ItemCode=${encodeURIComponent(itemKey)}` : TERAROSA_SOURCE_URL,
      imageUrl,
      isSoldOut: false,
      isNew: false,
      lastCheckedAt: '방금 전',
      checkedMinutesAgo: 0,
    };
  }).filter((product) => product.productName.trim().length > 0 && isLikelyBeanProduct(product.productName));

  const legacyProducts = legacyMatches.map((match, index) => {
    const itemKey = match[1].trim();
    const productName = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    return {
      id: createProductId(itemKey || productName, products.length + index),
      roasterName: '테라로사',
      productName,
      origin: inferOriginFromText(productName),
      process: inferProcessFromText(productName),
      roastLevel: '확인 필요',
      price: 0,
      weight: inferWeight(productName),
      score: inferScore(productName, index),
      tastingNotes: ['확인 필요'],
      productUrl: itemKey ? `${TERAROSA_ORIGIN}/product/detail/?ItemCode=${encodeURIComponent(itemKey)}` : TERAROSA_SOURCE_URL,
      imageUrl: '',
      isSoldOut: false,
      isNew: false,
      lastCheckedAt: '방금 전',
      checkedMinutesAgo: 0,
    };
  }).filter((product) => !seen.has(product.productName) && product.productName.trim().length > 0 && isLikelyBeanProduct(product.productName));

  return [...products, ...legacyProducts];
}

export const terarosaOfficialAdapter: RoasteryAdapter = {
  sourceId: TERAROSA_SOURCE_ID,
  sourceUrl: TERAROSA_SOURCE_URL,
  async fetchProducts(): Promise<FetchProductsResult> {
    const response = await window.beanpick.fetchTerarosaProducts();
    const products = response.apiRows?.length
      ? normalizeTerarosaApiRows(response.apiRows)
      : parseTerarosaHtmlProducts(response.html || '');
    const enrichedProducts = enrichTerarosaProducts(products, response.detailPages || []);

    return {
      products: enrichedProducts,
      fetchedAt: response.fetchedAt,
      sourceUrl: TERAROSA_SOURCE_URL,
      usedFallback: !response.apiRows?.length,
      warning: response.warning,
    };
  },
  parseProducts: parseTerarosaHtmlProducts,
};
