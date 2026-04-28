import type { BeanProduct } from '../../data/mockBeans';
import type { FetchProductsResult, RoasteryAdapter } from './types';

export const MOMOS_SOURCE_ID = 'momos';
export const MOMOS_SOURCE_URL = 'https://momos.co.kr/category/%EC%9B%90%EB%91%90/42/';

const MOMOS_ORIGIN = 'https://momos.co.kr';

type MomosHtmlPage = {
  url: string;
  html: string;
};

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAbsoluteUrl(url: string) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `${MOMOS_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

function createProductId(productNo: string, productName: string, index: number) {
  return `momos-${productNo || productName || index + 1}`.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-');
}

function inferWeight(text: string) {
  const match = text.match(/(\d{2,4})\s*g/i);
  return match ? Number(match[1]) : 200;
}

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
];

const NOTE_LABELS: Array<[string, RegExp]> = [
  ['초콜릿', /초콜릿|다크초콜릿|chocolate/i],
  ['캐러멜', /캐러멜|카라멜|caramel/i],
  ['베리', /베리|라즈베리|berry|raspberry/i],
  ['시트러스', /시트러스|감귤|citrus/i],
  ['오렌지', /오렌지|orange/i],
  ['청사과', /청사과|green apple/i],
  ['사과', /사과|apple/i],
  ['배', /배\)|배,|pear/i],
  ['복숭아', /복숭아|백도|peach/i],
  ['자스민', /자스민|jasmine/i],
  ['꿀', /꿀|허니|honey/i],
  ['견과류', /견과|캐슈넛|헤이즐넛|아몬드|nut|hazelnut|almond|cashew/i],
  ['플로럴', /꽃|플로럴|아카시아|floral|acacia/i],
  ['쥬시', /쥬시|juicy/i],
  ['차', /백차|황차|실론티|tea/i],
];

function isLikelyBeanProduct(productName: string) {
  const name = productName.toLowerCase();
  const blockedWords = ['드립백', '브루백', '캡슐', '콜드브루', 'rtd', '굿즈', '텀블러', '머그', '티셔츠', '에코백', '세트', 'bandana'];
  const beanSignals = ['원두', 'coffee', 'blend', '블렌드', 'washed', 'natural', 'honey', '워시드', '내추럴', '게이샤', 'decaf', '디카페인'];

  if (blockedWords.some((word) => name.includes(word))) return false;
  return beanSignals.some((word) => name.includes(word)) || COUNTRY_LABELS.some(([, aliases]) => aliases.some((alias) => name.includes(alias.toLowerCase())));
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
  return 85 + (index % 4);
}

function parseTastingNotes(text: string) {
  const mappedNotes = NOTE_LABELS.filter(([, pattern]) => pattern.test(text)).map(([note]) => note);
  if (mappedNotes.length > 0) return [...new Set(mappedNotes)].slice(0, 4);

  const plainNotes = text
    .split(/[,/·]/)
    .map((note) => note.replace(/\([^)]*\)/g, '').trim())
    .filter((note) => note.length >= 2)
    .filter((note) => !/커피|원두|매력|조화|즐길|연상/i.test(note))
    .slice(0, 4);

  return plainNotes.length > 0 ? [...new Set(plainNotes)] : ['확인 필요'];
}

function extractProductBlocks(html: string) {
  return [...html.matchAll(/<li id=["']anchorBoxId_([^"']+)["'][\s\S]*?(?=<li id=["']anchorBoxId_|<\/ul>\s*<\/div>)/gi)];
}

export function parseMomosHtmlProducts(html: string): BeanProduct[] {
  return extractProductBlocks(html)
    .map((match, index) => {
      const productNo = match[1];
      const block = match[0];
      const productUrl = toAbsoluteUrl(block.match(/<a[^>]+href=["']([^"']*\/product\/[^"']+)["']/i)?.[1] || MOMOS_SOURCE_URL);
      const imageUrl = toAbsoluteUrl(block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '');
      const nameHtml = block.match(/<div class=["']name["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
      const productName = stripHtml(nameHtml).replace(/^상품명\s*:\s*/, '').trim();
      const descriptionHtml = block.match(/상품간략설명[\s\S]*?<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '';
      const description = stripHtml(descriptionHtml);
      const combinedText = `${productName} ${description}`;
      const price = Number((block.match(/ec-data-price=["'](\d+)["']/i)?.[1] || '').replace(/[^\d]/g, '')) || 0;

      return {
        id: createProductId(productNo, productName, index),
        roasterName: '모모스커피',
        productName,
        origin: inferOrigin(combinedText),
        process: inferProcess(combinedText),
        roastLevel: '확인 필요',
        price,
        weight: inferWeight(combinedText),
        score: inferScore(combinedText, index),
        tastingNotes: parseTastingNotes(description),
        productUrl,
        imageUrl,
        isSoldOut: /alt=["']품절["']|sold\s*out/i.test(block),
        isNew: /alt=["']New["']|alt=["']신상품["']/i.test(block),
        lastCheckedAt: '방금 전',
        checkedMinutesAgo: 0,
      };
    })
    .filter((product) => product.productName.length > 0)
    .filter((product) => isLikelyBeanProduct(product.productName));
}

export function normalizeMomosPages(pages: MomosHtmlPage[] = []) {
  const seen = new Set<string>();
  return pages.flatMap((page) => parseMomosHtmlProducts(page.html)).filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}

export const momosOfficialAdapter: RoasteryAdapter = {
  sourceId: MOMOS_SOURCE_ID,
  sourceUrl: MOMOS_SOURCE_URL,
  async fetchProducts(): Promise<FetchProductsResult> {
    const response = await window.beanpick.fetchMomosProducts();
    const products = normalizeMomosPages(response.pages || [{ url: MOMOS_SOURCE_URL, html: response.html || '' }]);

    return {
      products,
      fetchedAt: response.fetchedAt,
      sourceUrl: MOMOS_SOURCE_URL,
      warning: response.warning,
    };
  },
  parseProducts: parseMomosHtmlProducts,
};
