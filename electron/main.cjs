const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const TERAROSA_SOURCE_URL = 'https://www.terarosa.com/market/product/list?categoryId=482';
const TERAROSA_PRODUCT_LIST_URL = 'https://www.terarosa.com/product/list/?category=12';
const TERAROSA_API_URL = 'https://www.terarosa.com/api/main/info/';
const TERAROSA_ORIGIN = 'https://www.terarosa.com';
const MOMOS_SOURCE_URL = 'https://momos.co.kr/category/%EC%9B%90%EB%91%90/42/';
const MOMOS_PAGE_URLS = [
  MOMOS_SOURCE_URL,
  'https://momos.co.kr/category/%EC%9B%90%EB%91%90/42/?page=2',
];
const OFFICIAL_MALL_PAGE_URLS = {
  namusairo: ['https://namusairo.com/category/coffee/91/'],
  coffeelibre: ['https://coffeelibre.kr/product/list.html?cate_no=47'],
  lowkey: ['https://en.lowkeycoffee.co.kr/category/coffee/24/'],
  werk: ['https://werk.co.kr/'],
};

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: 'BeanPick',
    backgroundColor: '#1B2620',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
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

function extractDetailUrls(html) {
  const urls = [...html.matchAll(/href=["']([^"']*\/product\/detail\/\?ItemCode=[^"']+)/gi)]
    .map((match) => match[1])
    .map((url) => (url.startsWith('http') ? url : `${TERAROSA_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`));

  return [...new Set(urls)].slice(0, 12);
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
      // 상세 페이지 일부가 실패해도 나머지 상품은 계속 보여줍니다.
    }
  }

  return pages;
}

async function fetchTerarosaProducts() {
  const htmlResponse = await fetch(TERAROSA_SOURCE_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'BeanPick/0.1 local desktop app',
    },
  });

  if (!htmlResponse.ok) {
    throw new Error(`테라로사 페이지 요청 실패 (${htmlResponse.status})`);
  }

  let html = await htmlResponse.text();
  const csrfToken = extractCsrfToken(html);
  const cookie = createCookieHeader(htmlResponse.headers);

  if (!html.includes('/product/detail/?ItemCode=')) {
    const listResponse = await fetch(TERAROSA_PRODUCT_LIST_URL, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'BeanPick/0.1 local desktop app',
        Referer: TERAROSA_SOURCE_URL,
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });

    if (listResponse.ok) {
      html = await listResponse.text();
    }
  }

  const detailPages = await fetchDetailPages(extractDetailUrls(html), cookie);

  try {
    const apiResponse = await fetch(TERAROSA_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'BeanPick/0.1 local desktop app',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: TERAROSA_SOURCE_URL,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
      },
      body: new URLSearchParams({ gubun: 'category', CategoryID: '482' }),
    });

    if (!apiResponse.ok) {
      throw new Error(`테라로사 상품 API 요청 실패 (${apiResponse.status})`);
    }

    const apiText = await apiResponse.text();
    const apiJson = JSON.parse(apiText);
    const apiRows = Array.isArray(apiJson?.rows)
      ? apiJson.rows
      : Array.isArray(apiJson?.list)
        ? apiJson.list
        : [];

    return {
      ok: true,
      html,
      apiRows,
      detailPages,
      fetchedAt: new Date().toISOString(),
      sourceUrl: TERAROSA_SOURCE_URL,
    };
  } catch (error) {
    return {
      ok: true,
      html,
      apiRows: [],
      detailPages,
      fetchedAt: new Date().toISOString(),
      sourceUrl: TERAROSA_SOURCE_URL,
      warning: error instanceof Error ? error.message : '테라로사 상품 API를 읽지 못했습니다.',
    };
  }
}

async function fetchMomosProducts() {
  const pages = [];

  for (const url of MOMOS_PAGE_URLS) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'BeanPick/0.1 local desktop app',
          Referer: MOMOS_SOURCE_URL,
        },
      });

      if (response.ok) {
        pages.push({ url, html: await response.text() });
      }
    } catch {
      // 한 페이지가 실패해도 다른 페이지에서 읽은 상품은 계속 사용합니다.
    }
  }

  if (pages.length === 0) {
    throw new Error('모모스커피 상품 페이지를 읽지 못했습니다.');
  }

  return {
    ok: true,
    html: pages[0]?.html || '',
    pages,
    fetchedAt: new Date().toISOString(),
    sourceUrl: MOMOS_SOURCE_URL,
  };
}

async function fetchOfficialMallProducts(sourceId) {
  const pageUrls = OFFICIAL_MALL_PAGE_URLS[sourceId];
  if (!pageUrls) {
    throw new Error(`지원하지 않는 공식몰입니다: ${sourceId}`);
  }

  const pages = [];

  for (const url of pageUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'BeanPick/0.1 local desktop app',
          Referer: pageUrls[0],
        },
      });

      if (response.ok) {
        pages.push({ url, html: await response.text() });
      }
    } catch {
      // 한 페이지가 실패해도 같은 몰의 다른 페이지를 계속 시도합니다.
    }
  }

  if (pages.length === 0) {
    throw new Error(`${sourceId} 상품 페이지를 읽지 못했습니다.`);
  }

  return {
    ok: true,
    pages,
    html: pages[0]?.html || '',
    fetchedAt: new Date().toISOString(),
    sourceUrl: pageUrls[0],
  };
}

ipcMain.handle('beanpick:fetch-terarosa-products', async () => {
  try {
    return await fetchTerarosaProducts();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '테라로사 데이터를 가져오지 못했습니다.',
    };
  }
});

ipcMain.handle('beanpick:fetch-momos-products', async () => {
  try {
    return await fetchMomosProducts();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '모모스커피 데이터를 가져오지 못했습니다.',
    };
  }
});

ipcMain.handle('beanpick:fetch-official-mall-products', async (_event, sourceId) => {
  try {
    return await fetchOfficialMallProducts(sourceId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `${sourceId} 데이터를 가져오지 못했습니다.`,
    };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
