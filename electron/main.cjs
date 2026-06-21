const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const {
  SMARTSTORE_SOURCES,
  enrichProductsWithThumbnailOcr,
  extractNotesFromDetail,
  mergeNotesFromSearchResults,
  loadLocalEnv,
  normalizeSmartStoreCategoryItems,
  readOcrTextFromImageUrl,
  searchNaverShopping,
  testSmartStoreSearch,
} = require('./naverShoppingSearch.cjs');
const {
  isSoldOutFromHtml,
  extractCafe24ListItemLinks,
  stripCafe24FalseSoldOutMarkup,
} = require('../src/services/adapters/stockStatus.cjs');
const {
  parseCafe24DetailInfo,
  buildDetailInfoMarker,
  extractDetailContentImageUrls,
  extractBlendComposition,
} = require('../src/services/adapters/cafe24DetailParser.cjs');
const { publishProductsToGitHub } = require('./githubPublisher.cjs');

const rootDir = path.resolve(__dirname, '..');
loadLocalEnv(rootDir);

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const shouldPublishIphoneSnapshot = process.argv.includes('--publish-iphone-snapshot');
const shouldDryRunIphoneSnapshot = process.argv.includes('--dry-run') || process.env.BEANPICK_AUTO_PUBLISH_DRY_RUN === '1';
const AUTO_PUBLISH_TIMEOUT_MS = Number(process.env.BEANPICK_AUTO_PUBLISH_TIMEOUT_MS || 20 * 60 * 1000);
const TERAROSA_SOURCE_URL = 'https://www.terarosa.com/market/product/list?categoryId=482';
const TERAROSA_PRODUCT_LIST_URL = 'https://www.terarosa.com/product/list/?category=12';
const TERAROSA_API_URL = 'https://www.terarosa.com/api/main/info/';
const TERAROSA_PRODUCT_API_URL = 'https://www.terarosa.com/api/product/list/';
const TERAROSA_CATEGORY_NO = '12';
const TERAROSA_PAGE_SIZE = 28;
const TERAROSA_ORIGIN = 'https://www.terarosa.com';
const MOMOS_SOURCE_URL = 'https://momos.co.kr/category/%EC%9B%90%EB%91%90/42/';
const MOMOS_CATEGORY_NO = '42';
const MAX_CATEGORY_PAGES = 5;
const OFFICIAL_MALL_PAGE_CONFIGS = {
  fritz: {
    sourceUrl: 'https://fritz.co.kr/product/list.html?cate_no=48',
    categoryNo: '48',
    verifyStockFromDetail: true,
    detailOrigin: 'https://fritz.co.kr',
  },
  namusairo: {
    sourceUrl: 'https://namusairo.com/category/coffee/91/',
    categoryNo: '91',
    verifyStockFromDetail: true,
    detailOrigin: 'https://namusairo.com',
  },
  coffeelibre: {
    sourceUrl: 'https://coffeelibre.kr/product/list.html?cate_no=47',
    categoryNo: '47',
    verifyStockFromDetail: true,
    detailOrigin: 'https://coffeelibre.kr',
  },
  werk: {
    sourceUrl: 'https://werk.co.kr/',
    verifyStockFromDetail: true,
    detailOrigin: 'https://werk.co.kr',
  },
  deepbluelake: {
    sourceUrl: 'https://dblcoffee.com/product/list.html?cate_no=24',
    categoryNo: '24',
    verifyStockFromDetail: true,
    detailOrigin: 'https://dblcoffee.com',
  },
  hellcafe: {
    sourceUrl: 'https://hellcafe.co.kr/store/store.html',
    categoryNo: '1',
    verifyStockFromDetail: true,
    detailOrigin: 'https://hellcafe.co.kr',
  },
  centercoffee: {
    sourceUrl: 'https://www.centercoffee.co.kr/67',
    maxPages: 2,
    pageUrl(pageNumber) {
      if (pageNumber === 1) return this.sourceUrl;
      return `https://www.centercoffee.co.kr/ajax/get_shop_list_view.cm?page=${pageNumber}&pagesize=12&category=s20190728fa16756cae2c6&sort=recent&menu_url=%2F67%2F`;
    },
  },
  coffee502: {
    sourceUrl: 'https://502coffee.com/category/%EC%9B%90%EB%91%90/24/',
    categoryNo: '24',
    verifyStockFromDetail: true,
    detailOrigin: 'https://502coffee.com',
  },
};

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: 'BeanPick',
    backgroundColor: '#f7f2ea',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 상품 링크는 앱 안의 새 창이 아니라 PC 기본 브라우저로 연다.
  // (앱 내부 창은 네이버가 자동화 프로그램으로 보고 로그인 화면으로 돌려보낸다)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F5') {
      event.preventDefault();
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function extractCsrfToken(html) {
  const match = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i)
    || html.match(/window\.CSRF_TOKEN\s*=\s*["']([^"']+)["']/i);
  return match ? match[1] : '';
}

function createCookieHeader(headers) {
  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : String(headers.get('set-cookie') || '').split(/,(?=\s*[^;]+?=)/);

  return setCookies.map((cookie) => cookie.split(';')[0]).filter(Boolean).join('; ');
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForRendererState(window, script, timeoutMs, label) {
  const startedAt = Date.now();
  let lastState = null;

  while (Date.now() - startedAt < timeoutMs) {
    if (window.isDestroyed()) {
      throw new Error(`${label} 중 창이 닫혔습니다.`);
    }

    lastState = await window.webContents.executeJavaScript(script, true).catch((error) => ({
      done: false,
      message: error instanceof Error ? error.message : String(error),
    }));

    if (lastState?.done) {
      if (lastState.ok) return lastState;
      throw new Error(lastState.message || `${label} 실패`);
    }

    await delay(1000);
  }

  throw new Error(`${label} 시간이 초과됐습니다. 마지막 상태: ${lastState?.message || '확인 불가'}`);
}

async function runIphoneSnapshotPublish() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    show: false,
    title: 'BeanPick 자동 게시',
    backgroundColor: '#f7f2ea',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on('console-message', (_event, level, message) => {
    console.log(`[renderer:${level}] ${message}`);
  });

  try {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

    const loadState = await waitForRendererState(mainWindow, `
      (() => {
        const text = document.body.innerText || '';
        const successMatch = text.match(/원두\\s+(\\d+)개를\\s+불러와\\s+(\\d+)종으로\\s+묶었습니다/);
        const loadError = [...document.querySelectorAll('.load-banner.load-error')]
          .map((node) => node.innerText || '')
          .find((value) => !value.includes('게시 실패'));
        const cardCount = document.querySelectorAll('.bean-card:not(.skeleton-card)').length;

        if (successMatch) {
          return {
            done: true,
            ok: true,
            message: successMatch[0],
            loadedCount: Number(successMatch[1]),
            groupedCount: Number(successMatch[2]),
            cardCount,
          };
        }

        if (loadError) {
          return { done: true, ok: false, message: loadError, cardCount };
        }

        return {
          done: false,
          message: text.includes('로스터리 확인 중') ? '로스터리 확인 중' : text.slice(0, 160),
          cardCount,
        };
      })()
    `, AUTO_PUBLISH_TIMEOUT_MS, '원두 불러오기');

    console.log(`[beanpick:auto-publish] ${loadState.message}`);

    if (shouldDryRunIphoneSnapshot) {
      console.log('[beanpick:auto-publish] dry-run이라 GitHub 게시를 건너뜁니다.');
      return;
    }

    const clickState = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const buttons = [...document.querySelectorAll('button')];
        const button = buttons.find((item) => (item.innerText || '').trim() === '아이폰 게시');
        if (!button) {
          return { ok: false, message: '아이폰 게시 버튼을 찾지 못했습니다.' };
        }
        if (button.disabled) {
          return { ok: false, message: '아이폰 게시 버튼이 비활성화되어 있습니다.' };
        }
        button.click();
        return { ok: true };
      })()
    `, true);

    if (!clickState?.ok) {
      throw new Error(clickState?.message || '아이폰 게시 버튼 실행 실패');
    }

    const publishState = await waitForRendererState(mainWindow, `
      (() => {
        const text = document.body.innerText || '';
        const successMatch = text.match(/원두\\s+(\\d+)종을\\s+게시했습니다/);
        const publishError = [...document.querySelectorAll('.load-banner.load-error')]
          .map((node) => node.innerText || '')
          .find((value) => value.includes('게시 실패'));

        if (successMatch) {
          return { done: true, ok: true, message: successMatch[0], count: Number(successMatch[1]) };
        }

        if (publishError) {
          return { done: true, ok: false, message: publishError };
        }

        return {
          done: false,
          message: text.includes('게시 중') ? '게시 중' : text.slice(0, 160),
        };
      })()
    `, AUTO_PUBLISH_TIMEOUT_MS, '아이폰 게시');

    console.log(`[beanpick:auto-publish] ${publishState.message}`);
  } finally {
    if (!mainWindow.isDestroyed()) mainWindow.close();
  }
}

function extractSmartStoreCategoryItemsScript() {
  return `
    (() => {
      const byId = new Map();
      const nodes = [...document.querySelectorAll('[data-shp-contents-id][data-shp-contents-type="chnl_prod_no"]')];
      for (const node of nodes) {
        const id = node.getAttribute('data-shp-contents-id');
        if (!id || byId.has(id)) continue;

        const li = node.closest('li') || node;
        const link = li.querySelector('a[href*="/products/"]');
        const img = li.querySelector('img');
        const text = li.innerText || '';
        let details = [];
        try {
          details = JSON.parse(node.getAttribute('data-shp-contents-dtl') || '[]');
        } catch {}
        const detail = Object.fromEntries(details.map((item) => [item.key, item.value]));
        // 본문 금액 목록 (배송비·100g당 단가는 제외)
        const wonAmounts = [...text.matchAll(/(배송비\\s*|당\\s*)?([0-9,]+)\\s*원/g)]
          .filter((match) => !match[1])
          .map((match) => Number(match[2].replace(/,/g, '')) || 0)
          .filter((value) => value > 0);
        // 취소선/정가 표기처럼 명시된 노드만 할인 기준으로 믿는다.
        const strikeNodes = [...li.querySelectorAll('del, s, strike, [class*="origin" i], [class*="strike" i]')];
        const strikePrices = strikeNodes
          .map((node) => Number(String(((node.innerText || '').match(/([0-9,]+)\\s*원/) || [])[1] || '').replace(/,/g, '')) || 0)
          .filter((value) => value > 0);
        const strikeMax = strikePrices.length > 0 ? Math.max(...strikePrices) : 0;
        // 주의: 데이터 속성의 price는 할인 전 정가가 들어온다.
        // 취소선 정가가 보이면, 본문에서 그보다 낮은 첫 금액이 실제 판매가다.
        const dataPrice = Number(detail.price || 0);
        let price;
        let originalPrice;
        if (strikeMax > 0) {
          price = wonAmounts.find((value) => value < strikeMax) || dataPrice || 0;
          originalPrice = strikeMax > price ? strikeMax : 0;
        } else {
          price = dataPrice || wonAmounts[0] || 0;
          originalPrice = 0;
        }
        byId.set(id, {
          id,
          title: detail.chnl_prod_nm || (img ? img.alt : ''),
          price,
          originalPrice,
          productUrl: link ? link.href : '',
          imageUrl: img ? (img.currentSrc || img.src || '') : '',
          isSoldOut: /(^|\\n)품절(\\n|$)/.test(text),
        });
      }

      const totalText = (document.body.innerText.match(/총\\s*([0-9,]+)\\s*개/) || [])[1] || '';
      return {
        total: Number(String(totalText).replace(/,/g, '')) || 0,
        products: [...byId.values()].filter((item) => item.title && item.productUrl),
      };
    })()
  `;
}

async function waitForSmartStoreProducts(window, previousFirstId = '') {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 15000) {
    const result = await window.webContents.executeJavaScript(extractSmartStoreCategoryItemsScript(), true).catch(() => null);
    const firstId = result?.products?.[0]?.id || '';
    if (result?.products?.length > 0 && (!previousFirstId || firstId !== previousFirstId)) {
      return result;
    }
    await delay(300);
  }

  return { total: 0, products: [] };
}

async function clickSmartStorePage(window, pageNumber) {
  return window.webContents.executeJavaScript(`
    (() => {
      const target = [...document.querySelectorAll('[role="menuitem"], a, button')]
        .find((el) => (el.innerText || el.textContent || '').trim() === '${pageNumber}');
      if (!target) return false;
      const event = document.createEvent('MouseEvents');
      event.initMouseEvent('click', true, true, window, 1);
      target.dispatchEvent(event);
      return true;
    })()
  `, true);
}

// 홈 화면에서 카테고리 링크를 눌러 SPA 방식으로 이동한다. 링크가 늦게 그려질 수 있어 잠시 기다리며 재시도한다.
async function clickSmartStoreCategoryLink(window, categoryId) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 10000) {
    const clicked = await window.webContents.executeJavaScript(`
      (() => {
        const link = document.querySelector('a[href*="/category/${categoryId}"]');
        if (!link) return false;
        const event = document.createEvent('MouseEvents');
        event.initMouseEvent('click', true, true, window, 1);
        link.dispatchEvent(event);
        return true;
      })()
    `, true).catch(() => false);
    if (clicked) return true;
    await delay(300);
  }

  return false;
}

async function crawlSmartStoreCategory(categoryUrl) {
  const hiddenWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    // 카테고리 주소로 바로 들어가면 네이버가 로그인 화면으로 돌려보낸다.
    // 스토어 홈을 먼저 연 뒤 카테고리 링크를 클릭해 실제 사용자처럼 이동한다.
    const urlParts = categoryUrl.match(/^(https:\/\/smartstore\.naver\.com\/[^/]+)\/category\/([a-z0-9]+)/i);
    if (urlParts) {
      await hiddenWindow.loadURL(urlParts[1]);
      const clicked = await clickSmartStoreCategoryLink(hiddenWindow, urlParts[2]);
      if (!clicked) await hiddenWindow.loadURL(categoryUrl);
    } else {
      await hiddenWindow.loadURL(categoryUrl);
    }
    const firstPage = await waitForSmartStoreProducts(hiddenWindow);
    const productMap = new Map(firstPage.products.map((product) => [product.id, product]));
    const pageCount = Math.max(1, Math.ceil((firstPage.total || firstPage.products.length) / 40));
    let previousFirstId = firstPage.products[0]?.id || '';

    // 스마트스토어는 URL만 바꾸면 1페이지로 되돌아가서 실제 페이지 버튼을 눌러야 한다.
    for (let pageNumber = 2; pageNumber <= Math.min(pageCount, 5); pageNumber += 1) {
      const clicked = await clickSmartStorePage(hiddenWindow, pageNumber);
      if (!clicked) break;

      const page = await waitForSmartStoreProducts(hiddenWindow, previousFirstId);
      if (page.products.length === 0) break;

      page.products.forEach((product) => productMap.set(product.id, product));
      previousFirstId = page.products[0]?.id || previousFirstId;
    }

    return [...productMap.values()];
  } finally {
    hiddenWindow.close();
  }
}

function getSmartStoreCategoryUrls(source) {
  return [source?.categoryUrl, ...(source?.categoryUrls || [])].filter(Boolean);
}

// 스마트스토어 내부 상품 API로 상세 본문(HTML)을 모아온다.
// 스토어 홈을 연 페이지 안에서 fetch해야 네이버가 봇으로 막지 않는다.
async function fetchSmartStoreDetailContents(storeHomeUrl, productNos, { maxCount = 15, timeBudgetMs = 45000 } = {}) {
  const contents = new Map();
  if (productNos.length === 0) return contents;

  const hiddenWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    await hiddenWindow.loadURL(storeHomeUrl);
    const channelUid = await hiddenWindow.webContents.executeJavaScript(
      '(JSON.stringify(window.__PRELOADED_STATE__ || {}).match(/"channelUid"\\s*:\\s*"([^"]+)"/) || [])[1] || \'\'',
      true,
    ).catch(() => '');
    if (!channelUid) return contents;

    const startedAt = Date.now();
    let consecutiveFailures = 0;

    // 직렬 호출: 동시에 부르면 네이버 차단(429·캡차)만 빨라진다.
    for (const productNo of productNos.slice(0, maxCount)) {
      if (Date.now() - startedAt > timeBudgetMs || consecutiveFailures >= 2) break;

      const detailHtml = await hiddenWindow.webContents.executeJavaScript(`
        fetch('/i/v2/channels/${channelUid}/products/${productNo}?withWindow=false', {
          headers: { accept: 'application/json' },
          credentials: 'include',
        }).then((res) => (res.ok ? res.json() : null))
          .then((json) => {
            if (!json) return '';
            // 필드 이름이 바뀌어도 동작하도록, HTML로 보이는 가장 긴 문자열을 본문으로 삼는다.
            let best = '';
            const visit = (value) => {
              if (typeof value === 'string') {
                if (value.length > best.length && /<(img|p|div|table|span)/i.test(value)) best = value;
              } else if (value && typeof value === 'object') {
                Object.values(value).forEach(visit);
              }
            };
            visit(json);
            return best;
          })
          .catch(() => '')
      `, true).catch(() => '');

      if (detailHtml) {
        contents.set(String(productNo), String(detailHtml));
        consecutiveFailures = 0;
      } else {
        consecutiveFailures += 1;
      }
      await delay(400);
    }

    return contents;
  } finally {
    hiddenWindow.close();
  }
}

async function fetchSmartStoreCategoryProducts(sourceId) {
  const source = SMARTSTORE_SOURCES[sourceId];
  const categoryUrls = getSmartStoreCategoryUrls(source);
  if (categoryUrls.length === 0) return null;

  const productMap = new Map();
  const failures = [];
  for (const categoryUrl of categoryUrls) {
    try {
      const items = await crawlSmartStoreCategory(categoryUrl);
      console.log(`[beanpick:smartstore-category] ${sourceId} ${categoryUrl} raw ${items.length}개`);
      items.forEach((item) => productMap.set(item.id, { ...item, categoryUrl }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '알 수 없는 오류');
      failures.push(`${categoryUrl}: ${message}`);
      console.warn(`[beanpick:smartstore-category] ${sourceId} ${categoryUrl} 실패: ${message}`);
      // 한 카테고리가 실패해도 나머지 카테고리는 계속 확인한다.
    }
  }

  let products = normalizeSmartStoreCategoryItems(sourceId, [...productMap.values()]);
  console.log(`[beanpick:smartstore-category] ${sourceId} normalized ${products.length}개`);

  // 컵노트 보강 1단계: 노트 없는 상품만 썸네일 OCR
  products = await enrichProductsWithThumbnailOcr(products);

  // 컵노트 보강 1.5단계: 공식 검색 API 결과의 노트를 같은 상품(제목 일치)에 이식
  // (상세 페이지가 막혀 있어도 동작하는 안전한 통로)
  if (products.some((product) => product.tastingNotes.length === 0)) {
    try {
      const searchResult = await searchNaverShopping(sourceId);
      products = mergeNotesFromSearchResults(products, searchResult?.products || []);
    } catch {
      // 검색 API 실패(키 없음 등)는 무시
    }
  }

  // 컵노트 보강 2단계: 그래도 없으면 상품 상세 본문에서 추출 (실패해도 조용히 넘어감)
  const getProductNo = (product) => (String(product.productUrl).match(/\/products\/(\d+)/) || [])[1] || '';
  const missingNoteNos = products
    .filter((product) => product.tastingNotes.length === 0)
    .map(getProductNo)
    .filter(Boolean);
  const storeHomeUrl = (categoryUrls[0].match(/^(https:\/\/smartstore\.naver\.com\/[^/]+)/i) || [])[1] || '';

  if (missingNoteNos.length > 0 && storeHomeUrl) {
    try {
      const detailContents = await fetchSmartStoreDetailContents(storeHomeUrl, missingNoteNos);
      products = await mapWithConcurrency(products, 2, async (product) => {
        if (product.tastingNotes.length > 0) return product;

        const detailHtml = detailContents.get(getProductNo(product));
        if (!detailHtml) return product;

        const notes = await extractNotesFromDetail(detailHtml);
        return notes.length > 0 ? { ...product, tastingNotes: notes } : product;
      });
    } catch {
      // 상세 보강 실패는 무시하고 0·1단계 결과를 그대로 쓴다.
    }
  }

  return {
    ok: true,
    sourceId,
    sourceUrl: categoryUrls[0],
    query: '스마트스토어 카테고리',
    total: products.length,
    fetchedAt: new Date().toISOString(),
    products,
    warning: products.length === 0
      ? `${source.roasterName} 카테고리에서 상품을 찾지 못했습니다.${failures.length > 0 ? ` 실패: ${failures.join(' / ')}` : ''}`
      : '',
  };
}

function extractDetailUrls(html) {
  const urls = [...html.matchAll(/href=["']([^"']*\/product\/detail\/\?ItemCode=[^"']+)/gi)]
    .map((match) => match[1])
    .map((url) => (url.startsWith('http') ? url : `${TERAROSA_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`));

  return [...new Set(urls)];
}

function extractAnchorProductIds(html, categoryNo) {
  return [...html.matchAll(/<li\s+id=["']anchorBoxId_([^"']+)["'][\s\S]*?(?=<li\s+id=["']anchorBoxId_|<\/ul>)/gi)]
    .filter((match) => !categoryNo || match[0].includes('/category/' + categoryNo + '/') || match[0].includes('category/' + categoryNo) || match[0].includes('cate_no=' + categoryNo))
    .map((match) => match[1]);
}

function extractPageProductSignature(html, categoryNo) {
  const cafe24Ids = extractAnchorProductIds(html, categoryNo);
  if (cafe24Ids.length > 0) return cafe24Ids.join(',');

  return [...String(html || '').matchAll(/data-product-properties=["'][^"']*&quot;idx&quot;:\s*([^,&]+)[\s\S]*?["']/gi)]
    .map((match) => match[1])
    .join(',');
}

function buildMomosPageUrl(pageNumber) {
  return pageNumber === 1 ? MOMOS_SOURCE_URL : MOMOS_SOURCE_URL + '?page=' + pageNumber;
}

function buildOfficialMallPageUrl(config, pageNumber) {
  if (typeof config.pageUrl === 'function') return config.pageUrl(pageNumber);
  if (pageNumber === 1) return config.sourceUrl;
  const separator = config.sourceUrl.includes('?') ? '&' : '?';
  return config.sourceUrl + separator + 'page=' + pageNumber;
}

async function fetchHtmlPage(url, referer) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
      'User-Agent': 'BeanPick/0.1 local desktop app',
      Referer: referer,
    },
  });

  if (!response.ok) return null;

  const text = await response.text();
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    const body = JSON.parse(trimmed);
    return { url, html: String(body.html || '') };
  }

  return { url, html: text };
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

function encodeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripBasicHtml(value) {
  return decodeHtmlEntities(String(value || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function readImwebProductPropertiesFromBlock(block) {
  const rawProperties = block.match(/data-product-properties=(["'])([\s\S]*?)\1/i)?.[2] || '';
  if (!rawProperties) return null;

  try {
    return JSON.parse(decodeHtmlEntities(rawProperties));
  } catch {
    return null;
  }
}

function toAbsoluteOfficialUrl(url, origin) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  return origin + (url.startsWith('/') ? '' : '/') + url;
}

function extractImwebProductBlocks(html) {
  return [...String(html || '').matchAll(/<div\b[^>]*class=["'][^"']*\b_shop_item\b[^"']*["'][^>]*data-product-properties=["'][\s\S]*?(?=<div\b[^>]*class=["'][^"']*\b_shop_item\b|<div\b[^>]*class=["'][^"']*_more_btn_wrap\b|<\/section>|$)/gi)]
    .map((match) => match[0]);
}

function hasLikelyCenterCoffeeOcrNote(text) {
  return /shine\s*muscat|green\s*apple|melon|tasting\s*note|flavo[u]?r\s*&\s*aroma/i.test(text);
}

async function attachCenterCoffeeOcrText(page, config) {
  let html = page.html;
  const blocks = extractImwebProductBlocks(html);

  for (const block of blocks) {
    const properties = readImwebProductPropertiesFromBlock(block);
    if (!properties?.image_url) continue;

    const imageUrls = [
      properties.image_url,
      ...[...block.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]),
    ]
      .map((url) => toAbsoluteOfficialUrl(stripBasicHtml(String(url || '')), config.sourceUrl ? new URL(config.sourceUrl).origin : ''))
      .filter(Boolean);
    const uniqueImageUrls = [...new Set(imageUrls)].slice(0, 3);
    const ocrTexts = [];

    for (const imageUrl of uniqueImageUrls) {
      const text = await readOcrTextFromImageUrl(imageUrl, { lang: 'eng+kor', psm: 6, timeout: 25000 });
      if (!text) continue;

      ocrTexts.push(text);
      if (hasLikelyCenterCoffeeOcrNote(text)) break;
    }

    if (ocrTexts.length === 0) continue;

    const marker = '<span data-beanpick-ocr="' + encodeHtmlAttribute(ocrTexts.join('\n')) + '"></span>';
    html = html.replace(block, block.replace(/>/, '>' + marker));
  }

  return { ...page, html };
}


function extractTerarosaRows(payload) {
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.list)) return payload.list;
  return Array.isArray(payload) ? payload : [];
}

async function fetchTerarosaApiRows(cookie, csrfToken) {
  const rows = [];
  let totalPages = 1;

  for (let pageNumber = 1; pageNumber <= totalPages && pageNumber <= MAX_CATEGORY_PAGES; pageNumber += 1) {
    const apiResponse = await fetch(TERAROSA_PRODUCT_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'BeanPick/0.1 local desktop app',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: TERAROSA_PRODUCT_LIST_URL,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
      },
      body: new URLSearchParams({
        Category: TERAROSA_CATEGORY_NO,
        OrderBy: '',
        SearchText: '',
        Event: '',
        rmin: '',
        rmax: '',
        sub: '',
        gubun: 'product-list',
        GotoPage: String(pageNumber),
        PageSize: String(TERAROSA_PAGE_SIZE),
      }),
    });

    if (!apiResponse.ok) {
      throw new Error('Terarosa product API request failed (' + apiResponse.status + ')');
    }

    const apiJson = JSON.parse(await apiResponse.text());
    if (apiJson?.guard === 'fail') {
      throw new Error('Terarosa product API guard failed: ' + (apiJson.reason || 'unknown'));
    }

    const pageRows = extractTerarosaRows(apiJson);
    if (pageRows.length === 0) break;

    const pageCount = Number(pageRows[0]?.totalpage || apiJson?.totalpage || totalPages);
    if (Number.isFinite(pageCount) && pageCount > 0) totalPages = pageCount;
    rows.push(...pageRows);
  }

  return rows;
}

async function fetchDetailPages(urls, cookie) {
  const pages = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'BeanPick/0.1 local desktop app',
          Referer: TERAROSA_PRODUCT_LIST_URL,
          ...(cookie ? { Cookie: cookie } : {}),
        },
      });

      if (response.ok) {
        pages.push({ url, html: await response.text() });
      }
    } catch {
      // ?�세 ?�이지 ?��?가 ?�패?�도 ?�머지 ?�품?� 계속 보여줍니??
    }
  }

  return pages;
}

function isLikelyTerarosaBeanRow(row) {
  const name = String(row?.itemname || row?.itemName || row?.productName || '').toLowerCase();
  const blockedWords = [
    '???',
    '????',
    '????',
    '???',
    'rtd',
    '??',
    '????',
    '???',
    '??',
    'cup',
    'bag',
    'set',
    '??',
    'block',
    '????',
  ];
  const beanSignals = [
    '??',
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
    '?????',
    '??',
    '????',
    '???',
    '????',
    '???',
    '???',
    '????',
    '?????',
    '???',
    '???',
    '??',
    '???',
    '???',
    '???',
  ];

  if (blockedWords.some((word) => name.includes(word))) return false;
  return beanSignals.some((signal) => name.includes(signal));
}

function buildTerarosaDetailUrlsFromRows(rows) {
  return [...new Set(rows
    .filter(isLikelyTerarosaBeanRow)
    .map((row) => row?.itemkey || row?.itemKey || row?.ItemCode || row?.itemCode)
    .filter(Boolean)
    .map((itemCode) => TERAROSA_ORIGIN + '/product/detail/?ItemCode=' + encodeURIComponent(String(itemCode))))];
}

function toTerarosaAbsoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return TERAROSA_ORIGIN + (url.startsWith('/') ? '' : '/') + url;
}

function extractTerarosaDetailImageUrls(html) {
  const imageUrls = [...html.matchAll(/<img[^>]+(?:src|data-src|srcset)=['"]([^'"]+)['"][^>]*>/gi)]
    .map((match) => match[1])
    .filter((url) => /(?:AttEdit\/smart_editor|UpImg\/item\/detail|\/product\/[^'"]+\/detail\/)/i.test(url))
    .map(toTerarosaAbsoluteUrl)
    .filter(Boolean);
  const smartEditorImages = imageUrls.filter((url) => /\/AttEdit\/smart_editor\//i.test(url));
  const ownDetailImages = imageUrls.filter((url) => /\/UpImg\/item\/detail\//i.test(url));
  const productDetailImages = imageUrls.filter((url) => /\/product\/[^/]+\/detail\//i.test(url));

  return [...new Set([...smartEditorImages, ...ownDetailImages, ...productDetailImages])];
}

function hasTerarosaTastingNoteText(text) {
  return /tasting\s*note|flavo[u]?r\s*&\s*aroma|cup\s*note|dried\s*fruits?|sweet\s*acidity|long\s*aftertaste|nectarine|tropical\s*fruit|pecan|baked\s*apple|butterscotch|prune|cashew|white\s*chocolate/i.test(text);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function attachTerarosaOcrText(detailPages) {
  return mapWithConcurrency(detailPages, 2, async (page) => {
    const ocrTexts = [];
    const imageUrls = extractTerarosaDetailImageUrls(page.html).slice(0, 8);

    for (const imageUrl of imageUrls) {
      const text = await readOcrTextFromImageUrl(imageUrl, { lang: 'eng+kor', psm: 6, timeout: 25000 });
      if (!text) continue;

      ocrTexts.push(text);
      if (hasTerarosaTastingNoteText(text)) break;
    }

    return {
      ...page,
      ocrText: ocrTexts.join('\n'),
    };
  });
}

async function fetchTerarosaProducts() {
  const htmlResponse = await fetch(TERAROSA_PRODUCT_LIST_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'BeanPick/0.1 local desktop app',
      Referer: TERAROSA_SOURCE_URL,
    },
  });

  if (!htmlResponse.ok) {
    throw new Error('Terarosa product page request failed (' + htmlResponse.status + ')');
  }

  const html = await htmlResponse.text();
  const csrfToken = extractCsrfToken(html);
  const cookie = createCookieHeader(htmlResponse.headers);

  try {
    const apiRows = await fetchTerarosaApiRows(cookie, csrfToken);
    const detailUrls = buildTerarosaDetailUrlsFromRows(apiRows);
    const detailPages = await attachTerarosaOcrText(await fetchDetailPages(detailUrls, cookie));

    return {
      ok: true,
      html,
      apiRows,
      detailPages,
      fetchedAt: new Date().toISOString(),
      sourceUrl: TERAROSA_PRODUCT_LIST_URL,
    };
  } catch (error) {
    const fallbackResponse = await fetch(TERAROSA_SOURCE_URL, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'BeanPick/0.1 local desktop app',
        Referer: TERAROSA_PRODUCT_LIST_URL,
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    const fallbackHtml = fallbackResponse.ok ? await fallbackResponse.text() : html;

    const detailPages = await attachTerarosaOcrText(await fetchDetailPages(extractDetailUrls(fallbackHtml), cookie));

    return {
      ok: true,
      html: fallbackHtml,
      apiRows: [],
      detailPages,
      fetchedAt: new Date().toISOString(),
      sourceUrl: TERAROSA_SOURCE_URL,
      warning: error instanceof Error ? error.message : 'Terarosa product API could not be read.',
    };
  }
}
async function fetchMomosProducts() {
  const pages = [];
  const seenSignatures = new Set();

  for (let pageNumber = 1; pageNumber <= MAX_CATEGORY_PAGES; pageNumber += 1) {
    try {
      const page = await fetchHtmlPage(buildMomosPageUrl(pageNumber), MOMOS_SOURCE_URL);
      if (!page) continue;

      const productIds = extractAnchorProductIds(page.html, MOMOS_CATEGORY_NO);
      const signature = productIds.join(',');
      if (pageNumber > 1 && (productIds.length === 0 || seenSignatures.has(signature))) break;

      pages.push(page);
      seenSignatures.add(signature);
    } catch {
      // Keep using the other category pages when one page fails.
    }
  }

  if (pages.length === 0) {
    throw new Error('Momos product pages could not be loaded.');
  }

  return {
    ok: true,
    html: pages[0]?.html || '',
    pages,
    fetchedAt: new Date().toISOString(),
    sourceUrl: MOMOS_SOURCE_URL,
  };
}
function absolutizeImageUrl(src, baseUrl) {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  if (src.startsWith('//')) return `https:${src}`;
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return '';
  }
}

async function buildDetailDataFromDetails(items, referer, concurrency = 5, gapMs = 100) {
  const stock = new Map();
  const info = new Map();
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const myIndex = cursor;
      cursor += 1;
      const { productNo, detailUrl } = items[myIndex];
      try {
        const detail = await fetchHtmlPage(detailUrl, referer);
        if (detail) {
          stock.set(productNo, isSoldOutFromHtml(detail.html));
          const parsed = parseCafe24DetailInfo(detail.html);
          // 1차로 HTML 텍스트에서 블렌딩 구성 시도
          const textBlend = extractBlendComposition([parsed.description, parsed.tastingNotes].filter(Boolean).join('\n'));
          if (textBlend.length) parsed.blendComposition = textBlend;
          // OCR 트리거: 노트가 비었거나 블렌딩 정보가 아직 없을 때 본문 이미지 OCR
          const needsOcr = !parsed.tastingNotes || !parsed.blendComposition;
          if (needsOcr) {
            const imgs = extractDetailContentImageUrls(detail.html);
            const ocrChunks = [];
            for (const src of imgs) {
              const abs = absolutizeImageUrl(src, detailUrl);
              if (!abs) continue;
              try {
                const text = await readOcrTextFromImageUrl(abs, { lang: 'eng+kor', psm: 6, timeout: 15000 });
                if (text) ocrChunks.push(text);
              } catch {
                // OCR 실패 시 무시
              }
            }
            if (ocrChunks.length) {
              parsed.ocrText = ocrChunks.join('\n');
              if (!parsed.blendComposition) {
                const ocrBlend = extractBlendComposition(parsed.ocrText);
                if (ocrBlend.length) parsed.blendComposition = ocrBlend;
              }
            }
          }
          info.set(productNo, parsed);
        }
      } catch {
        // 상세 페이지를 못 받으면 목록 표시를 유지해서 안전하게 품절 처리.
      }
      if (gapMs > 0) await delay(gapMs);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return { stock, info };
}

function injectDetailMarkerIntoBlock(html, productNo, info) {
  if (!info) return html;
  const marker = buildDetailInfoMarker(info);
  const re = new RegExp(`(<li\\s+id=["']anchorBoxId_${productNo}["'][^>]*>)`, 'i');
  return html.replace(re, (match) => `${match}${marker}`);
}

async function enrichPagesWithDetailStock(pages, config) {
  const referer = config.sourceUrl;
  const origin = config.detailOrigin || (config.sourceUrl ? new URL(config.sourceUrl).origin : '');
  if (!origin) return pages;

  const enriched = [];
  for (const page of pages) {
    const items = extractCafe24ListItemLinks(page.html, origin);
    if (items.length === 0) {
      enriched.push(page);
      continue;
    }
    const { stock, info } = await buildDetailDataFromDetails(items, referer);
    let nextHtml = stripCafe24FalseSoldOutMarkup(page.html, stock);
    for (const [productNo, detailInfo] of info.entries()) {
      nextHtml = injectDetailMarkerIntoBlock(nextHtml, productNo, detailInfo);
    }
    enriched.push({ ...page, html: nextHtml });
  }
  return enriched;
}

async function fetchOfficialMallProducts(sourceId) {
  const config = OFFICIAL_MALL_PAGE_CONFIGS[sourceId];
  if (!config) {
    throw new Error('Unsupported official mall: ' + sourceId);
  }

  const pages = [];
  const seenSignatures = new Set();
  const maxPages = config.maxPages || (config.categoryNo ? MAX_CATEGORY_PAGES : 1);

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    try {
      const url = buildOfficialMallPageUrl(config, pageNumber);
      const page = await fetchHtmlPage(url, config.sourceUrl);
      if (!page) continue;

      const enrichedPage = sourceId === 'centercoffee'
        ? await attachCenterCoffeeOcrText(page, config)
        : page;
      const signature = extractPageProductSignature(enrichedPage.html, config.categoryNo);
      if (pageNumber > 1 && (!signature || seenSignatures.has(signature))) break;

      pages.push(enrichedPage);
      seenSignatures.add(signature);
    } catch {
      // Keep using the other pages from the same mall when one page fails.
    }
  }

  if (pages.length === 0) {
    throw new Error(sourceId + ' product pages could not be loaded.');
  }

  const finalPages = config.verifyStockFromDetail
    ? await enrichPagesWithDetailStock(pages, config)
    : pages;

  return {
    ok: true,
    pages: finalPages,
    html: finalPages[0]?.html || '',
    fetchedAt: new Date().toISOString(),
    sourceUrl: config.sourceUrl,
  };
}
ipcMain.handle('beanpick:test-smartstore-search', async () => {
  try {
    return await testSmartStoreSearch();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'SmartStore search failed.',
    };
  }
});

ipcMain.handle('beanpick:fetch-smartstore-products', async (_event, sourceId) => {
  try {
    const source = SMARTSTORE_SOURCES[sourceId];
    if (getSmartStoreCategoryUrls(source).length > 0) {
      const categoryResult = await fetchSmartStoreCategoryProducts(sourceId);
      if (categoryResult?.products?.length) return categoryResult;
      console.warn(`[beanpick:smartstore-category] ${sourceId} 카테고리 결과가 없어 네이버 쇼핑 검색 API로 전환합니다. ${categoryResult?.warning || ''}`);
    }

    return await searchNaverShopping(sourceId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `${sourceId} SmartStore search failed.`,
    };
  }
});

ipcMain.handle('beanpick:fetch-terarosa-products', async () => {
  try {
    return await fetchTerarosaProducts();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '?�라로사 ?�이?��? 가?�오지 못했?�니??',
    };
  }
});

ipcMain.handle('beanpick:fetch-momos-products', async () => {
  try {
    return await fetchMomosProducts();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '모모?�커???�이?��? 가?�오지 못했?�니??',
    };
  }
});

ipcMain.handle('beanpick:fetch-official-mall-products', async (_event, sourceId) => {
  try {
    return await fetchOfficialMallProducts(sourceId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `${sourceId} ?�이?��? 가?�오지 못했?�니??`,
    };
  }
});

ipcMain.handle('beanpick:publish-iphone', async (_event, payload) => {
  const products = Array.isArray(payload?.products) ? payload.products : [];
  return await publishProductsToGitHub({ products });
});



app.whenReady().then(() => {
  // Windows 토스트 알림에 필요한 앱 식별자
  app.setAppUserModelId('com.beanpick.app');
  if (shouldPublishIphoneSnapshot) {
    runIphoneSnapshotPublish()
      .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      })
      .finally(() => {
        app.quit();
      });
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
