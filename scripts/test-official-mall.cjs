const fs = require('node:fs');
const esbuild = require('esbuild');
const tastingNoteTools = require('../src/services/tastingNotes.cjs');
const stockStatusTools = require('../src/services/adapters/stockStatus.cjs');
const cafe24DetailParser = require('../src/services/adapters/cafe24DetailParser.cjs');

const MAX_CATEGORY_PAGES = 5;
const SOURCES = {
  terarosa: {
    label: '테라로사',
    sourceUrl: 'https://www.terarosa.com/product/list/?category=12',
    apiUrl: 'https://www.terarosa.com/api/product/list/',
    categoryNo: '12',
    pageSize: 28,
    type: 'terarosaApi',
  },
  momos: {
    label: '모모스커피',
    sourceUrl: 'https://momos.co.kr/category/%EC%9B%90%EB%91%90/42/',
    categoryNo: '42',
    pageUrl(pageNumber) {
      return pageNumber === 1 ? this.sourceUrl : `${this.sourceUrl}?page=${pageNumber}`;
    },
  },
  namusairo: {
    label: '나무사이로',
    sourceUrl: 'https://namusairo.com/category/coffee/91/',
    categoryNo: '91',
    verifyStockFromDetail: true,
    detailOrigin: 'https://namusairo.com',
  },
  fritz: {
    label: '프릳츠 커피 컴퍼니',
    sourceUrl: 'https://fritz.co.kr/product/list.html?cate_no=48',
    categoryNo: '48',
    verifyStockFromDetail: true,
    detailOrigin: 'https://fritz.co.kr',
  },
  coffeelibre: {
    label: '커피리브레',
    sourceUrl: 'https://coffeelibre.kr/product/list.html?cate_no=47',
    categoryNo: '47',
    verifyStockFromDetail: true,
    detailOrigin: 'https://coffeelibre.kr',
  },
  werk: {
    label: '베르크커피',
    sourceUrl: 'https://werk.co.kr/',
    verifyStockFromDetail: true,
    detailOrigin: 'https://werk.co.kr',
  },
  deepbluelake: {
    label: '딥블루레이크',
    sourceUrl: 'https://dblcoffee.com/product/list.html?cate_no=24',
    categoryNo: '24',
    verifyStockFromDetail: true,
    detailOrigin: 'https://dblcoffee.com',
  },
  hellcafe: {
    label: '헬카페',
    sourceUrl: 'https://hellcafe.co.kr/store/store.html',
    categoryNo: '1',
    verifyStockFromDetail: true,
    detailOrigin: 'https://hellcafe.co.kr',
  },
  centercoffee: {
    label: '센터커피',
    sourceUrl: 'https://www.centercoffee.co.kr/67',
    maxPages: 2,
    pageUrl(pageNumber) {
      if (pageNumber === 1) return this.sourceUrl;
      return `https://www.centercoffee.co.kr/ajax/get_shop_list_view.cm?page=${pageNumber}&pagesize=12&category=s20190728fa16756cae2c6&sort=recent&menu_url=%2F67%2F`;
    },
  },
  coffee502: {
    label: '502커피로스터스',
    sourceUrl: 'https://502coffee.com/category/%EC%9B%90%EB%91%90/24/',
    categoryNo: '24',
    verifyStockFromDetail: true,
    detailOrigin: 'https://502coffee.com',
  },
};

const GENERIC_BLOCKED_WORDS = [
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
  '쇼핑백',
];

const SOURCE_BLOCKED_WORDS = {
  terarosa: ['선물', '쿨러백', '드립백', '머그', '스틱', '액상', '카페라테', '블록', '케이크', '파우더'],
};

function loadTsModule(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const output = esbuild.transformSync(code, { loader: 'ts', format: 'cjs', target: 'es2020' }).code;
  const module = { exports: {} };

  new Function('exports', 'module', 'require', output)(module.exports, module, (request) => {
    if (String(request).includes('tastingNotes')) return tastingNoteTools;
    if (String(request).includes('stockStatus')) return stockStatusTools;
    return {};
  });
  return module.exports;
}

function assertStockStatusSamples() {
  const hiddenSoldOutHtml = `
    <li>
      <a class="soldOut displaynone"><div><p>SOLD OUT</p></div></a>
      <a class="product-link">판매 중 상품</a>
    </li>
  `;
  const visibleSoldOutHtml = `
    <li>
      <div class="sold"><b>sold out</b></div>
      <a class="product-link">품절 상품</a>
    </li>
  `;

  const hiddenKoreanSoldOutHtml = '<li><span class="displaynone">\uD488\uC808</span><a>\uD310\uB9E4 \uC911</a></li>';
  const visibleKoreanSoldOutHtml = '<li><strong>\uC77C\uC2DC\uD488\uC808</strong></li>';

  if (stockStatusTools.isSoldOutFromHtml(hiddenSoldOutHtml)) {
    throw new Error('숨겨진 SOLD OUT 템플릿을 품절로 판정했습니다.');
  }
  if (!stockStatusTools.isSoldOutFromHtml(visibleSoldOutHtml)) {
    throw new Error('보이는 SOLD OUT 표시를 품절로 판정하지 못했습니다.');
  }
  if (stockStatusTools.isSoldOutFromHtml(hiddenKoreanSoldOutHtml)) {
    throw new Error('Hidden Korean soldout markup was treated as sold out.');
  }
  if (!stockStatusTools.isSoldOutFromHtml(visibleKoreanSoldOutHtml)) {
    throw new Error('Visible Korean soldout text was not treated as sold out.');
  }
}

function assertCenterCoffeeOcrSample(cafe24Adapter, centerConfig) {
  const html = `
    <div class="_shop_item"
      data-product-properties='{&quot;idx&quot;:192,&quot;code&quot;:&quot;s20210429a93f95707b766&quot;,&quot;name&quot;:&quot;Colombia Granja La Esperanza Cerro Azul Geisha Honey&quot;,&quot;original_price&quot;:31000,&quot;price&quot;:31000,&quot;image_url&quot;:&quot;https://example.com/center.png&quot;}'
    >
      <span data-beanpick-ocr="SHINE MUSCAT&#10;MELON&#10;GREEN APPLE"></span>
      <a href="/67/?idx=192"><h2>Colombia Granja La Esperanza Cerro Azul Geisha Honey</h2></a>
    </div>
  `;
  const [product] = cafe24Adapter.parseImwebProducts(html, centerConfig);
  const notes = product?.tastingNotes || [];
  const expected = ['샤인머스캣', '멜론', '청사과'];
  const missing = expected.filter((note) => !notes.includes(note));

  if (missing.length > 0 || notes.includes('꿀')) {
    throw new Error(`센터커피 OCR 노트 파싱 실패: ${notes.join(', ') || '(없음)'}`);
  }
}

function assertTerarosaPromoNoteSample(terarosaAdapter) {
  // 테라로사 본문 이미지 OCR에는 Tasting Note 라벨 없이 원두명 뒤에 영어 노트 목록이 온다.
  const ocrText = [
    '브라질 산투안토니우 엔리케',
    'Hes 펄프드 내추럴',
    '밀크초콜릿의 부드러운 단맛과 sojeol',
    'Milk Chocolate, Hazelnut, Nougat, Clean Finish',
    '원산지 브라질 X14 Santo Antonio',
  ].join('\n');
  const notes = terarosaAdapter.parseNotesNearProductName('[커피 페스타 1+1] 6월 KING콩 브라질 산투안토니우 엔리케+싱글오리진', ocrText);

  if (!notes.includes('밀크초콜릿') || !notes.includes('헤이즐넛')) {
    throw new Error(`테라로사 상품명 근처 노트 파싱 실패: ${notes.join(', ') || '(없음)'}`);
  }
}

function assertOriginalPriceSamples(cafe24Adapter, configs) {
  const cafe24Html = `
    <ul>
      <li id="anchorBoxId_123">
        <a href="/product/colombia-sale-coffee-200g/123/category/91/display/1/"><img src="https://example.com/bean.jpg" alt="Colombia Sale Coffee 200g" /></a>
        <p class="name"><a>Colombia Sale Coffee 200g</a></p>
        <span ec-data-price="28000"></span>
        <span class="consumer">소비자가 40,000원</span>
      </li>
    </ul>
  `;
  const [cafe24Product] = cafe24Adapter.parseCafe24Products(cafe24Html, configs.namusairo);
  if (cafe24Product?.originalPrice !== 40000) {
    throw new Error(`Cafe24 원래가 수집 실패: ${cafe24Product?.originalPrice || '(없음)'}`);
  }

  // 신형 cafe24 스킨(나무사이로): 정상가가 취소선으로 판매가보다 '먼저' 나온다.
  // 첫 금액(취소선 정상가)을 판매가로 오인하면 안 되고, 실제 판매가와 정상가를 따로 잡아야 한다.
  const cafe24StruckHtml = `
    <ul>
      <li id="anchorBoxId_854">
        <div class="description">
          <strong class="name"><a href="/product/pick-블렌드/854/category/91/display/1/">PiCK! 블렌드</a></strong>
          <ul class="xans-element- xans-product xans-product-listitem spec">
            <li><strong class="title displaynone"><span style="font-size:14px;color:#000000;">판매가</span> :</strong><span style="font-size:14px;color:#000000;text-decoration:line-through;">&#8361;43,500</span><span id="span_product_tax_type_text" style="text-decoration:line-through;"> </span></li>
            <li><strong class="title "><span style="font-size:14px;color:#a80505;"></span> :</strong><span style="font-size:14px;color:#a80505;">&#8361;39,150</span></li>
          </ul>
        </div>
      </li>
    </ul>
  `;
  const [cafe24StruckProduct] = cafe24Adapter.parseCafe24Products(cafe24StruckHtml, configs.namusairo);
  if (cafe24StruckProduct?.price !== 39150) {
    throw new Error(`Cafe24 취소선 할인 판매가 수집 실패(정상가를 판매가로 오인): ${cafe24StruckProduct?.price}`);
  }
  if (cafe24StruckProduct?.originalPrice !== 43500) {
    throw new Error(`Cafe24 취소선 정상가 수집 실패: ${cafe24StruckProduct?.originalPrice || '(없음)'}`);
  }

  const imwebHtml = `
    <div class="_shop_item"
      data-product-properties='{&quot;idx&quot;:193,&quot;code&quot;:&quot;discount&quot;,&quot;name&quot;:&quot;Colombia Discount Geisha Honey&quot;,&quot;original_price&quot;:40000,&quot;price&quot;:28000,&quot;image_url&quot;:&quot;https://example.com/center-sale.png&quot;}'
    >
      <a href="/67/?idx=193"><h2>Colombia Discount Geisha Honey</h2></a>
    </div>
  `;
  const [imwebProduct] = cafe24Adapter.parseImwebProducts(imwebHtml, configs.centercoffee);
  if (imwebProduct?.originalPrice !== 40000) {
    throw new Error(`Imweb 원래가 수집 실패: ${imwebProduct?.originalPrice || '(없음)'}`);
  }

  const noDiscountHtml = `
    <div class="_shop_item"
      data-product-properties='{&quot;idx&quot;:194,&quot;code&quot;:&quot;nodiscount&quot;,&quot;name&quot;:&quot;Colombia Normal Geisha Honey&quot;,&quot;original_price&quot;:28000,&quot;price&quot;:28000,&quot;image_url&quot;:&quot;https://example.com/center-normal.png&quot;}'
    >
      <a href="/67/?idx=194"><h2>Colombia Normal Geisha Honey</h2></a>
    </div>
  `;
  const [noDiscountProduct] = cafe24Adapter.parseImwebProducts(noDiscountHtml, configs.centercoffee);
  if (noDiscountProduct?.originalPrice) {
    throw new Error(`판매가와 같은 원래가를 할인으로 분류했습니다: ${noDiscountProduct.originalPrice}`);
  }
}

function assertCafe24DetailWeightSample() {
  const detailHtml = `
    <script>
      var option_stock_data = '{\\"P00000TZ000A\\":{\\"option_value_orginal\\":[\\"60g\\",\\"whole bean\\"],\\"option_name_original\\":[\\"용량\\",\\"분쇄도\\"]}}';
    </script>
    <select option_title="용량">
      <option value="*">- [필수] 옵션을 선택해 주세요 -</option>
      <option value="60g">60g</option>
    </select>
  `;
  const info = cafe24DetailParser.parseCafe24DetailInfo(detailHtml);
  if (info.weight !== 60) {
    throw new Error(`Cafe24 상세 옵션 용량 수집 실패: ${info.weight || '(없음)'}`);
  }
}

function assertCafe24DetailDivTableSample() {
  const detailHtml = `
    <div class="product-table-row">
      <div class="single-table-column">Tasting Notes</div>
      <div class="single-table-column">적사과, 오렌지, 캐러멜, 밀크초콜릿</div>
    </div>
    <div class="product-table-row">
      <div class="product-table-column">품종</div>
      <div class="product-table-column">Red Caturra</div>
    </div>
    <div class="product-table-row">
      <div class="product-table-column">농장</div>
      <div class="product-table-column">La Palma</div>
    </div>
    <div class="product-table-row">
      <div class="product-table-column">가공방식</div>
      <div class="product-table-column">Washed (Dry Fermentation)</div>
    </div>
    <div class="product-table-row">
      <div class="product-table-column">지역</div>
      <div class="product-table-column">Tabaconas, San Ignacio</div>
    </div>
  `;
  const info = cafe24DetailParser.parseCafe24DetailInfo(detailHtml);
  if (info.tastingNotes !== '적사과, 오렌지, 캐러멜, 밀크초콜릿') {
    throw new Error(`Cafe24 div 테이블 tastingNotes 수집 실패: ${info.tastingNotes}`);
  }
  if (info.variety !== 'Red Caturra') {
    throw new Error(`Cafe24 div 테이블 variety 수집 실패: ${info.variety}`);
  }
  if (info.farm !== 'La Palma') {
    throw new Error(`Cafe24 div 테이블 farm 수집 실패: ${info.farm}`);
  }
  if (info.process !== 'Washed (Dry Fermentation)') {
    throw new Error(`Cafe24 div 테이블 process 수집 실패: ${info.process}`);
  }
  if (info.region !== 'Tabaconas, San Ignacio') {
    throw new Error(`Cafe24 div 테이블 region 수집 실패: ${info.region}`);
  }
}

function assertCafe24DetailLibreSample() {
  const detailHtml = `
    <div>
      [약배전] 온두라스 CoE 4위 엘 오코테 허니 Honduras CoE 4th El Ocote Honey<br>
      체리, 라벤더, 올리브, 바닐라<br>
      산미 Acidity ●●●●<br>
      농장명 : 엘 오코테<br>
      품종 : 파카스<br>
      가공방식 : 허니
    </div>
  `;
  const info = cafe24DetailParser.parseCafe24DetailInfo(detailHtml);
  if (info.tastingNotes !== '체리, 라벤더, 올리브, 바닐라') {
    throw new Error(`Cafe24 Libre 라벨없는 tastingNotes 수집 실패: ${info.tastingNotes}`);
  }
  if (info.farm !== '엘 오코테') {
    throw new Error(`Cafe24 Libre 농장명 수집 실패: ${info.farm}`);
  }
}

function assertCafe24Detail502PipeSample() {
  const detailHtml = `
    <div>
      <span><strong>로스팅</strong> | 중강배전</span> <br>
      <span><strong>컵노트</strong> | 토스트, 구운 견과, 초콜릿</span> <br>
      <span><strong>원산지</strong> | 콜롬비아, 케냐, 에티오피아</span>
    </div>
  `;
  const info = cafe24DetailParser.parseCafe24DetailInfo(detailHtml);
  if (info.tastingNotes !== '토스트, 구운 견과, 초콜릿') {
    throw new Error(`Cafe24 502 파이프라인 tastingNotes 수집 실패: ${info.tastingNotes}`);
  }
  if (info.origin !== '콜롬비아, 케냐, 에티오피아') {
    throw new Error(`Cafe24 502 파이프라인 origin 수집 실패: ${info.origin}`);
  }
}

function assertInjectedMarkerPriceSample(cafe24Adapter, configs) {
  const marker = '<span data-beanpick-detail="{&quot;description&quot;:&quot;적립 1,200원&quot;,&quot;ocrText&quot;:&quot;고도 1,700m&quot;}"></span>';
  const html = `
    <ul>
      <li id="anchorBoxId_220">
        ${marker}
        <a href="/product/decaf-colombia-coffee-200g/220/category/91/display/1/"><img src="https://example.com/bean.jpg" alt="Decaf Colombia Coffee 200g" /></a>
        <p class="name"><a>Decaf Colombia Coffee 200g</a></p>
        <span class="price">21,000원</span>
      </li>
    </ul>
  `;
  const [product] = cafe24Adapter.parseCafe24Products(html, configs.namusairo);
  if (product?.price !== 21000) {
    throw new Error(`상세/OCR 내부 숫자를 판매가로 잘못 읽었습니다: ${product?.price || '(없음)'}`);
  }
}

function assertCafe24KgWeightSample(cafe24Adapter, configs) {
  const html = `
    <ul>
      <li id="anchorBoxId_7328">
        <a href="/product/detail.html?product_no=7328&cate_no=47"><img src="https://example.com/vertigo.jpg" alt="[대용량 원두] 버티고 1kg" /></a>
        <p class="name"><a>[대용량 원두] 버티고 1kg</a></p>
        <span class="price">45,000원</span>
      </li>
    </ul>
  `;
  const [product] = cafe24Adapter.parseCafe24Products(html, configs.coffeelibre);
  if (product?.weight !== 1000) {
    throw new Error(`Cafe24 1kg 상품 용량 수집 실패: ${product?.weight || '(없음)'}`);
  }
}

function assertHellcafeGiftSetExcluded(cafe24Adapter, configs) {
  const html = `
    <ul>
      <li id="anchorBoxId_56">
        <a href="/product/detail.html?product_no=56&cate_no=1&display_group=2"><img src="https://example.com/gift.jpg" alt="원두 200g 선물 세트" /></a>
        <p class="name"><a>원두 200g 선물 세트</a></p>
        <span class="price">14,000원</span>
      </li>
    </ul>
  `;
  const products = cafe24Adapter.parseCafe24Products(html, configs.hellcafe);
  if (products.length !== 0) {
    throw new Error(`헬카페 선물세트가 원두 목록에 포함됐습니다: ${products[0]?.productName || '(이름 없음)'}`);
  }
}

function stripHtml(html = '') {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#36;/g, '$')
    .replace(/&#8361;/g, '원')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAbsoluteUrl(url, origin) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

function buildPageUrl(source, pageNumber) {
  if (typeof source.pageUrl === 'function') return source.pageUrl(pageNumber);
  if (pageNumber === 1) return source.sourceUrl;
  const separator = source.sourceUrl.includes('?') ? '&' : '?';
  return `${source.sourceUrl}${separator}page=${pageNumber}`;
}

function extractProductRows(html, source) {
  const origin = new URL(source.sourceUrl).origin;
  const cafe24Rows = [...html.matchAll(/<li\s+id=["']anchorBoxId_([^"']+)["'][\s\S]*?(?=<li\s+id=["']anchorBoxId_|<\/ul>)/gi)]
    .map((match) => {
      const block = match[0];
      const hrefs = [...block.matchAll(/<a[^>]+href=["']([^"']*\/product\/[^"']+)["']/gi)].map((hrefMatch) => hrefMatch[1]);
      const categoryHref = source.categoryNo
        ? hrefs.find((href) => href.includes(`/category/${source.categoryNo}/`) || href.includes(`category/${source.categoryNo}`) || href.includes(`cate_no=${source.categoryNo}`))
        : hrefs[0];
      const nameHtml = block.match(/<p[^>]+class=["'][^"']*\bname\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]
        || block.match(/<(?:strong|h4|div)[^>]+class=["'][^"']*\bname\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:strong|h4|div)>/i)?.[1]
        || '';
      const name = stripHtml(nameHtml)
        .replace(/^Product Name\s*:\s*/i, '')
        .replace(/^[^:]{1,12}:\s*/, '')
        .trim() || stripHtml(block.match(/<img[^>]+alt=["']([^"']+)["']/i)?.[1] || '').trim();

      return {
        productNo: match[1],
        name,
        productUrl: toAbsoluteUrl(categoryHref || hrefs[0] || '', origin),
        isInCategory: !source.categoryNo || Boolean(categoryHref),
      };
    });

  if (cafe24Rows.length > 0) {
    return cafe24Rows.filter((row) => row.name.length > 0);
  }

  return [...html.matchAll(/<div\b[^>]*class=["'][^"']*\b_shop_item\b[^"']*["'][^>]*data-product-properties=(["'])([\s\S]*?)\1[^>]*>/gi)]
    .map((match) => {
      const properties = JSON.parse(stripHtml(match[2]));
      return {
        productNo: String(properties.idx || properties.code || ''),
        name: String(properties.name || ''),
        productUrl: `${source.sourceUrl}?idx=${properties.idx || ''}`,
        isInCategory: true,
      };
    })
    .filter((row) => row.name.length > 0);
}
function productId(sourceId, row) {
  return `${sourceId}-${row.productNo || row.name}`.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-');
}

function uniqueRows(rows, sourceId) {
  const seen = new Set();
  return rows.filter((row) => {
    const id = productId(sourceId, row);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function explainExclusion(row, config, source) {
  if (!row.isInCategory) return '카테고리 밖';

  const name = row.name.toLowerCase();
  const blockedWords = [...GENERIC_BLOCKED_WORDS, ...(SOURCE_BLOCKED_WORDS[source.sourceId] || []), ...(config?.blockedWords || [])];
  const blockedWord = blockedWords.find((word) => name.includes(word.toLowerCase()));
  return blockedWord ? `제외어: ${blockedWord}` : '원두 규칙 미통과';
}

function getCookieHeader(headers) {
  return String(headers.get('set-cookie') || '')
    .split(/,(?=\s*[^;]+?=)/)
    .map((cookie) => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function extractCsrfToken(html) {
  return html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i)?.[1]
    || html.match(/window\.CSRF_TOKEN\s*=\s*["']([^"']+)["']/i)?.[1]
    || '';
}

async function fetchCategoryPages(source) {
  const pages = [];
  const signatures = new Set();
  const maxPages = source.maxPages || (source.categoryNo ? MAX_CATEGORY_PAGES : 1);

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const url = buildPageUrl(source, pageNumber);
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'BeanPick/0.1 official mall test',
        Referer: source.sourceUrl,
      },
    });

    if (!response.ok) continue;

    const text = await response.text();
    const trimmed = text.trim();
    const page = { url, html: trimmed.startsWith('{') ? String(JSON.parse(trimmed).html || '') : text };
    const signature = extractProductRows(page.html, source)
      .filter((row) => row.isInCategory)
      .map((row) => row.productNo)
      .join(',');

    if (pageNumber > 1 && (!signature || signatures.has(signature))) break;

    pages.push(page);
    signatures.add(signature);
  }

  if (source.verifyStockFromDetail) {
    return await enrichPagesWithDetailStock(pages, source);
  }
  return pages;
}

async function fetchDetailHtml(url, referer) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'BeanPick/0.1 official mall test',
      Referer: referer,
    },
  });
  if (!response.ok) return null;
  return await response.text();
}

async function delay(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function injectDetailMarkerForTest(html, productNo, info) {
  if (!info) return html;
  const marker = cafe24DetailParser.buildDetailInfoMarker(info);
  const re = new RegExp(`(<li\\s+id=["']anchorBoxId_${productNo}["'][^>]*>)`, 'i');
  return html.replace(re, (match) => `${match}${marker}`);
}

async function enrichPagesWithDetailStock(pages, source) {
  const origin = source.detailOrigin || new URL(source.sourceUrl).origin;
  const enriched = [];
  for (const page of pages) {
    const items = stockStatusTools.extractCafe24ListItemLinks(page.html, origin);
    if (items.length === 0) {
      enriched.push(page);
      continue;
    }
    const stockMap = new Map();
    const infoMap = new Map();
    let cursor = 0;
    const concurrency = Math.min(5, items.length);
    const workers = Array.from({ length: concurrency }, async () => {
      while (cursor < items.length) {
        const myIndex = cursor;
        cursor += 1;
        const { productNo, detailUrl } = items[myIndex];
        try {
          const html = await fetchDetailHtml(detailUrl, source.sourceUrl);
          if (html != null) {
            stockMap.set(productNo, stockStatusTools.isSoldOutFromHtml(html));
            infoMap.set(productNo, cafe24DetailParser.parseCafe24DetailInfo(html));
          }
        } catch {
          // 상세 페이지를 못 받으면 목록 표시 유지.
        }
        await delay(100);
      }
    });
    await Promise.all(workers);
    let nextHtml = stockStatusTools.stripCafe24FalseSoldOutMarkup(page.html, stockMap);
    for (const [productNo, detailInfo] of infoMap.entries()) {
      nextHtml = injectDetailMarkerForTest(nextHtml, productNo, detailInfo);
    }
    enriched.push({ ...page, html: nextHtml });
  }
  return enriched;
}

async function fetchTerarosaRows(source) {
  const pageResponse = await fetch(source.sourceUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'BeanPick/0.1 official mall test',
    },
  });
  const html = await pageResponse.text();
  const cookie = getCookieHeader(pageResponse.headers);
  const csrfToken = extractCsrfToken(html);
  const rows = [];
  let totalPages = 1;

  for (let pageNumber = 1; pageNumber <= totalPages && pageNumber <= MAX_CATEGORY_PAGES; pageNumber += 1) {
    const response = await fetch(source.apiUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'BeanPick/0.1 official mall test',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: source.sourceUrl,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
      },
      body: new URLSearchParams({
        Category: source.categoryNo,
        OrderBy: '',
        SearchText: '',
        Event: '',
        rmin: '',
        rmax: '',
        sub: '',
        gubun: 'product-list',
        GotoPage: String(pageNumber),
        PageSize: String(source.pageSize),
      }),
    });
    const json = await response.json();
    const pageRows = Array.isArray(json?.rows) ? json.rows : [];
    if (pageRows.length === 0) break;

    const pageCount = Number(pageRows[0]?.totalpage || totalPages);
    if (Number.isFinite(pageCount) && pageCount > 0) totalPages = pageCount;
    rows.push(...pageRows);
  }

  return rows;
}

async function main() {
  assertStockStatusSamples();

  const momosAdapter = loadTsModule('src/services/adapters/momosOfficialAdapter.ts');
  const cafe24Adapter = loadTsModule('src/services/adapters/cafe24OfficialAdapter.ts');
  const terarosaAdapter = loadTsModule('src/services/adapters/terarosaOfficialAdapter.ts');
  const { OFFICIAL_MALL_CONFIGS } = loadTsModule('src/services/adapters/officialMallConfigs.ts');
  let failed = false;

  assertCenterCoffeeOcrSample(cafe24Adapter, OFFICIAL_MALL_CONFIGS.centercoffee);
  assertTerarosaPromoNoteSample(terarosaAdapter);
  assertOriginalPriceSamples(cafe24Adapter, OFFICIAL_MALL_CONFIGS);
  assertCafe24DetailWeightSample();
  assertCafe24DetailDivTableSample();
  assertCafe24DetailLibreSample();
  assertCafe24Detail502PipeSample();
  assertInjectedMarkerPriceSample(cafe24Adapter, OFFICIAL_MALL_CONFIGS);
  assertCafe24KgWeightSample(cafe24Adapter, OFFICIAL_MALL_CONFIGS);
  assertHellcafeGiftSetExcluded(cafe24Adapter, OFFICIAL_MALL_CONFIGS);

  for (const [sourceId, source] of Object.entries(SOURCES)) {
    source.sourceId = sourceId;
    let pageCount = 0;
    let rawRows = [];
    let products = [];

    if (source.type === 'terarosaApi') {
      const rows = await fetchTerarosaRows(source);
      pageCount = Math.max(...rows.map((row) => Number(row.totalpage || 1)), 1);
      rawRows = rows.map((row) => ({
        productNo: String(row.itemkey || ''),
        name: String(row.itemname || ''),
        productUrl: row.itemkey ? `https://www.terarosa.com/product/detail/?ItemCode=${row.itemkey}` : source.sourceUrl,
        isInCategory: true,
      })).filter((row) => row.name.length > 0);
      products = terarosaAdapter.normalizeTerarosaApiRows(rows);
    } else {
      const pages = await fetchCategoryPages(source);
      pageCount = pages.length;
      rawRows = uniqueRows(
        pages.flatMap((page) => extractProductRows(page.html, source)).filter((row) => row.isInCategory),
        sourceId,
      );
      products = sourceId === 'momos'
        ? momosAdapter.normalizeMomosPages(pages)
        : cafe24Adapter.normalizeCafe24Pages(pages, OFFICIAL_MALL_CONFIGS[sourceId]);
    }

    const loadedIds = new Set(products.map((product) => product.id));
    const excludedRows = rawRows.filter((row) => !loadedIds.has(productId(sourceId, row)));
    const availableCount = products.filter((product) => !product.isSoldOut).length;
    const soldOutCount = products.filter((product) => product.isSoldOut).length;
    const discountCount = products.filter((product) => {
      const originalPrice = Number(product.originalPrice || 0);
      const price = Number(product.price || 0);
      return originalPrice > price && price > 0 && ((originalPrice - price) / originalPrice) >= 0.2;
    }).length;

    if (rawRows.length > 0 && products.length === 0) failed = true;

    console.log(`\n[${source.label}]`);
    console.log(`pages ${pageCount} / found ${rawRows.length} / beanpick ${products.length} / available ${availableCount} / soldout ${soldOutCount} / discount20 ${discountCount} / excluded ${excludedRows.length}`);

    if (excludedRows.length > 0) {
      excludedRows.slice(0, 12).forEach((row) => {
        console.log(`- 제외: ${row.name} (${explainExclusion(row, OFFICIAL_MALL_CONFIGS[sourceId], source)})`);
      });
    }
  }

  if (failed) {
    throw new Error('At least one official mall had visible products but loaded 0 beans.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
