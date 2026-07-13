import type { BeanProduct } from '../../data/mockBeans';
import type { FetchProductsResult, RoasteryAdapter } from './types';
import { normalizeTastingNotes } from '../tastingNotes.js';

export const TERAROSA_SOURCE_ID = 'terarosa';
export const TERAROSA_SOURCE_URL = 'https://www.terarosa.com/market/product/list?categoryId=482';

const TERAROSA_ORIGIN = 'https://www.terarosa.com';

type TerarosaRow = Record<string, unknown>;
type TerarosaDetailPage = {
  url: string;
  html: string;
  ocrText?: string;
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

const EXPLICIT_TASTING_NOTE_LABELS: Array<[string, RegExp]> = [
  ['Pecan', /pecan|피칸/i],
  ['Baked Apple', /baked\s*apple|구운\s*사과/i],
  ['Butterscotch', /butterscotch|버터스카치/i],
  ['Prune', /prunes?|dried\s*plums?|말린\s*자두/i],
  ['Cashew Nut', /cashew\s*(?:nut)?s?|캐슈\s*넛|캐슈\s*너트/i],
  ['White Chocolate', /white\s*chocolate|화이트\s*초콜릿/i],
  ['Dried Fruits', /dried\s*fruits?/i],
  ['Sweet Acidity', /sweet\s*acidity/i],
  ['Soft', /\bsoft\b/i],
  ['Long Aftertaste', /long\s*aftertaste/i],
  ['Tropical Fruit', /tropical\s*(?:fruit|fri)|topical\s*fri/i],
  ['Sparkling', /sparkling|sparking/i],
  ['Nectarine', /nectarine/i],
  ['Soda', /\bsod[ao]\b|\bsat[ao]\b|\bsad[ao]\b/i],
  ['Orange', /orange|오렌지/i],
  ['Raspberry', /raspberry|라즈베리/i],
  ['Melon', /melon|멜론/i],
  ['Date', /date|대추야자/i],
  ['Jasmine', /jasmine|재스민/i],
  ['Chocolate', /chocolate|초콜릿/i],
  ['Honey', /honey|허니|꿀/i],
];

function isLikelyBeanProduct(productName: string) {
  const name = productName.toLowerCase();
  const blockedWords = [
    '드립백',
    '드립커피',
    '브루백',
    '커피백',
    '티백',
    '선물세트',
    '선물대전',
    '쿨러백',
    'rtd',
    '캡슐',
    '콜드브루',
    '더치커피',
    '인스턴트',
    '스틱커피',
    '커피믹스',
    '믹스커피',
    '파우더커피',
    '액상커피',
    '원액',
    'drip bag',
    'drip coffee',
    'coffee bag',
    'instant',
    'coffee mix',
    'powder coffee',
    'capsule',
    'cold brew',
    'dutch coffee',
    'concentrate',
    'liquid coffee',
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

function stripHtmlComments(html: string) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
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

function parseOriginalPriceFromDetail(html: string, salePrice: number) {
  const candidates = [
    Number(extractInputValue(html, 'ItemStdPrice').replace(/[^\d]/g, '')),
    Number(extractInputValue(html, 'StdPrice').replace(/[^\d]/g, '')),
    Number(extractInputValue(html, 'ItemConsumerPrice').replace(/[^\d]/g, '')),
    ...[...html.matchAll(/<(?:s|strike|del)\b[^>]*>([\s\S]*?)<\/(?:s|strike|del)>/gi)]
      .map((match) => Number(stripHtml(match[1]).replace(/[^\d]/g, ''))),
    ...[...html.matchAll(/<[^>]+style=["'][^"']*line-through[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)]
      .map((match) => Number(stripHtml(match[1]).replace(/[^\d]/g, ''))),
  ].filter((price) => Number.isFinite(price) && price > salePrice);

  return candidates.length > 0 ? Math.max(...candidates) : undefined;
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

function extractExplicitTastingNoteSection(text: string) {
  const noteMatch = text.match(/(?:tasting\s*note|cup\s*note|flavo[u]?r\s*&\s*aroma)\s*[:\-]?\s*([\s\S]{0,420})/i);
  if (!noteMatch) return '';

  return noteMatch[1]
    .split(/\n\s*(?:원산지|details?|country|net\s*wt|growing\s*details|process|variety|acidity|roasting\s*point)\b|(?:원산지|성분|커피원두|산미)\b/i)[0]
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseExplicitTastingNotes(text: string) {
  const section = extractExplicitTastingNoteSection(stripHtml(text));
  if (!section) return [];

  const mappedNotes = EXPLICIT_TASTING_NOTE_LABELS
    .filter(([, pattern]) => pattern.test(section))
    .map(([note]) => note);
  if (mappedNotes.length > 0) return normalizeTastingNotes(mappedNotes, { limit: 5 });

  return normalizeTastingNotes(section
    .split(/[,/·]|\n/)
    .map((note) => note.replace(/[.:;]+$/g, '').trim())
    .filter((note) => note.length >= 2)
    .filter((note) => !/\d{2,4}\s*g|원산지|성분|coffee\s*beans?|terarosa|테라로사/i.test(note))
    .slice(0, 5), { limit: 5 });
}

// 상품명에서 원두를 특정할 수 있는 한글 토큰만 남긴다. (행사·묶음 문구는 제외)
const PRODUCT_NAME_STOP_WORDS = new Set([
  '커피', '페스타', '원두', '블렌드', '싱글오리진', '디카페인', '스페셜', '온라인', '한정',
]);

function productNameTokens(productName: string) {
  return (productName.match(/[가-힣]{2,}/g) || [])
    .filter((token) => !PRODUCT_NAME_STOP_WORDS.has(token))
    .sort((a, b) => b.length - a.length);
}

// OCR 본문에서 "원두 이름 → 곧이어 나오는 영어 쉼표 노트 목록" 패턴을 찾는다.
// 예) "브라질 산투안토니우 엔리케 ... Milk Chocolate, Hazelnut, Nougat, Clean Finish"
export function parseNotesNearProductName(productName: string, text: string) {
  if (!productName || !text) return [];

  const noteListPattern = /[A-Z][A-Za-z'’&\- ]{1,24}(?:,\s*[A-Z][A-Za-z'’&\- ]{1,24}){2,}/g;

  for (const token of productNameTokens(productName)) {
    let searchFrom = 0;
    while (true) {
      const tokenIndex = text.indexOf(token, searchFrom);
      if (tokenIndex < 0) break;

      const window = text.slice(tokenIndex, tokenIndex + 600);
      const noteList = window.match(noteListPattern)?.[0];
      if (noteList) {
        const notes = normalizeTastingNotes(noteList.split(',').map((note) => note.trim()), { limit: 5 });
        if (notes.length >= 2) return notes;
      }

      searchFrom = tokenIndex + token.length;
    }
  }

  return [];
}

function parseTastingNotes(infoHtml: string, ocrText = '', productName = '') {
  // OCR 뒤에 긴 상품 설명을 붙이면 마지막 노트가 설명과 한 단어로 합쳐질 수 있어 따로 읽는다.
  const ocrNotes = parseExplicitTastingNotes(ocrText);
  if (ocrNotes.length > 0) return ocrNotes;

  const infoNotes = parseExplicitTastingNotes(infoHtml);
  if (infoNotes.length > 0) return infoNotes;

  // 라벨이 없으면 OCR 본문에서 상품명 근처의 영어 노트 목록을 찾는다.
  return parseNotesNearProductName(productName, ocrText);
}

export function parseTerarosaDetailProduct(html: string, url: string, ocrText = '') {
  const visibleHtml = stripHtmlComments(html);
  const detailStart = visibleHtml.indexOf('<div class="product_view_text_wrap">');
  const detailHtml = detailStart >= 0 ? visibleHtml.slice(detailStart) : visibleHtml;
  const productName = extractInputValue(visibleHtml, 'ItemName') || stripHtml(extractClassHtml(detailHtml, 'product_view_text_title'));
  const englishName = extractInputValue(visibleHtml, 'ItemNameEng') || stripHtml(extractClassHtml(detailHtml, 'cont_title_en'));
  const infoHtml = extractClassHtml(detailHtml, 'cont_title_info');
  const infoText = stripHtml(infoHtml);
  const combinedText = `${productName} ${englishName} ${infoText}`;
  const weightMatch = combinedText.match(/(\d{2,4})\s*g/i);
  const imageUrl = toAbsoluteUrl(visibleHtml.match(/products_swiper_main[\s\S]*?<source[^>]+srcset=["']([^"']+)/i)?.[1] || '');
  const price = parsePriceFromDetail(html);

  return {
    productUrl: url,
    productName,
    origin: inferOriginFromText(combinedText),
    process: inferProcessFromText(combinedText),
    roastLevel: '확인 필요',
    price,
    originalPrice: parseOriginalPriceFromDetail(html, price),
    weight: weightMatch ? Number(weightMatch[1]) : inferWeight(combinedText),
    tastingNotes: parseTastingNotes(infoHtml, ocrText, productName),
    imageUrl,
    isNew: /NEW|신상|신상품|\[\d+월/i.test(productName),
    isSoldOut: /value=["']현재 품절된 상품입니다["'][^>]*disabled/i.test(visibleHtml),
  };
}

export function enrichTerarosaProducts(products: BeanProduct[], detailPages: TerarosaDetailPage[] = []) {
  const detailByItemCode = new Map(
    detailPages.map((page) => [page.url.match(/ItemCode=([^&]+)/i)?.[1] || page.url, parseTerarosaDetailProduct(page.html, page.url, page.ocrText || '')]),
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
      originalPrice: detail.originalPrice || product.originalPrice,
      weight: detail.weight || product.weight,
      tastingNotes: detail.tastingNotes,
      imageUrl: detail.imageUrl || product.imageUrl,
      isNew: detail.isNew,
      isSoldOut: detail.isSoldOut,
    };
  }).filter((product) => isLikelyBeanProduct(product.productName) && Number(product.weight || 0) <= 1000);
}

function isSoldOutRow(row: TerarosaRow) {
  const status = textValue(row, ['soldout', 'soldOut', 'soldoutYn', 'soldOutYn', 'status', 'stockStatus']);
  const stockText = textValue(row, ['stock', 'stockQty', 'quantity']);
  const stock = Number(stockText.replace(/[^\d]/g, ''));
  const saleStat = textValue(row, ['salestat', 'saleStat']);
  return /품절|sold\s*out|soldout|^y$/i.test(status)
    || saleStat === '2'
    || (stockText.length > 0 && Number.isFinite(stock) && stock === 0);
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
      const englishName = textValue(row, ['itemnameeng', 'itemNameEng', 'englishName']);
      const itemExplain = textValue(row, ['itemexplain', 'itemExplain', 'description', 'desc']);
      const combinedText = `${productName} ${englishName} ${stripHtml(itemExplain)}`;
      const salePrice = numberValue(row, ['saleprice', 'salePrice', 'price']);
      const originalPrice = numberValue(row, ['stdprice', 'stdPrice', 'consumerPrice', 'consumerprice', 'normalPrice', 'normalprice']);
      const price = salePrice || originalPrice;
      const imageUrl = toAbsoluteUrl(textValue(row, ['img_list', 'imgList', 'imageUrl', 'image', 'thumbnail', 'thumb']));
      const productUrl = itemKey
        ? `${TERAROSA_ORIGIN}/product/detail/?ItemCode=${encodeURIComponent(itemKey)}`
        : TERAROSA_SOURCE_URL;

      return {
        id: createProductId(itemKey || productName, index),
        roasterName: '테라로사',
        productName,
        origin: inferOriginFromText(combinedText),
        process: inferProcessFromText(combinedText),
        roastLevel: '확인 필요',
        price,
        originalPrice: originalPrice > price ? originalPrice : undefined,
        weight: inferWeight(combinedText),
        score: inferScore(productName, index),
        tastingNotes: parseTastingNotes(itemExplain, '', productName),
        productUrl,
        imageUrl,
        isSoldOut: isSoldOutRow(row),
        isNew: isNewRow(row),
        lastCheckedAt: '방금 전',
        checkedMinutesAgo: 0,
      };
    })
    .filter((product) => isLikelyBeanProduct(product.productName))
    .filter((product) => Number(product.weight || 0) <= 1000)
    .filter((product) => product.productName.trim().length > 0);
}

export function parseTerarosaHtmlProducts(html: string): BeanProduct[] {
  const visibleHtml = stripHtmlComments(html);
  const listWrapMatches = [...visibleHtml.matchAll(/<div class=["']listWrap["']>([\s\S]*?)<\/div>\s*<\/div>\s*<\/a>\s*<\/div>/gi)];
  const legacyMatches = [...visibleHtml.matchAll(/GoDetail\(['"]?([^'")]+)['"]?\)[\s\S]{0,900}?class=["'][^"']*itemname[^"']*["'][^>]*>([\s\S]*?)<\//gi)];
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
      tastingNotes: [],
      productUrl: itemKey ? `${TERAROSA_ORIGIN}/product/detail/?ItemCode=${encodeURIComponent(itemKey)}` : TERAROSA_SOURCE_URL,
      imageUrl,
      isSoldOut: false,
      isNew: false,
      lastCheckedAt: '방금 전',
      checkedMinutesAgo: 0,
    };
  }).filter((product) => product.productName.trim().length > 0 && isLikelyBeanProduct(product.productName) && Number(product.weight || 0) <= 1000);

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
      tastingNotes: [],
      productUrl: itemKey ? `${TERAROSA_ORIGIN}/product/detail/?ItemCode=${encodeURIComponent(itemKey)}` : TERAROSA_SOURCE_URL,
      imageUrl: '',
      isSoldOut: false,
      isNew: false,
      lastCheckedAt: '방금 전',
      checkedMinutesAgo: 0,
    };
  }).filter((product) => !seen.has(product.productName) && product.productName.trim().length > 0 && isLikelyBeanProduct(product.productName) && Number(product.weight || 0) <= 1000);

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
