import type { BeanProduct } from '../../data/mockBeans';

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
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#36;/g, '$')
    .replace(/&#8361;/g, '₩')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function extractImageUrl(block: string, origin: string) {
  const imageUrl = block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]
    || block.match(/background-image\s*:\s*url\(['"]?([^'")]+)['"]?\)/i)?.[1]
    || '';
  return toAbsoluteUrl(imageUrl, origin);
}

function extractProductName(block: string) {
  const nameHtml = block.match(/<(?:strong|h4|div|p)[^>]+class=["'][^"']*name[^"']*["'][^>]*>([\s\S]*?)<\/(?:strong|h4|div|p)>/i)?.[1] || '';
  const name = stripHtml(nameHtml)
    .replace(/^(상품명|Product Name)\s*:\s*/i, '')
    .trim();

  if (name) return name;

  return stripHtml(block.match(/<img[^>]+alt=["']([^"']+)["']/i)?.[1] || '').trim();
}

function extractPrice(block: string, config: Cafe24SourceConfig) {
  const dataPrice = Number((block.match(/ec-data-price=["'](\d+)["']/i)?.[1] || '').replace(/[^\d]/g, ''));
  if (dataPrice > 0) return dataPrice;

  const wonText = block.match(/(?:₩|&#8361;)?\s*(\d{1,3}(?:,\d{3})+)\s*원?/i)?.[1] || '';
  if (wonText) return Number(wonText.replace(/[^\d]/g, ''));

  const dollarText = block.match(/(?:\$|&#36;)\s*(\d+(?:\.\d+)?)/i)?.[1] || '';
  if (dollarText) return Math.round(Number(dollarText) * (config.priceMultiplier || 1350));

  return 0;
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
  const match = text.match(/(\d{2,4})\s*g/i);
  return match ? Number(match[1]) : defaultWeight;
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
  if (mappedNotes.length > 0) return [...new Set(mappedNotes)].slice(0, 4);

  const plainNotes = text
    .split(/[,/·]/)
    .map((note) => note.replace(/\([^)]*\)/g, '').trim())
    .filter((note) => note.length >= 2)
    .filter((note) => !/(₩|원|\$|SOLDOUT|할인가|판매가|Retail Price|Price|제조일)/i.test(note))
    .filter((note) => !/^\d{1,3}(,\d{3})+$|^\d+\s*$/.test(note))
    .filter((note) => !/상품|판매|가격|원두|커피|제조일|displaynone|xans|href|img/i.test(note))
    .slice(0, 4);

  return plainNotes.length > 0 ? [...new Set(plainNotes)] : ['확인 필요'];
}

function isLikelyBeanProduct(productName: string, config: Cafe24SourceConfig) {
  const name = productName.toLowerCase();
  const blockedWords = [
    '드립백',
    '브루백',
    '캡슐',
    '콜드브루',
    'rtd',
    '굿즈',
    '텀블러',
    '머그',
    '티셔츠',
    '에코백',
    '인스턴트',
    'liquid',
    'stick',
    'teabag',
    ...(config.blockedWords || []),
  ];
  const beanSignals = ['원두', 'coffee', 'blend', '블렌드', 'washed', 'natural', 'honey', '워시드', '내추럴', '게이샤', 'decaf', '디카페인'];

  if (blockedWords.some((word) => name.includes(word))) return false;
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
      const combinedText = `${productName} ${description}`;

      return {
        id: createProductId(config, productNo, productName, index),
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
        price: extractPrice(block, config),
        weight: inferWeight(combinedText, config.defaultWeight),
        score: inferScore(combinedText, index),
        tastingNotes: parseTastingNotes(description),
        productUrl,
        imageUrl,
        isSoldOut: /sold\s*out|품절|SOLDOUT/i.test(block),
        isNew: /alt=["']New["']|alt=["']신상품["']|신상품/i.test(block),
        lastCheckedAt: '방금 전',
        checkedMinutesAgo: 0,
      };
    })
    .filter((product) => product.productName.length > 0)
    .filter((product) => isLikelyBeanProduct(product.productName, config));
}

export function normalizeCafe24Pages(pages: Cafe24HtmlPage[] = [], config: Cafe24SourceConfig) {
  const seen = new Set<string>();
  return pages.flatMap((page) => parseCafe24Products(page.html, config)).filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}
