const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const {
  COMPLETENESS,
  combineListCompleteness,
  evaluateListCompleteness,
} = require('./collection/contract.cjs');
const { putRawObservation, pruneRawObservations } = require('./collection/rawStore.cjs');
const { getChannelId, findChannelByUrl } = require('./collection/registry.cjs');
const { pruneRuns } = require('./collection/runManager.cjs');
const { createCollectionEngine } = require('./collection/engine.cjs');

// 목록 원문을 해석한 추출기 버전. 원문은 그대로 두고 이 값만 올려 재해석할 수 있다.
const OFFICIAL_MALL_LIST_EXTRACTOR = 'officialMallList@1';
const SMARTSTORE_LIST_EXTRACTOR = 'smartStoreList@1';
const TERAROSA_LIST_EXTRACTOR = 'terarosaApiList@1';
// 공식몰(cafe24·imweb) 상세 원문을 해석한 추출기 버전.
const OFFICIAL_MALL_DETAIL_EXTRACTOR = 'officialMallDetail@1';
// 스마트스토어 상세 원문(상품 페이지 PRELOADED_STATE / 내부 API 응답)을 해석한 추출기 버전.
const SMARTSTORE_DETAIL_EXTRACTOR = 'smartStoreDetail@1';

// 원문 저장은 부가 기능이다. 실패해도 수집 결과에 영향을 주지 않는다.
function storeRawObservation(input) {
  try {
    return putRawObservation(input).observationId;
  } catch (error) {
    console.warn(`[beanpick:raw-store] ${input.channelId} 원문 저장 실패:`, error?.message || error);
    return '';
  }
}
const {
  SMARTSTORE_SOURCES,
  applySmartStoreDetailInfo,
  buildSmartStoreDetailImageUrlsScript,
  buildSmartStorePriceOptionsFromDetail,
  getSmartStorePriceOptionsStatus,
  countRecognizedTastingNotes,
  enrichProductsWithThumbnailOcr,
  extractNotesFromDetail,
  extractNotesFromPreloadedDetailText,
  mergeTastingNotes,
  mergeNotesFromSearchResults,
  loadLocalEnv,
  normalizeSmartStoreCategoryItems,
  planSmartStoreDetailTargets,
  readSmartStoreDetailCache,
  readOfficialMallImageText,
  searchNaverCommerce,
  searchNaverShopping,
  testSmartStoreSearch,
  writeSmartStoreDetailCache,
} = require('./naverShoppingSearch.cjs');
const {
  isSoldOutFromHtml,
  extractCafe24ListItemLinks,
  stripCafe24FalseSoldOutMarkup,
} = require('../src/services/adapters/stockStatus.cjs');
const {
  parseCafe24DetailInfo,
  buildDetailInfoMarker,
  fetchCafe24DetailWithRetry,
  extractImwebPriceOptions,
  extractImwebOmsPriceOptions,
  extractDetailContentImageUrls,
  extractBlendComposition,
} = require('../src/services/adapters/cafe24DetailParser.cjs');
const { enrichProductsWithUnspecialtyNotes } = require('./noteSources/unspecialty.cjs');
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
const MOMOS_SOURCE_URL = 'https://momos.co.kr/shop';
const MAX_CATEGORY_PAGES = 5;
const SMARTSTORE_PAGE_LOAD_TIMEOUT_MS = 25000;
// 총 개수를 못 읽었을 때만 쓰는 기준값. 실제 페이지 크기는 첫 페이지 관측값을 우선한다.
const SMARTSTORE_DEFAULT_PAGE_SIZE = 40;
const SMARTSTORE_PAGE_LOAD_RETRIES = 1;
// 공식몰 상세보강(노트·재고)은 부가 기능이라 전체 시간 예산을 둔다.
// 예산을 넘겨도 상품 목록은 항상 반환되어, 한 곳의 상세수집이 멈춰도 그 로스터 상품이 통째로 사라지지 않는다.
const OFFICIAL_ENRICH_BUDGET_MS = 90000;
const { OFFICIAL_MALL_PAGE_CONFIGS } = require('./collection/officialMallSources.cjs');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: 'Beanly',
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

async function clickRendererButton(window, label) {
  const state = await window.webContents.executeJavaScript(`
    (() => {
      const targetLabel = ${JSON.stringify(label)};
      const buttons = [...document.querySelectorAll('button')];
      const button = buttons.find((item) => (item.innerText || '').trim() === targetLabel);
      if (!button) {
        return { ok: false, message: targetLabel + ' 버튼을 찾지 못했습니다.' };
      }
      if (button.disabled) {
        return { ok: false, message: targetLabel + ' 버튼이 비활성화되어 있습니다.' };
      }
      button.click();
      return { ok: true };
    })()
  `, true);

  if (!state?.ok) {
    throw new Error(state?.message || `${label} 버튼 실행 실패`);
  }
}

async function runIphoneSnapshotPublish() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    show: false,
    title: 'Beanly 자동 게시',
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
    await clickRendererButton(mainWindow, '오늘의 원두 불러오기');

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

    await clickRendererButton(mainWindow, '아이폰 게시');

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

async function loadUrlWithTimeout(window, url, timeoutMs = 5000, loadOptions = {}) {
  let finished = false;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try {
        window.webContents.stop();
      } catch (err) {
        // 무시
      }
      reject(new Error(`loadURL timeout: ${url}`));
    }, timeoutMs);

    window.loadURL(url, loadOptions)
      .then(() => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve();
      })
      .catch((err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function loadSmartStorePageWithRetry(window, url, loadOptions = {}) {
  let lastError;
  for (let attempt = 0; attempt <= SMARTSTORE_PAGE_LOAD_RETRIES; attempt += 1) {
    try {
      await loadUrlWithTimeout(window, url, SMARTSTORE_PAGE_LOAD_TIMEOUT_MS, loadOptions);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= SMARTSTORE_PAGE_LOAD_RETRIES) break;
      console.warn(`[beanpick:smartstore-category] loadURL 재시도 ${attempt + 1}/${SMARTSTORE_PAGE_LOAD_RETRIES}: ${url}`);
      await delay(1000);
    }
  }
  throw lastError;
}

// 숨김 창 안에서 도는 executeJavaScript가 끝나지 않을 때를 대비한 타임아웃 래퍼.
// 페이지 내부 fetch가 응답 없이 멈추면 executeJavaScript 프라미스가 영원히 안 풀려
// 전체 수집이 행에 걸리므로, Node 쪽에서 시간이 지나면 fallback 값으로 넘어간다.
// (멈춘 페이지 프라미스는 이후 창을 닫을 때 함께 정리된다.)
function executeJavaScriptWithTimeout(window, script, timeoutMs, fallback) {
  return Promise.race([
    window.webContents.executeJavaScript(script, true).catch(() => fallback),
    delay(timeoutMs).then(() => fallback),
  ]);
}

async function waitForSmartStoreDetailImageUrls(window, timeoutMs = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const imageUrls = await executeJavaScriptWithTimeout(
      window,
      buildSmartStoreDetailImageUrlsScript(),
      2000,
      [],
    );
    if (imageUrls.length > 0) return imageUrls;
    await delay(300);
  }

  return [];
}

async function loadSmartStoreCategoryEntry(window, categoryUrl) {
  const urlParts = String(categoryUrl || '').match(/^(https:\/\/smartstore\.naver\.com\/[^/]+)\/category\/([a-z0-9]+)/i);
  if (!urlParts) {
    await loadSmartStorePageWithRetry(window, categoryUrl);
    return;
  }

  // 카테고리 주소 직접 진입은 로그인 화면으로 돌아가므로, 홈에서 링크를 눌러 들어간다.
  await loadSmartStorePageWithRetry(window, urlParts[1]);
  const clicked = await clickSmartStoreCategoryLink(window, urlParts[2]);
  if (!clicked) await loadSmartStorePageWithRetry(window, categoryUrl);
}

// 어떤 비동기 작업이든 Node 쪽 타이머로 무조건 끝나게 만든다.
// AbortController가 (CI의 undici 환경에서) 멈춘 응답 본문 읽기를 못 끊는 경우를 대비한 이중 안전장치.
function withTimeout(promise, timeoutMs, fallback) {
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    delay(timeoutMs).then(() => fallback),
  ]);
}

// 상품 목록의 해석 전 마크업만 뽑는다. 페이지 전체 HTML은 너무 커서 보관 비용이 크다.
function readSmartStoreListMarkup(window) {
  return executeJavaScriptWithTimeout(window, `
    (() => {
      const nodes = [...document.querySelectorAll('[data-shp-contents-id][data-shp-contents-type="chnl_prod_no"]')];
      const seen = new Set();
      const parts = [];
      for (const node of nodes) {
        const id = node.getAttribute('data-shp-contents-id');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        parts.push((node.closest('li') || node).outerHTML);
      }
      return parts.join(String.fromCharCode(10));
    })()
  `, 5000, '');
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
    await loadSmartStoreCategoryEntry(hiddenWindow, categoryUrl);
    const firstPage = await waitForSmartStoreProducts(hiddenWindow);
    const productMap = new Map(firstPage.products.map((product) => [product.id, product]));
    const rawPages = [await readSmartStoreListMarkup(hiddenWindow)];
    // 페이지 크기는 가정하지 않고 첫 페이지에서 실제로 받은 개수를 쓴다.
    const pageSize = firstPage.products.length > 0 ? firstPage.products.length : SMARTSTORE_DEFAULT_PAGE_SIZE;
    const reportedTotal = Number(firstPage.total || 0);
    const hasReportedTotal = reportedTotal > 0;
    const pageCount = hasReportedTotal ? Math.max(1, Math.ceil(reportedTotal / pageSize)) : 1;
    const lastPage = Math.min(pageCount, MAX_CATEGORY_PAGES);
    let previousFirstId = firstPage.products[0]?.id || '';
    let pagesFetched = 1;
    let pagesFailed = 0;
    // 페이지를 끝까지 확인했는지 따로 남긴다. 중간에 끊긴 목록을 완전 수집으로 보지 않기 위해서다.
    // 총 개수를 못 읽었으면, 첫 페이지가 한 화면을 다 채우지 않았을 때만 끝을 확인한 것이다.
    let endConfirmed = hasReportedTotal ? pageCount <= 1 : firstPage.products.length < SMARTSTORE_DEFAULT_PAGE_SIZE;

    // 스마트스토어는 URL만 바꾸면 1페이지로 되돌아가서 실제 페이지 버튼을 눌러야 한다.
    for (let pageNumber = 2; pageNumber <= lastPage; pageNumber += 1) {
      const clicked = await clickSmartStorePage(hiddenWindow, pageNumber);
      if (!clicked) {
        pagesFailed += 1;
        break;
      }

      const page = await waitForSmartStoreProducts(hiddenWindow, previousFirstId);
      if (page.products.length === 0) {
        pagesFailed += 1;
        break;
      }

      pagesFetched += 1;
      page.products.forEach((product) => productMap.set(product.id, product));
      rawPages.push(await readSmartStoreListMarkup(hiddenWindow));
      previousFirstId = page.products[0]?.id || previousFirstId;
      if (pageNumber === lastPage) endConfirmed = pageCount <= MAX_CATEGORY_PAGES;
    }

    const products = [...productMap.values()];
    return {
      products,
      // 해석 전 목록 마크업. 추출 규칙을 고쳐도 이 원문으로 다시 해석할 수 있다.
      rawMarkup: rawPages.filter(Boolean).join('<!-- beanpick:page -->'),
      pagesFetched,
      pagesFailed,
      endConfirmed,
      expectedTotal: Number(firstPage.total || 0) || null,
      // 페이지 상한에 걸려 잘린 목록은 조용히 넘기지 않는다.
      truncated: pageCount > MAX_CATEGORY_PAGES,
      completeness: evaluateListCompleteness({
        pagesFetched,
        pagesFailed,
        endConfirmed,
        itemsFound: products.length,
      }),
    };
  } finally {
    hiddenWindow.close();
  }
}

function getSmartStoreCategoryUrls(source) {
  return [source?.categoryUrl, ...(source?.categoryUrls || [])].filter(Boolean);
}

function getSmartStoreProductNo(product) {
  if (typeof product === 'string') return product.match(/\d+/)?.[0] || '';
  return (String(product?.productUrl || '').match(/\/products\/(\d+)/) || [])[1] || '';
}

function needsSmartStoreDetail(product) {
  if (!product || typeof product === 'string') return true;
  const needsNotes = !Array.isArray(product.tastingNotes) || product.tastingNotes.length === 0;
  const needsOptions = !Array.isArray(product.priceOptions) || product.priceOptions.length === 0;
  return needsNotes || needsOptions;
}

// 스마트스토어 내부 상품 API로 상세 본문(HTML)과 페이지 내 용량 옵션을 모아온다.
// 스토어 홈을 연 페이지 안에서 fetch해야 네이버가 봇으로 막지 않는다.
async function fetchSmartStoreDetailContents(
  storeHomeUrl,
  products,
  { maxCount = 20, timeBudgetMs = 45000, retryEmptyOptionCaches = false } = {},
) {
  const contents = new Map();
  const targets = products
    .map((product) => ({ product, productNo: getSmartStoreProductNo(product) }))
    .filter((target) => target.productNo && needsSmartStoreDetail(target.product))
    .map((target) => {
      const cached = typeof target.product === 'object'
        ? readSmartStoreDetailCache(target.productNo, target.product)
        : null;
      const optionsIncomplete = cached && cached.priceOptionsStatus !== 'complete';
      const optionRetryAt = Date.parse(cached?.optionRetryAt || '');
      const shouldRetryOptions = retryEmptyOptionCaches
        && optionsIncomplete
        && (!Number.isFinite(optionRetryAt) || optionRetryAt <= Date.now());
      return {
        ...target,
        cached: shouldRetryOptions ? null : cached,
        retryEmptyOptions: shouldRetryOptions,
        lastOptionAttemptAt: Date.parse(cached?.cachedAt || '') || 0,
      };
    });
  if (targets.length === 0) return contents;

  const { cachedTargets, pendingTargets } = planSmartStoreDetailTargets(targets, maxCount);
  cachedTargets.forEach(({ productNo, cached }) => contents.set(String(productNo), cached));
  if (pendingTargets.length === 0) return contents;

  const hiddenWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  const detailImageWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    await loadSmartStoreCategoryEntry(hiddenWindow, storeHomeUrl);
    const channelUid = await executeJavaScriptWithTimeout(
      hiddenWindow,
      '(JSON.stringify(window.__PRELOADED_STATE__ || {}).match(/"channelUid"\\s*:\\s*"([^"]+)"/) || [])[1] || \'\'',
      8000,
      '',
    );

    const startedAt = Date.now();
    let consecutiveApiFailures = 0;

    // 직렬 호출: 동시에 부르면 네이버 차단(429·캡차)만 빨라진다.
    for (const { product, productNo } of pendingTargets) {
      if (Date.now() - startedAt > timeBudgetMs) break;

      let detailPayload = null;
      let triedApi = false;
      const groupedOptionPayload = await executeJavaScriptWithTimeout(hiddenWindow, `
        (() => {
          const json = window.__PRELOADED_STATE__ || {};
          const targetNo = Number(${JSON.stringify(productNo)});
          const candidates = [];
          const visit = (value) => {
            if (!value || typeof value !== 'object') return;
            if (!Array.isArray(value) && Number(value.id) && typeof value.name === 'string' && Number(value.salePrice)) {
              candidates.push(value);
            }
            Object.values(value).forEach(visit);
          };
          visit(json);

          const target = candidates.find((item) => {
            const groupNos = item.simpleStandardGroupProduct?.channelProductNos || [];
            return Number(item.id) === targetNo || groupNos.map(Number).includes(targetNo);
          });
          const groupNos = target?.simpleStandardGroupProduct?.channelProductNos?.map(Number) || [];
          const optionProductNos = [...new Set([targetNo, ...groupNos])];
          if (!target) return null;

          const findDetailText = (value) => {
            const direct = value?.detailContents?.detailContentText
              || value?.detailContents?.detailHtml
              || value?.detailContents?.detailContent
              || '';
            if (typeof direct === 'string' && direct.trim()) return direct;

            let best = '';
            const visitText = (item, key = '') => {
              if (/review|qna|delivery|benefit|purchaseReview/i.test(key)) return;
              if (typeof item === 'string') {
                const text = item.trim();
                if (
                  text.length > best.length
                  && text.length >= 120
                  && !/^https?:\\/\\//i.test(text)
                  && (/<(img|p|div|table|span)/i.test(text) || /detail|content|description|소개|설명/i.test(key) || /컵노트|향미|tasting\\s*note|cup\\s*note/i.test(text))
                ) {
                  best = text;
                }
              } else if (item && typeof item === 'object') {
                Object.entries(item).forEach(([childKey, childValue]) => visitText(childValue, key ? key + '.' + childKey : childKey));
              }
            };
            visitText(value);
            return best;
          };

          const storeId = location.pathname.split('/').filter(Boolean)[0] || '';
          let rawState = '';
          try { rawState = JSON.stringify(json); } catch (e) { rawState = ''; }
          return {
            rawState,
            detailText: findDetailText(target),
            optionCombinations: candidates
              .filter((item) => optionProductNos.includes(Number(item.id)))
              .map((item) => ({
                optionName: item.name,
                absolutePrice: item.salePrice,
                originalPrice: item.benefitsView?.mobileDiscountedSalePrice || item.benefitsView?.discountedSalePrice || item.salePrice,
                productUrl: storeId ? 'https://smartstore.naver.com/' + storeId + '/products/' + item.id : '',
                usable: item.displayable !== false && item.productStatusType !== 'OUTOFSTOCK',
                stockQuantity: item.stockQuantity,
              })),
            expectedOptionCount: optionProductNos.length,
            optionCollectionComplete: true,
          };
        })()
      `, 8000, null);

      if (groupedOptionPayload?.optionCombinations?.length) {
        detailPayload = {
          rawState: groupedOptionPayload.rawState || '',
          detailText: groupedOptionPayload.detailText || '',
          optionCombinations: groupedOptionPayload.optionCombinations,
          expectedOptionCount: groupedOptionPayload.expectedOptionCount,
          optionCollectionComplete: groupedOptionPayload.optionCollectionComplete === true,
        };
      } else if (groupedOptionPayload?.detailText) {
        detailPayload = {
          rawState: groupedOptionPayload.rawState || '',
          detailText: groupedOptionPayload.detailText,
        };
      } else if (channelUid && consecutiveApiFailures < 2) {
        triedApi = true;
        detailPayload = await executeJavaScriptWithTimeout(hiddenWindow, `
          fetch('/i/v2/channels/${channelUid}/products/${productNo}?withWindow=false', {
            headers: { accept: 'application/json' },
            credentials: 'include',
            signal: AbortSignal.timeout(8000),
          }).then((res) => (res.ok ? res.json() : null))
            .then((json) => {
              if (!json) return null;
              // 필드 이름이 바뀌어도 동작하도록, HTML로 보이는 가장 긴 문자열을 본문으로 삼는다.
              let best = '';
              const findOptionCombinations = (value) => {
                if (!value || typeof value !== 'object') return [];
                if (Array.isArray(value.optionCombinations)) return value.optionCombinations;
                if (Array.isArray(value)) {
                  for (const item of value) {
                    const found = findOptionCombinations(item);
                    if (found.length > 0) return found;
                  }
                  return [];
                }
                for (const item of Object.values(value)) {
                  const found = findOptionCombinations(item);
                  if (found.length > 0) return found;
                }
                return [];
              };
              const visit = (value) => {
                if (typeof value === 'string') {
                  if (value.length > best.length && /<(img|p|div|table|span)/i.test(value)) best = value;
                } else if (value && typeof value === 'object') {
                  Object.values(value).forEach(visit);
                }
              };
              visit(json);
              const optionCombinations = findOptionCombinations(json);
              let rawJson = '';
              try { rawJson = JSON.stringify(json); } catch (e) { rawJson = ''; }
              return {
                rawJson,
                detailHtml: best,
                optionCombinations,
                expectedOptionCount: optionCombinations.length,
                optionCollectionComplete: true,
              };
            })
            .catch(() => null)
        `, 10000, null);
      }

      let detailImageUrls = [];
      let detailImagesChecked = false;
      const needsRenderedDetailImages = typeof product === 'object'
        && (!Array.isArray(product.tastingNotes) || product.tastingNotes.length <= 1)
        && product.productUrl;
      if (needsRenderedDetailImages && Date.now() - startedAt <= timeBudgetMs) {
        try {
          await loadSmartStorePageWithRetry(detailImageWindow, product.productUrl, { httpReferrer: storeHomeUrl });
          const loadedProductNo = await executeJavaScriptWithTimeout(
            detailImageWindow,
            '(location.pathname.match(/\\/products\\/(\\d+)/) || [])[1] || \'\'',
            2000,
            '',
          );
          if (String(loadedProductNo) !== String(productNo)) throw new Error('SmartStore product page redirected.');
          detailImageUrls = await waitForSmartStoreDetailImageUrls(detailImageWindow);
          detailImagesChecked = true;
        } catch {
          // 다음 수집에서 다시 시도할 수 있도록 확인 완료로 기록하지 않는다.
        }
      }

      const detailHtml = String(detailPayload?.detailHtml || '');
      const detailText = String(detailPayload?.detailText || '');
      const priceOptions = typeof product === 'object'
        ? buildSmartStorePriceOptionsFromDetail(detailPayload || {}, product)
        : [];
      const priceOptionsStatus = getSmartStorePriceOptionsStatus(detailPayload || {}, priceOptions);
      if (detailHtml || detailText || detailImageUrls.length > 0 || priceOptions.length > 0) {
        const detailInfo = { detailHtml, detailText, detailImageUrls, detailImagesChecked, priceOptions, priceOptionsStatus };
        contents.set(String(productNo), detailInfo);
        if (typeof product === 'object') writeSmartStoreDetailCache(productNo, product, detailInfo);
      } else {
        if (typeof product === 'object' && (triedApi || !channelUid)) {
          writeSmartStoreDetailCache(productNo, product, { status: 'empty', detailImagesChecked, priceOptionsStatus });
        }
      }
      // 상세 원문 보존(7단계 4단계 원문 분리의 스마트스토어 상세 몫). 해석 전 본문을 남겨 재해석할 수 있게 한다.
      // 캐시의 detailHtml/detailText는 이미 해석·선별된 값이라 원문 대신 못 쓴다(실측: detailHtml 905개 전부 0바이트).
      if (typeof product === 'object' && product.productUrl) {
        const rawDetailBody = String(detailPayload?.rawState || detailPayload?.rawJson || '');
        if (rawDetailBody || detailHtml || detailText) {
          storeRawObservation({
            channelId: findChannelByUrl(product.productUrl)?.channelId || '',
            url: product.productUrl,
            body: rawDetailBody || detailHtml || detailText,
            contentType: rawDetailBody ? 'application/json' : 'text/html',
            extractorVersion: SMARTSTORE_DETAIL_EXTRACTOR,
          });
        }
      }
      if (triedApi) {
        const apiReturnedDetail = Boolean(
          detailPayload?.detailHtml
          || detailPayload?.detailText
          || detailPayload?.optionCombinations?.length,
        );
        consecutiveApiFailures = apiReturnedDetail ? 0 : consecutiveApiFailures + 1;
      }
      await delay(400);
    }

    return contents;
  } finally {
    hiddenWindow.close();
    detailImageWindow.close();
  }
}

async function enrichSmartStoreProductsWithDetailInfo(source, products) {
  const storeHomeUrl = (
    getSmartStoreCategoryUrls(source)[0]
    || source?.storeUrl
    || ''
  ).match(/^(https:\/\/smartstore\.naver\.com\/[^?#]+)/i)?.[1] || '';
  if (!storeHomeUrl || products.length === 0) return products;

  const detailContents = await fetchSmartStoreDetailContents(storeHomeUrl, products, {
    retryEmptyOptionCaches: source?.retryEmptyOptionCaches === true,
  });
  if (detailContents.size === 0) return products;

  return mapWithConcurrency(products, 2, async (product) => {
    const detailInfo = detailContents.get(getSmartStoreProductNo(product));
    if (!detailInfo) return product;

    let nextProduct = applySmartStoreDetailInfo(product, detailInfo);
    if (detailInfo.detailHtml || detailInfo.detailImageUrls?.length) {
      const maxImages = nextProduct.tastingNotes.length <= 1 ? 4 : 0;
      const notes = await extractNotesFromDetail(detailInfo.detailHtml, {
        maxImages,
        imageUrls: detailInfo.detailImageUrls,
      });
      if (notes.length > 0) {
        nextProduct = { ...nextProduct, tastingNotes: mergeTastingNotes(nextProduct.tastingNotes, notes) };
      }
    }
    if (detailInfo.detailText) {
      const notes = extractNotesFromPreloadedDetailText(detailInfo.detailText);
      if (notes.length > 0) {
        nextProduct = { ...nextProduct, tastingNotes: mergeTastingNotes(nextProduct.tastingNotes, notes) };
      }
    }

    return nextProduct;
  });
}

async function enrichSmartStoreProductsWithExternalNotes(sourceId, products) {
  const missingBefore = products.filter((product) => !product.tastingNotes?.length).length;
  if (missingBefore === 0) return products;

  try {
    const enrichedProducts = await enrichProductsWithUnspecialtyNotes(sourceId, products);
    const missingAfter = enrichedProducts.filter((product) => !product.tastingNotes?.length).length;
    if (missingAfter < missingBefore) {
      console.log(`[beanpick:note-source] unspecialty ${sourceId} filled ${missingBefore - missingAfter} notes`);
    }
    return enrichedProducts;
  } catch (error) {
    console.warn(`[beanpick:note-source] unspecialty ${sourceId} skipped: ${error instanceof Error ? error.message : String(error || '')}`);
    return products;
  }
}

async function fetchSmartStoreCategoryProducts(sourceId) {
  const source = SMARTSTORE_SOURCES[sourceId];
  const categoryUrls = getSmartStoreCategoryUrls(source);
  if (categoryUrls.length === 0) return null;
  const startedMs = Date.now();

  const productMap = new Map();
  const failures = [];
  const categoryResults = [];
  for (const categoryUrl of categoryUrls) {
    try {
      const crawled = await crawlSmartStoreCategory(categoryUrl);
      console.log(`[beanpick:smartstore-category] ${sourceId} ${categoryUrl} raw ${crawled.products.length}개 (${crawled.completeness}${crawled.truncated ? ', 페이지 상한으로 잘림' : ''})`);
      crawled.products.forEach((item) => productMap.set(item.id, { ...item, categoryUrl }));
      const observationId = storeRawObservation({
        channelId: getChannelId(sourceId),
        url: categoryUrl,
        body: crawled.rawMarkup || '',
        contentType: 'text/html',
        extractorVersion: SMARTSTORE_LIST_EXTRACTOR,
      });
      categoryResults.push({
        observationId,
        categoryUrl,
        completeness: crawled.completeness,
        items: crawled.products.length,
        pagesFetched: crawled.pagesFetched,
        pagesFailed: crawled.pagesFailed,
        expectedTotal: crawled.expectedTotal,
        truncated: crawled.truncated,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '알 수 없는 오류');
      failures.push(`${categoryUrl}: ${message}`);
      categoryResults.push({ categoryUrl, completeness: COMPLETENESS.FAILED, items: 0, pagesFetched: 0, pagesFailed: 1, expectedTotal: null, truncated: false, error: message });
      console.warn(`[beanpick:smartstore-category] ${sourceId} ${categoryUrl} 실패: ${message}`);
      // 한 카테고리가 실패해도 나머지 카테고리는 계속 확인한다.
    }
  }

  const listCompleteness = combineListCompleteness(categoryResults.map((entry) => entry.completeness));

  let products = normalizeSmartStoreCategoryItems(sourceId, [...productMap.values()]);
  console.log(`[beanpick:smartstore-category] ${sourceId} normalized ${products.length}개`);

  // 컵노트 보강 1단계: 노트 없는 상품만 썸네일 OCR
  products = await enrichProductsWithThumbnailOcr(products);

  // 컵노트 보강 2단계 + 페이지 내 용량 옵션 보강: 같은 상세 API 응답을 재사용한다.
  if (products.some(needsSmartStoreDetail)) {
    try {
      products = await enrichSmartStoreProductsWithDetailInfo(source, products);
    } catch {
      // 상세 보강 실패는 무시하고 0·1단계 결과를 그대로 쓴다.
    }
  }

  products = await enrichSmartStoreProductsWithExternalNotes(sourceId, products);

  // 판매처별 상태와 소요시간을 로그에 남긴다. 자동게시 로그에는 지금까지 이 값이 없었다.
  console.log(`[beanpick:source-run] ${sourceId} ${listCompleteness} 상품 ${products.length}개 ${Date.now() - startedMs}ms`);

  return {
    ok: true,
    sourceId,
    sourceUrl: categoryUrls[0],
    query: '스마트스토어 카테고리',
    total: products.length,
    fetchedAt: new Date().toISOString(),
    products,
    // 목록을 끝까지 확인했는지, 일부만 받았는지 성공/실패와 별개로 남긴다.
    listCompleteness,
    categoryResults,
    warning: products.length === 0
      ? `${source.roasterName} 카테고리에서 상품을 찾지 못했습니다.${failures.length > 0 ? ` 실패: ${failures.join(' / ')}` : ''}`
      : (listCompleteness !== COMPLETENESS.COMPLETE
        ? `${source.roasterName} 목록을 끝까지 확인하지 못했습니다(${listCompleteness}).${failures.length > 0 ? ` 실패: ${failures.join(' / ')}` : ''}`
        : ''),
  };
}

function extractDetailUrls(html) {
  const urls = [...html.matchAll(/href=["']([^"']*\/product\/detail\/\?ItemCode=[^"']+)/gi)]
    .map((match) => match[1])
    .map((url) => (url.startsWith('http') ? url : `${TERAROSA_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`));

  return [...new Set(urls)];
}

function fetchHtmlPage(url, referer) {
  // AbortController(12초)에 더해 Node 쪽 하드 타임아웃(15초)으로 이중 보호한다.
  // CI에서 서버가 응답 본문을 멈춘 채 물고 있으면 abort 신호가 안 닿아 무한 대기하는데(발행 행의 실제 원인),
  // 이때 Node 타이머가 무조건 null로 넘어가게 한다.
  return withTimeout(fetchHtmlPageRaw(url, referer), 15000, null);
}

async function fetchHtmlPageRaw(url, referer) {
  const controller = new AbortController();
  // 공식몰 상세 페이지(werk·fritz·502·커피리브레 등)는 5초로는 자주 끊겨 노트가 누락된다.
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'BeanPick/0.1 local desktop app',
        Referer: referer,
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const text = await response.text();
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      const body = JSON.parse(trimmed);
      return { url, html: String(body.html || '') };
    }

    return { url, html: text };
  } catch (error) {
    console.error(`[beanpick:fetchHtmlPage-fail] url=${url} error:`, error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
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

function buildOfficialMallPageUrl(config, pageNumber) {
  if (typeof config.pageUrl === 'function') return config.pageUrl(pageNumber);
  if (pageNumber === 1) return config.sourceUrl;
  const separator = config.sourceUrl.includes('?') ? '&' : '?';
  return config.sourceUrl + separator + 'page=' + pageNumber;
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
      const text = await readOfficialMallImageText(imageUrl, { lang: 'eng+kor', psm: 6, timeout: 25000 });
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
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
        signal: controller.signal,
      });

      if (!apiResponse.ok) {
        throw new Error('Terarosa product API request failed (' + apiResponse.status + ')');
      }

      const apiText = await apiResponse.text();
      // 해석 전 API 응답 본문을 그대로 남긴다. 추출 규칙을 고쳐도 이 원문으로 다시 해석할 수 있다.
      storeRawObservation({
        channelId: getChannelId('terarosa'),
        url: `${TERAROSA_PRODUCT_API_URL}#page=${pageNumber}`,
        body: apiText,
        contentType: 'application/json',
        extractorVersion: TERAROSA_LIST_EXTRACTOR,
      });
      const apiJson = JSON.parse(apiText);
      if (apiJson?.guard === 'fail') {
        throw new Error('Terarosa product API guard failed: ' + (apiJson.reason || 'unknown'));
      }

      const pageRows = extractTerarosaRows(apiJson);
      if (pageRows.length === 0) break;

      const pageCount = Number(pageRows[0]?.totalpage || apiJson?.totalpage || totalPages);
      if (Number.isFinite(pageCount) && pageCount > 0) totalPages = pageCount;
      rows.push(...pageRows);
    } catch (error) {
      console.error(`[beanpick:fetchTerarosaApiRows-fail] page=${pageNumber} error:`, error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return rows;
}

async function fetchDetailPages(urls, cookie) {
  const pages = [];

  for (const url of urls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'BeanPick/0.1 local desktop app',
          Referer: TERAROSA_PRODUCT_LIST_URL,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        signal: controller.signal,
      });

      if (response.ok) {
        pages.push({ url, html: await response.text() });
      }
    } catch {
      // 상세페이지 로드 실패 시 무시
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return pages;
}

function isLikelyTerarosaBeanRow(row) {
  const name = String(row?.itemname || row?.itemName || row?.productName || '').toLowerCase();
  if (!name.trim()) return false;

  // 명백한 비(非)원두 상품만 제외하고 나머지는 통과시킨다.
  // (최종 원두 판별은 뒤단 isLikelyBeanProduct/무게 필터가 담당)
  const blockedWords = [
    'rtd', 'cup', 'bag', 'set', 'block',
    '드립백', '드립 백', '캡슐', '굿즈', '머그', '텀블러', '기프트', '세트',
  ];
  return !blockedWords.some((word) => name.includes(word));
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

// 행 목록에서 ItemCode → 목록 썸네일 주소 지도를 만든다. (노트가 박힌 이미지는 보통 이 썸네일)
function buildTerarosaThumbnailMap(rows) {
  const map = {};
  for (const row of rows.filter(isLikelyTerarosaBeanRow)) {
    const itemCode = String(row?.itemkey || row?.itemKey || row?.ItemCode || row?.itemCode || '');
    const thumb = toTerarosaAbsoluteUrl(String(
      row?.img_list || row?.imgList || row?.imageUrl || row?.image || row?.thumbnail || row?.thumb || '',
    ));
    if (itemCode && thumb && !map[itemCode]) map[itemCode] = thumb;
  }
  return map;
}

async function attachTerarosaOcrText(detailPages, thumbnailByItemCode = {}) {
  return mapWithConcurrency(detailPages, 2, async (page) => {
    const ocrTexts = [];
    let bestOcrText = '';
    let bestNoteCount = 0;
    // 노트는 상세 이미지보다 목록 썸네일에 박혀 있는 경우가 많아 썸네일을 먼저 읽는다.
    const itemCode = decodeURIComponent(page.url.match(/ItemCode=([^&]+)/i)?.[1] || '');
    const thumbnailUrl = itemCode ? thumbnailByItemCode[itemCode] : '';
    const imageTargets = [
      ...(thumbnailUrl ? [{ imageUrl: thumbnailUrl, isThumbnail: true }] : []),
      ...extractTerarosaDetailImageUrls(page.html).slice(0, 8)
        .map((imageUrl) => ({ imageUrl, isThumbnail: false })),
    ];
    let thumbnailNoteCount = 0;

    for (const { imageUrl, isThumbnail } of imageTargets) {
      const text = await readOfficialMallImageText(imageUrl, { lang: 'eng+kor', psm: 6, timeout: 25000 });
      if (!text) continue;

      ocrTexts.push(text);
      const noteCount = countRecognizedTastingNotes(text);
      if (noteCount > bestNoteCount) {
        bestOcrText = text;
        bestNoteCount = noteCount;
      }
      if (isThumbnail) thumbnailNoteCount = noteCount;
      if (hasTerarosaTastingNoteText(text) && noteCount >= 2) break;
      if (!isThumbnail && thumbnailNoteCount === 1) break;
    }

    const orderedTexts = bestOcrText
      ? [bestOcrText, ...ocrTexts.filter((text) => text !== bestOcrText)]
      : ocrTexts;

    return {
      ...page,
      ocrText: orderedTexts.join('\n'),
    };
  });
}

async function fetchTerarosaProducts() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  let htmlResponse;
  try {
    htmlResponse = await fetch(TERAROSA_PRODUCT_LIST_URL, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'BeanPick/0.1 local desktop app',
        Referer: TERAROSA_SOURCE_URL,
      },
      signal: controller.signal,
    });
  } catch (error) {
    console.error('[beanpick:fetchTerarosaProducts-fail] list request error:', error);
    throw new Error('Terarosa product page request failed: ' + error.message);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!htmlResponse.ok) {
    throw new Error('Terarosa product page request failed (' + htmlResponse.status + ')');
  }

  const html = await htmlResponse.text();
  const csrfToken = extractCsrfToken(html);
  const cookie = createCookieHeader(htmlResponse.headers);

  try {
    const apiRows = await fetchTerarosaApiRows(cookie, csrfToken);
    const thumbnailByItemCode = buildTerarosaThumbnailMap(apiRows);
    const detailUrls = buildTerarosaDetailUrlsFromRows(apiRows);
    const detailPages = await attachTerarosaOcrText(await fetchDetailPages(detailUrls, cookie), thumbnailByItemCode);

    return {
      ok: true,
      html,
      apiRows,
      detailPages,
      fetchedAt: new Date().toISOString(),
      sourceUrl: TERAROSA_PRODUCT_LIST_URL,
    };
  } catch (error) {
    const fallbackController = new AbortController();
    const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 5000);
    let fallbackResponse;
    try {
      fallbackResponse = await fetch(TERAROSA_SOURCE_URL, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'BeanPick/0.1 local desktop app',
          Referer: TERAROSA_PRODUCT_LIST_URL,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        signal: fallbackController.signal,
      });
    } catch (fallbackError) {
      console.error('[beanpick:fetchTerarosaProducts-fail] fallback request error:', fallbackError);
    } finally {
      clearTimeout(fallbackTimeoutId);
    }
    const fallbackHtml = fallbackResponse && fallbackResponse.ok ? await fallbackResponse.text() : html;

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
  const page = await fetchHtmlPage(MOMOS_SOURCE_URL, MOMOS_SOURCE_URL);
  if (!page) {
    throw new Error('Momos product pages could not be loaded.');
  }

  // 목록에는 대표 용량만 있으므로, 기존 공식몰 상세보강 경로로 용량별 가격을 함께 읽는다.
  // 상세보강이 실패해도 목록 자체는 그대로 반환한다.
  const enrichedPages = await enrichPagesWithDetailStock(
    [page],
    { sourceId: 'momos', parser: 'imweb', sourceUrl: MOMOS_SOURCE_URL, detailOrigin: 'https://momos.co.kr' },
    Date.now() + OFFICIAL_ENRICH_BUDGET_MS,
  );

  const observationId = storeRawObservation({
    channelId: getChannelId('momos'),
    url: MOMOS_SOURCE_URL,
    body: page.html,
    extractorVersion: OFFICIAL_MALL_LIST_EXTRACTOR,
  });

  return {
    ok: true,
    html: enrichedPages[0]?.html || '',
    pages: observationId ? enrichedPages.map((entry) => ({ ...entry, observationId })) : enrichedPages,
    fetchedAt: new Date().toISOString(),
    sourceUrl: MOMOS_SOURCE_URL,
    // 모모스 쇼핑 목록은 한 페이지가 전체다. 다만 그 페이지에서 상품을 실제로 읽었는지로 판정한다.
    listCompleteness: evaluateListCompleteness({
      pagesFetched: 1,
      pagesFailed: 0,
      endConfirmed: true,
      itemsFound: extractPageProductSignature(page.html, '').split(',').filter(Boolean).length,
    }),
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

async function buildDetailDataFromDetails(items, referer, concurrency = 5, gapMs = 100, deadlineAt = Infinity) {
  const stock = new Map();
  const info = new Map();
  let cursor = 0;
  let skipped = 0;

  async function worker() {
    while (cursor < items.length) {
      // 전체 시간 예산을 넘기면 남은 상품은 상세보강을 생략한다(상품 목록 자체는 상위에서 그대로 유지).
      if (Date.now() > deadlineAt) { skipped += items.length - cursor; cursor = items.length; break; }
      const myIndex = cursor;
      cursor += 1;
      const { productNo, detailUrl } = items[myIndex];
      try {
        const detail = await fetchCafe24DetailWithRetry(fetchHtmlPage, detailUrl, referer, { deadlineAt });
        if (detail) {
          // 해석 전 상세 원문을 남겨 다시 받지 않고 재해석할 수 있게 한다. 저장 실패는 수집에 영향을 주지 않는다.
          const detailChannelId = findChannelByUrl(detailUrl)?.channelId;
          if (detailChannelId) {
            storeRawObservation({
              channelId: detailChannelId,
              url: detailUrl,
              body: detail.html,
              contentType: 'text/html',
              extractorVersion: OFFICIAL_MALL_DETAIL_EXTRACTOR,
            });
          }
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
                const text = await readOfficialMallImageText(abs, { lang: 'eng+kor', psm: 6, timeout: 15000 });
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
  if (skipped > 0) console.warn(`[beanpick:official-enrich] 시간 예산 초과로 ${skipped}개 상품 상세보강 생략(상품 목록은 유지)`);
  return { stock, info };
}

function injectDetailMarkerIntoBlock(html, productNo, info) {
  if (!info) return html;
  const marker = buildDetailInfoMarker(info);
  const re = new RegExp(`(<li\\s+id=["']anchorBoxId_${productNo}["'][^>]*>)`, 'i');
  return html.replace(re, (match) => `${match}${marker}`);
}

function isLikelyMomosBeanProductName(productName) {
  const name = String(productName || '').toLowerCase();
  const blockedWords = [
    '드립백', '드립커피', '브루백', '커피백', '티백', '캡슐', '콜드브루', '더치커피',
    '인스턴트', '스틱커피', '커피믹스', '믹스커피', '파우더커피', '액상커피', '원액',
    'rtd', 'drip bag', 'drip coffee', 'coffee bag', 'instant', 'coffee mix', 'powder coffee',
    'capsule', 'cold brew', 'dutch coffee', 'concentrate', 'liquid coffee',
    '굿즈', '텀블러', '머그', '티셔츠', '에코백', '세트', 'bandana', '쇼핑백', '생두', '정기배송', '추출기구',
  ];
  const beanSignals = ['원두', 'blend', '블렌드', 'washed', 'natural', 'honey', '워시드', '내추럴', '게이샤', 'decaf', '디카페인'];
  return !blockedWords.some((word) => name.includes(word)) && beanSignals.some((word) => name.includes(word));
}

function extractImwebListItemLinks(html, origin, includeItem) {
  const items = [];
  const seen = new Set();
  for (const block of extractImwebProductBlocks(html)) {
    const properties = readImwebProductPropertiesFromBlock(block);
    const productNo = String(properties?.idx || '').trim();
    if (!productNo || seen.has(productNo)) continue;
    if (includeItem && !includeItem(properties?.name)) continue;
    items.push({
      productNo,
      detailUrl: `${origin}/shop_view/${encodeURIComponent(productNo)}`,
    });
    seen.add(productNo);
  }
  return items;
}

function injectDetailMarkerIntoImwebBlock(html, productNo, info) {
  if (!info) return html;
  const marker = buildDetailInfoMarker(info);
  const blocks = extractImwebProductBlocks(html);
  const block = blocks.find((candidate) => String(readImwebProductPropertiesFromBlock(candidate)?.idx || '') === String(productNo));
  if (!block) return html;
  // 문자열 치환에 $& 같은 특수 패턴이 섞여도 그대로 들어가도록 콜백 형태를 쓴다.
  const updatedBlock = block.replace(/>/, (match) => match + marker);
  return html.replace(block, () => updatedBlock);
}

async function fetchImwebOptionPage(detailUrl, productNo, referer, deadlineAt = Infinity, detail = null) {
  const detailPage = detail || await fetchHtmlPage(detailUrl, referer);
  if (!detailPage || Date.now() >= deadlineAt) return null;
  const editTime = detailPage.html.match(/"prod_edit_time"\s*:\s*(\d+)/i)?.[1] || '';
  if (!editTime) return null;

  const response = await withTimeout((async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      return await fetch(`${new URL(detailUrl).origin}/shop/load_option.cm`, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'BeanPick/0.1 local desktop app',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: detailUrl,
        },
        body: new URLSearchParams({
          type: 'prod',
          prod_idx: String(productNo),
          selected_require_options: '',
          __: String(editTime),
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  })(), 15000, null);
  if (!response?.ok) return null;
  const html = await withTimeout(response.text(), 15000, '');
  return html ? { url: detailUrl, html, detailHtml: detailPage.html } : null;
}

async function fetchImwebOmsProduct(detailUrl, productNo, referer, deadlineAt = Infinity) {
  if (Date.now() >= deadlineAt) return null;
  const endpoint = `${new URL(detailUrl).origin}/ajax/oms/OMS_get_product.cm?prod_idx=${encodeURIComponent(String(productNo))}`;
  const remainingMs = Math.max(1, Math.min(12000, deadlineAt - Date.now()));
  const response = await withTimeout((async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), remainingMs);
    try {
      return await fetch(endpoint, {
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'User-Agent': 'BeanPick/0.1 local desktop app',
          Referer: referer || detailUrl,
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  })(), remainingMs + 1000, null);
  if (!response?.ok) return null;
  return await withTimeout(response.json(), remainingMs, null);
}

async function enrichImwebDetailOptions(pages, config, deadlineAt = Infinity) {
  const enriched = [];
  for (const page of pages) {
    if (Date.now() > deadlineAt) {
      enriched.push(page);
      continue;
    }
    const items = extractImwebListItemLinks(
      page.html,
      config.detailOrigin || new URL(config.sourceUrl).origin,
      config.sourceId === 'momos' ? isLikelyMomosBeanProductName : undefined,
    );
    if (items.length === 0) {
      enriched.push(page);
      continue;
    }
    const info = new Map();
    let cursor = 0;
    async function worker() {
      while (cursor < items.length) {
        if (Date.now() > deadlineAt) return;
        const item = items[cursor++];
        try {
          // OMS가 현재 옵션·가격의 1차 원천이다. 상세 HTML과 동시에 시작하고,
          // 구형 load_option.cm은 OMS가 비었을 때만 호출해 요청 수와 지연을 줄인다.
          const [detailPage, omsPayload] = await Promise.all([
            fetchHtmlPage(item.detailUrl, config.sourceUrl),
            fetchImwebOmsProduct(item.detailUrl, item.productNo, config.sourceUrl, deadlineAt),
          ]);
          const omsPriceOptions = extractImwebOmsPriceOptions(omsPayload);
          const optionPage = omsPriceOptions.length === 0
            ? await fetchImwebOptionPage(item.detailUrl, item.productNo, config.sourceUrl, deadlineAt, detailPage)
            : null;
          const priceOptions = omsPriceOptions;
          const fallbackPriceOptions = priceOptions.length > 0
            ? priceOptions
            : (optionPage ? extractImwebPriceOptions(optionPage.html) : []);
          const detailInfo = (optionPage?.detailHtml || detailPage?.html)
            ? parseCafe24DetailInfo(optionPage?.detailHtml || detailPage.html)
            : {};
          if (fallbackPriceOptions.length > 0 || Number(detailInfo.weight || 0) > 0) {
            info.set(item.productNo, { ...detailInfo, priceOptions: fallbackPriceOptions });
          }
        } catch {
          // 옵션 상세를 못 받으면 목록의 대표 가격·용량을 그대로 유지한다.
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(5, items.length) }, () => worker()));
    let nextHtml = page.html;
    for (const [productNo, detailInfo] of info.entries()) {
      nextHtml = injectDetailMarkerIntoImwebBlock(nextHtml, productNo, detailInfo);
    }
    enriched.push({ ...page, html: nextHtml });
  }
  return enriched;
}

async function enrichPagesWithDetailStock(pages, config, deadlineAt = Infinity) {
  if (config.sourceId === 'centercoffee' || config.parser === 'imweb') {
    return enrichImwebDetailOptions(pages, config, deadlineAt);
  }
  const referer = config.sourceUrl;
  const origin = config.detailOrigin || (config.sourceUrl ? new URL(config.sourceUrl).origin : '');
  if (!origin) return pages;

  const enriched = [];
  for (const page of pages) {
    // 예산을 넘기면 남은 페이지는 원본 그대로(상세보강 없이) 반환한다.
    if (Date.now() > deadlineAt) { enriched.push(page); continue; }
    const items = extractCafe24ListItemLinks(page.html, origin);
    if (items.length === 0) {
      enriched.push(page);
      continue;
    }
    const { stock, info } = await buildDetailDataFromDetails(items, referer, 5, 100, deadlineAt);
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

  const startedMs = Date.now();
  const pages = [];
  const seenSignatures = new Set();
  const maxPages = config.maxPages || (config.categoryNo ? MAX_CATEGORY_PAGES : 1);
  let pagesFailed = 0;
  let pagesWithProducts = 0;
  // 같은 목록이 반복되면 끝에 도달한 것이다. 상한까지 다 받고 끝났으면 끝을 확인하지 못한 것이다.
  let endConfirmed = maxPages === 1;
  // 무엇을 근거로 끝이라고 판단했는지 남긴다. 근거의 세기가 다르다.
  let endReason = maxPages === 1 ? 'singlePage' : 'pageLimit';

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    try {
      const url = buildOfficialMallPageUrl(config, pageNumber);
      const page = await fetchHtmlPage(url, config.sourceUrl);
      if (!page) {
        pagesFailed += 1;
        continue;
      }

      const enrichedPage = sourceId === 'centercoffee'
        ? await attachCenterCoffeeOcrText(page, config)
        : page;
      const signature = extractPageProductSignature(enrichedPage.html, config.categoryNo);
      if (pageNumber > 1 && !signature) {
        // 다음 페이지에 상품이 없으면 목록의 끝이다. 다만 근거가 약해 사유를 남긴다.
        // (차단 페이지가 200으로 와도 여기로 들어올 수 있다.)
        endConfirmed = true;
        endReason = 'emptyPage';
        break;
      }
      if (pageNumber > 1 && seenSignatures.has(signature)) {
        // 같은 목록이 반복되면 확실히 끝이다.
        endConfirmed = true;
        endReason = 'repeatedList';
        break;
      }
      if (signature) pagesWithProducts += 1;

      // 해석 전 원문을 따로 남겨, 다시 받지 않고 재해석할 수 있게 한다.
      const observationId = storeRawObservation({
        channelId: getChannelId(sourceId),
        url,
        body: page.html,
        extractorVersion: OFFICIAL_MALL_LIST_EXTRACTOR,
      });

      pages.push(observationId ? { ...enrichedPage, observationId } : enrichedPage);
      seenSignatures.add(signature);
    } catch {
      // Keep using the other pages from the same mall when one page fails.
      pagesFailed += 1;
    }
  }

  if (pages.length === 0) {
    throw new Error(sourceId + ' product pages could not be loaded.');
  }

  // 상세보강은 부가 기능이므로 전체 시간 예산 안에서만 돈다. 예산을 넘겨도 위에서 모은 상품 목록은 그대로 반환된다.
  const finalPages = config.verifyStockFromDetail
    ? await enrichPagesWithDetailStock(pages, config, Date.now() + OFFICIAL_ENRICH_BUDGET_MS)
    : pages;

  const listCompleteness = evaluateListCompleteness({
    pagesFetched: pages.length,
    pagesFailed,
    endConfirmed,
    // 받은 페이지 수가 아니라 상품이 실제로 들어 있던 페이지 수로 센다.
    itemsFound: pagesWithProducts,
  });
  console.log(`[beanpick:source-run] ${sourceId} ${listCompleteness}(${endReason}) 페이지 ${pages.length}개 ${Date.now() - startedMs}ms`);

  try {
    pruneRawObservations();
  } catch {
    // 정리 실패는 수집 결과에 영향을 주지 않는다.
  }

  return {
    ok: true,
    pages: finalPages,
    html: finalPages[0]?.html || '',
    fetchedAt: new Date().toISOString(),
    sourceUrl: config.sourceUrl,
    listCompleteness,
    endReason,
    pagesFetched: pages.length,
    pagesFailed,
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

async function fetchSmartStoreProducts(sourceId) {
  try {
    const source = SMARTSTORE_SOURCES[sourceId];
    const categoryUrls = getSmartStoreCategoryUrls(source);
    if (categoryUrls.length > 0) {
      const categoryResult = await fetchSmartStoreCategoryProducts(sourceId);
      if (categoryResult?.products?.length) return categoryResult;
      // 검색 API는 종료되었으므로 카테고리 수집 실패를 빈 성공으로 바꾸지 않는다.
      // 커피정경만 새 커머스 API를 보조 경로로 시도한다.
      if (sourceId !== 'coffeejg') return categoryResult;
      console.warn(`[beanpick:smartstore-category] ${sourceId} 스토어 홈 결과가 없어 커머스 API를 시도합니다. ${categoryResult?.warning || ''}`);
    }

    const searchResult = sourceId === 'coffeejg'
      ? await searchNaverCommerce(sourceId)
      : await searchNaverShopping(sourceId);
    if (searchResult?.products?.length) {
      return {
        ...searchResult,
        products: await enrichSmartStoreProductsWithExternalNotes(
          sourceId,
          await enrichSmartStoreProductsWithDetailInfo(source, searchResult.products),
        ),
      };
    }

    return searchResult;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `${sourceId} SmartStore search failed.`,
    };
  }
}

const collectionEngine = createCollectionEngine({
  smartStoreCategory: fetchSmartStoreProducts,
  terarosaApi: fetchTerarosaProducts,
  momosShop: fetchMomosProducts,
  officialMallPages: fetchOfficialMallProducts,
});

ipcMain.handle('beanpick:list-collection-sources', () => collectionEngine.listSources());
ipcMain.handle('beanpick:fetch-collection-source', (_event, sourceId) => collectionEngine.collect(sourceId));
ipcMain.handle('beanpick:promote-collection-products', (_event, sourceId, products) => ({
  ok: true,
  products: collectionEngine.promoteProducts(sourceId, products),
}));

ipcMain.handle('beanpick:publish-iphone', async (_event, payload) => {
  const products = Array.isArray(payload?.products) ? payload.products : [];
  return await publishProductsToGitHub({ products });
});



app.whenReady().then(() => {
  // Windows 토스트 알림에 필요한 앱 식별자
  app.setAppUserModelId('com.beanpick.app');
  try {
    pruneRuns();
  } catch {
    // 실행 기록 정리 실패는 수집에 영향을 주지 않는다.
  }
  if (shouldPublishIphoneSnapshot) {
    runIphoneSnapshotPublish()
      .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      })
      .finally(() => {
        app.exit(process.exitCode || 0);
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
