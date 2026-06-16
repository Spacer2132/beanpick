import type { BeanProduct } from '../../data/mockBeans';
import { normalizeTastingNotes } from '../tastingNotes.js';
import { isSoldOutFromHtml, stripHiddenStockMarkup } from './stockStatus.js';

type Cafe24HtmlPage = {
  url: string;
  html: string;
};

export type Cafe24SourceConfig = {
  sourceId: string;
  roasterName: string;
  sourceUrl: string;
  origin: string;
  defaultWeight?: number;
  priceMultiplier?: number;
  blockedWords?: string[];
  categoryNo?: string;
  trustCategoryAsBean?: boolean;
  beanWords?: string[];
  parser?: 'cafe24' | 'imweb';
  verifyStockFromDetail?: boolean;
};

const COUNTRY_LABELS: Array<[string, string[]]> = [
  ['Ethiopia', ['ethiopia', '에티오피아']],
  ['Kenya', ['kenya', '케냐']],
  ['Colombia', ['colombia', '콜롬비아']],
  ['Brazil', ['brazil', '브라질']],
  ['Guatemala', ['guatemala', '과테말라']],
  ['Panama', ['panama', '파나마']],
  ['Rwanda', ['rwanda', '르완다']],
  ['Honduras', ['honduras', '온두라스']],
  ['Costa Rica', ['costa rica', '코스타리카']],
  ['El Salvador', ['el salvador', '엘살바도르']],
  ['Peru', ['peru', '페루']],
  ['Nicaragua', ['nicaragua', '니카라과']],
  ['Papua New Guinea', ['papua new guinea', '파푸아뉴기니']],
  ['Mexico', ['mexico', '멕시코']],
  ['Yemen', ['yemen', '예멘']],
  ['Thailand', ['thailand', '태국']],
];

const NOTE_LABELS: Array<[string, RegExp]> = [
  ['초콜릿', /초콜릿|다크초콜릿|밀크초콜릿|chocolate/i],
  ['캐러멜', /캐러멜|카라멜|caramel/i],
  ['베리', /베리|라즈베리|블루베리|berry|raspberry|blueberry/i],
  ['체리', /체리|cherry/i],
  ['시트러스', /시트러스|감귤|citrus/i],
  ['오렌지', /오렌지|orange/i],
  ['자몽', /자몽|grapefruit/i],
  ['사과', /사과|청사과|apple/i],
  ['배', /배\)|배,|pear/i],
  ['복숭아', /복숭아|백도|peach/i],
  ['자스민', /자스민|jasmine/i],
  ['꿀', /꿀|허니|honey/i],
  ['견과류', /견과|캐슈넛|헤이즐넛|아몬드|nut|hazelnut|almond|cashew/i],
  ['플로럴', /꽃|플로럴|아카시아|floral|acacia/i],
  ['쥬시', /쥬시|juicy/i],
  ['차', /백차|황차|실론티|tea/i],
  ['와인', /와인|와이니|wine/i],
];

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#36;/g, '$')
    .replace(/&#8361;/g, '₩')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value: string) {
  return String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function toAbsoluteUrl(url: string, origin: string) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

function createProductId(config: Cafe24SourceConfig, productNo: string, productName: string, index: number) {
  return `${config.sourceId}-${productNo || productName || index + 1}`.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-');
}

function extractProductBlocks(html: string) {
  return [...html.matchAll(/<li id=["']anchorBoxId_([^"']+)["'][\s\S]*?(?=<li id=["']anchorBoxId_|<\/ul>)/gi)];
}

function isCategoryProduct(productUrl: string, config: Cafe24SourceConfig) {
  if (!config.categoryNo) return true;
  return productUrl.includes(`/category/${config.categoryNo}/`) || productUrl.includes(`category/${config.categoryNo}`) || productUrl.includes(`cate_no=${config.categoryNo}`);
}

function extractImageUrl(block: string, origin: string) {
  const imageUrl = block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]
    || block.match(/background-image\s*:\s*url\(['"]?([^'")]+)['"]?\)/i)?.[1]
    || '';
  return toAbsoluteUrl(imageUrl, origin);
}

function hasPlaceholderImage(imageUrl: string) {
  return /img_product_(?:big|medium|small)\.gif|no_image\.gif/i.test(imageUrl);
}

function extractProductName(block: string) {
  const candidates = [
    block.match(/<p[^>]+class=["'][^"']*\bname\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1],
    block.match(/<strong[^>]+class=["'][^"']*\bname\b[^"']*["'][^>]*>([\s\S]*?)<\/strong>/i)?.[1],
    block.match(/<h4[^>]+class=["'][^"']*\bname\b[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i)?.[1],
    block.match(/<div[^>]+class=["'][^"']*\bname\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
  ].filter((value): value is string => Boolean(value));

  for (const raw of candidates) {
    const visibleHtml = stripHiddenStockMarkup(raw);
    const name = stripHtml(visibleHtml)
      .replace(/^(상품명|Product Name)\s*:\s*/i, '')
      .replace(/^[:：\s\-]+/, '')
      .trim();
    if (name) return name;
  }

  return stripHtml(block.match(/<img[^>]+alt=["']([^"']+)["']/i)?.[1] || '').trim();
}

function stripBeanpickInjectedMarkers(block: string) {
  return String(block || '').replace(/<span\b[^>]*data-beanpick-(?:detail|ocr)=["'][\s\S]*?<\/span>/gi, ' ');
}

// 취소선(정상가)으로 표시된 금액은 판매가가 아니므로 가격 인식에서 제외한다.
// (일부 cafe24 스킨은 할인 상품에서 정상가-취소선을 판매가보다 먼저 출력한다.)
function stripStruckThroughPrices(block: string) {
  return block
    .replace(/<(?:s|strike|del)\b[^>]*>[\s\S]*?<\/(?:s|strike|del)>/gi, ' ')
    .replace(/<[^>]+style=["'][^"']*line-through[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi, ' ');
}

function extractPrice(block: string, config: Cafe24SourceConfig) {
  const visibleBlock = stripHiddenStockMarkup(stripBeanpickInjectedMarkers(block));
  const dataPrice = Number((visibleBlock.match(/ec-data-price=["'](\d+)["']/i)?.[1] || '').replace(/[^\d]/g, ''));
  if (dataPrice > 0) return dataPrice;

  // 할인 상품은 정상가(취소선)가 판매가보다 먼저 나오므로, 취소선 금액을 빼고 실제 판매가를 읽는다.
  const saleBlock = stripStruckThroughPrices(visibleBlock);
  const wonText = saleBlock.match(/(?:₩|&#8361;)?\s*(\d{1,3}(?:,\d{3})+)\s*원?/i)?.[1] || '';
  if (wonText) return Number(wonText.replace(/[^\d]/g, ''));

  const dollarText = saleBlock.match(/(?:\$|&#36;)\s*(\d+(?:\.\d+)?)/i)?.[1] || '';
  if (dollarText) return Math.round(Number(dollarText) * (config.priceMultiplier || 1350));

  return 0;
}

function parsePriceNumber(value: string | undefined) {
  const parsed = Number(String(value || '').replace(/[^\d]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractOriginalPrice(block: string, salePrice: number) {
  const visibleBlock = stripHiddenStockMarkup(stripBeanpickInjectedMarkers(block));
  const candidates = [
    parsePriceNumber(visibleBlock.match(/ec-data-custom=["']([^"']+)["']/i)?.[1]),
    parsePriceNumber(visibleBlock.match(/data-custom=["']([^"']+)["']/i)?.[1]),
    ...[...visibleBlock.matchAll(/(?:소비자가|Retail Price|정가|List Price)[\s\S]{0,140}?(\d{1,3}(?:,\d{3})+|\d{4,})/gi)]
      .map((match) => parsePriceNumber(match[1])),
    ...[...visibleBlock.matchAll(/<(?:s|strike|del)\b[^>]*>([\s\S]*?)<\/(?:s|strike|del)>/gi)]
      .map((match) => parsePriceNumber(stripHtml(match[1]))),
    ...[...visibleBlock.matchAll(/<[^>]+style=["'][^"']*line-through[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)]
      .map((match) => parsePriceNumber(stripHtml(match[1]))),
  ].filter((price) => price > salePrice);

  return candidates.length > 0 ? Math.max(...candidates) : undefined;
}

function extractDescription(block: string) {
  const memoMatch = block.match(/(?:메\s*모|상품간략설명)[\s\S]*?<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '';
  const descList = [...block.matchAll(/<li[^>]*class=["'][^"']*(?:desc|xans-record)[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean)
    .filter((text) => !/(판매가|Retail Price|Price|제조일|할인가|SOLDOUT)/i.test(text))
    .filter((text) => !/(₩|원|\$|&#36;|&#8361;)\s*\d|^\d{1,3}(,\d{3})+/.test(text))
    .join(', ');

  return [stripHtml(memoMatch), descList].filter(Boolean).join(' ');
}

function inferWeight(text: string, defaultWeight = 200) {
  const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  if (kgMatch) return Math.round(Number(kgMatch[1]) * 1000);

  const gramMatch = text.match(/(\d{2,4})\s*g\b/i);
  return gramMatch ? Number(gramMatch[1]) : defaultWeight;
}

function inferOrigin(text: string) {
  if (/블렌드|blend/i.test(text)) return 'Blend';
  const lowerText = text.toLowerCase();
  const found = COUNTRY_LABELS.find(([, aliases]) => aliases.some((alias) => lowerText.includes(alias.toLowerCase())));
  return found?.[0] || '확인 필요';
}

function inferProcess(text: string) {
  if (/블렌드|blend/i.test(text)) return 'Blend';
  if (/무산소|anaerobic/i.test(text) && /워시드|washed/i.test(text)) return 'Anaerobic Washed';
  if (/무산소|anaerobic/i.test(text) && /내추럴|natural/i.test(text)) return 'Anaerobic Natural';
  if (/워시드|washed/i.test(text)) return 'Washed';
  if (/내추럴|natural/i.test(text)) return 'Natural';
  if (/허니|honey|옐로우\s*h|레드\s*h|\bH\b/i.test(text)) return 'Honey';
  return '확인 필요';
}

function inferScore(text: string, index: number) {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('coe') || lowerText.includes('게이샤') || lowerText.includes('geisha')) return 92;
  if (lowerText.includes('디카페인') || lowerText.includes('decaf')) return 84;
  if (lowerText.includes('블렌드') || lowerText.includes('blend')) return 83;
  return 84 + (index % 5);
}

function parseTastingNotes(text: string) {
  const mappedNotes = NOTE_LABELS.filter(([, pattern]) => pattern.test(text)).map(([note]) => note);
  if (mappedNotes.length > 0) return normalizeTastingNotes(mappedNotes, { limit: 4 });

  const plainNotes = text
    .split(/[,/·]/)
    .map((note) => note.replace(/\([^)]*\)/g, '').trim())
    .filter((note) => note.length >= 2)
    .filter((note) => !/(₩|원|\$|SOLDOUT|할인가|판매가|Retail Price|Price|제조일)/i.test(note))
    .filter((note) => !/^\d{1,3}(,\d{3})+$|^\d+\s*$/.test(note))
    .filter((note) => !/상품|판매|가격|원두|커피|제조일|displaynone|xans|href|img/i.test(note))
    .slice(0, 4);

  return normalizeTastingNotes(plainNotes, { limit: 4 });
}

function extractBeanpickOcrText(block: string) {
  const ocrText = block.match(/data-beanpick-ocr=(["'])([\s\S]*?)\1/i)?.[2] || '';
  return stripHtml(decodeHtmlEntities(ocrText));
}

type Cafe24DetailInfo = {
  origin?: string;
  variety?: string;
  process?: string;
  tastingNotes?: string;
  region?: string;
  farm?: string;
  weight?: number;
  description?: string;
  ocrText?: string;
  blendComposition?: Array<{ country: string; percent: number }>;
};

function extractBeanpickDetailInfo(block: string): Cafe24DetailInfo | null {
  const raw = block.match(/data-beanpick-detail=(["'])([\s\S]*?)\1/i)?.[2] || '';
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeHtmlEntities(raw));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function parseImwebTastingNotes(block: string, productName: string) {
  const ocrNotes = normalizeTastingNotes(extractBeanpickOcrText(block), { limit: Infinity })
    .filter((note) => !(note === '꿀' && /honey|허니/i.test(productName)));
  if (ocrNotes.length > 0) return ocrNotes.slice(0, 4);

  return parseTastingNotes(extractDescription(block));
}

function isLikelyBeanProduct(productName: string, config: Cafe24SourceConfig) {
  const name = productName.toLowerCase();
  const blockedWords = [
    '드립백',
    '브루백',
    '캡슐',
    '콜드브루',
    '드립커피',
    '인스턴트커피',
    '스틱커피',
    '커피믹스',
    '믹스커피',
    '파우더커피',
    '액상커피',
    '더치커피',
    '더치원액',
    'rtd',
    '굿즈',
    '텀블러',
    '머그',
    '티셔츠',
    '에코백',
    '인스턴트',
    '도매전용',
    '도매',
    'liquid',
    'stick',
    'coffee mix',
    'drip bag',
    'drip coffee',
    'coffee bag',
    'cold brew',
    'dutch coffee',
    'concentrate',
    'teabag',
    'tea bag',
    'capsule',
    'powder',
    'shot glass',
    'glass',
    '쇼핑백',
    '구독',
    '정기배송',
    'subscription',
    '가방',
    '모자',
    '마스킹',
    '테이프',
    '스티커',
    '엽서',
    '포스터',
    '그라인더',
    '머신',
    '필터',
    '드리퍼',
    '서버',
    '계량',
    '청소',
    '브러쉬',
    ...(config.blockedWords || []),
  ];
  // 구독/정기배송 패턴(예: "커피홀릭 3개월 200g")
  if (/\d+\s*개월/.test(name) || /홀릭|홈바리스타/.test(name)) return false;
  const beanSignals = ['원두', 'coffee', 'blend', '블렌드', 'washed', 'natural', 'honey', '워시드', '내추럴', '게이샤', 'decaf', '디카페인'];
  const sourceBeanWords = config.beanWords || [];

  if (blockedWords.some((word) => name.includes(word))) return false;
  if (config.trustCategoryAsBean) return true;
  if (sourceBeanWords.some((word) => name.includes(word.toLowerCase()))) return true;
  return beanSignals.some((word) => name.includes(word)) || COUNTRY_LABELS.some(([, aliases]) => aliases.some((alias) => name.includes(alias.toLowerCase())));
}

export function parseCafe24Products(html: string, config: Cafe24SourceConfig): BeanProduct[] {
  return extractProductBlocks(html)
    .map((match, index) => {
      const productNo = match[1];
      const block = match[0];
      const productName = extractProductName(block);
      const productUrl = toAbsoluteUrl(block.match(/<a[^>]+href=["']([^"']*\/product\/[^"']+)["']/i)?.[1] || config.sourceUrl, config.origin);
      const imageUrl = extractImageUrl(block, config.origin);
      const description = extractDescription(block);
      const detail = extractBeanpickDetailInfo(block);
      const detailText = detail
        ? [detail.origin, detail.variety, detail.process, detail.region, detail.farm, detail.tastingNotes, detail.description, detail.ocrText].filter(Boolean).join(' ')
        : '';
      const combinedText = `${productName} ${description} ${detailText}`.trim();
      // 노트 소스: 구조화 > 메타 description > OCR > 휴리스틱 파서. 최소 2개 확보 목표로 머지.
      const structuredNotes = detail?.tastingNotes
        ? normalizeTastingNotes(detail.tastingNotes, { limit: 5 })
        : [];
      const descriptionNotes = detail?.description
        ? normalizeTastingNotes(detail.description, { limit: 5 })
        : [];
      const ocrNotes = detail?.ocrText
        ? normalizeTastingNotes(detail.ocrText, { limit: 5 })
        : [];
      const heuristicNotes = parseTastingNotes(`${description} ${detailText}`.trim());
      const mergedNotes: string[] = [];
      for (const list of [structuredNotes, descriptionNotes, ocrNotes, heuristicNotes]) {
        for (const note of list) {
          if (!mergedNotes.includes(note)) mergedNotes.push(note);
          if (mergedNotes.length >= 5) break;
        }
        if (mergedNotes.length >= 5) break;
      }
      const tastingNotes = mergedNotes;
      const price = extractPrice(block, config);
      const originalPrice = extractOriginalPrice(block, price);

      return {
        id: createProductId(config, productNo, productName, index),
        roasterName: config.roasterName,
        productName,
        origin: detail?.origin || inferOrigin(combinedText),
        process: detail?.process || inferProcess(combinedText),
        roastLevel: /약배전|light/i.test(combinedText)
          ? 'Light'
          : /강배전|dark/i.test(combinedText)
            ? 'Dark'
            : /중배전|medium/i.test(combinedText)
              ? 'Medium'
              : '확인 필요',
        price,
        originalPrice,
        weight: detail?.weight || inferWeight(`${productName} ${description}`.trim(), config.defaultWeight),
        score: inferScore(combinedText, index),
        tastingNotes,
        productUrl,
        imageUrl,
        isSoldOut: isSoldOutFromHtml(block),
        isNew: /alt=["']New["']|alt=["']신상품["']|신상품/i.test(block),
        lastCheckedAt: '방금 전',
        checkedMinutesAgo: 0,
        variety: detail?.variety || '',
        farm: detail?.farm || '',
        blendComposition: detail?.blendComposition || [],
      };
    })
    .filter((product) => isCategoryProduct(product.productUrl, config))
    .filter((product) => product.productName.length > 0)
    .filter((product) => isLikelyBeanProduct(product.productName, config))
    .filter((product) => !hasPlaceholderImage(product.imageUrl));
}

function extractImwebProductBlocks(html: string) {
  return [...html.matchAll(/<div\b[^>]*class=["'][^"']*\b_shop_item\b[^"']*["'][^>]*data-product-properties=["'][\s\S]*?(?=<div\b[^>]*class=["'][^"']*\b_shop_item\b|<div\b[^>]*class=["'][^"']*_more_btn_wrap\b|<\/section>|$)/gi)]
    .map((match) => match[0]);
}

function readImwebProductProperties(block: string) {
  const rawProperties = block.match(/data-product-properties=(["'])([\s\S]*?)\1/i)?.[2] || '';
  if (!rawProperties) return null;

  try {
    return JSON.parse(decodeHtmlEntities(rawProperties)) as {
      idx?: number | string;
      code?: string;
      name?: string;
      price?: number;
      original_price?: number;
      image_url?: string;
    };
  } catch {
    return null;
  }
}

export function parseImwebProducts(html: string, config: Cafe24SourceConfig): BeanProduct[] {
  return extractImwebProductBlocks(html)
    .map((block, index) => {
      const properties = readImwebProductProperties(block);
      if (!properties) return null;

      const productName = String(properties.name || '').trim();
      const productUrl = toAbsoluteUrl(block.match(/<a[^>]+href=["']([^"']*(?:\?idx=|shop_view)[^"']*)["']/i)?.[1] || config.sourceUrl, config.origin);
      const imageUrl = toAbsoluteUrl(String(properties.image_url || block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || ''), config.origin);
      const combinedText = `${productName} ${stripHtml(block)}`;
      const price = Number(properties.price || properties.original_price || 0);
      const originalPrice = Number(properties.original_price || 0);

      return {
        id: createProductId(config, String(properties.idx || properties.code || ''), productName, index),
        roasterName: config.roasterName,
        productName,
        origin: inferOrigin(combinedText),
        process: inferProcess(combinedText),
        roastLevel: /약배전|light/i.test(combinedText)
          ? 'Light'
          : /강배전|dark/i.test(combinedText)
            ? 'Dark'
            : /중배전|medium/i.test(combinedText)
              ? 'Medium'
              : '확인 필요',
        price,
        originalPrice: originalPrice > price ? originalPrice : undefined,
        weight: inferWeight(combinedText, config.defaultWeight),
        score: inferScore(combinedText, index),
        tastingNotes: parseImwebTastingNotes(block, productName),
        productUrl,
        imageUrl,
        isSoldOut: isSoldOutFromHtml(block),
        isNew: /new|신상품/i.test(block),
        lastCheckedAt: '방금 전',
        checkedMinutesAgo: 0,
      };
    })
    .filter((product): product is BeanProduct => Boolean(product))
    .filter((product) => product.productName.length > 0)
    .filter((product) => isLikelyBeanProduct(product.productName, config));
}

export function normalizeCafe24Pages(pages: Cafe24HtmlPage[] = [], config: Cafe24SourceConfig) {
  const seen = new Set<string>();
  const parser = config.parser === 'imweb' ? parseImwebProducts : parseCafe24Products;
  return pages.flatMap((page) => parser(page.html, config)).filter((product) => {
    if (Number(product.weight || 0) > 1000) return false;
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}
