const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { normalizeTastingNotes } = require('../src/services/tastingNotes.cjs');

const NAVER_SHOPPING_SEARCH_URL = 'https://openapi.naver.com/v1/search/shop.json';
function getOcrCacheDir(env = process.env, tempDir = os.tmpdir()) {
  if (env.BEANPICK_OCR_CACHE_DIR) return env.BEANPICK_OCR_CACHE_DIR;

  const baseDir = env.LOCALAPPDATA
    || env.XDG_CACHE_HOME
    || (env.HOME ? path.join(env.HOME, '.cache') : '');
  return baseDir ? path.join(baseDir, 'BeanPick', 'ocr-cache') : path.join(tempDir, 'beanpick-ocr-cache');
}

const OCR_CACHE_DIR = getOcrCacheDir();
const OPTION_ONLY_PRICE_MAX = 1000;
const OPTION_ONLY_ORIGINAL_MIN = 10000;
const NON_BEAN_COFFEE_WORDS = [
  '드립백',
  '드립 백',
  '드립커피',
  '드립 커피',
  '브루백',
  '커피백',
  '티백',
  '캡슐',
  '콜드브루',
  '더치커피',
  '더치 원액',
  '더치원액',
  '인스턴트커피',
  '인스턴트 커피',
  '인스턴트',
  '스틱커피',
  '스틱 커피',
  '커피믹스',
  '믹스커피',
  '파우더커피',
  '파우더 커피',
  '액상커피',
  '액상 커피',
  '원액',
  'rtd',
  'drip bag',
  'dripbag',
  'drip coffee',
  'coffee bag',
  'instant',
  'stick coffee',
  'coffee mix',
  'powder coffee',
  'capsule',
  'cold brew',
  'coldbrew',
  'dutch coffee',
  'concentrate',
  'liquid coffee',
  'tea bag',
  'teabag',
];
function getPaddleOcrPythonPath(env = process.env) {
  return env.BEANPICK_PADDLE_OCR_PYTHON || 'C:\\Program Files\\Python311\\python.exe';
}

function normalizePaddleOcrLang(lang) {
  const value = String(lang || '').toLowerCase();
  if (!value || value.includes('kor') || value.includes('korean')) return 'korean';
  if (value === 'eng' || value === 'en' || value.includes('english')) return 'en';
  return value;
}

const SMARTSTORE_SOURCES = {
  roasterick: {
    sourceId: 'roasterick',
    roasterName: '로스터릭',
    query: '로스터릭 원두',
    // 원두 카테고리만 직접 크롤링한다. (드립백·더치원액 카테고리는 제외)
    categoryUrls: [
      'https://smartstore.naver.com/rick/category/c3b6f6dec003425fbf8dc61f9246c9e7?cp=1', // BLEND
      'https://smartstore.naver.com/rick/category/d273d60785d2431a8ab7bab4bd38bb99?cp=1', // 아프리카
      'https://smartstore.naver.com/rick/category/1c0312955b5949ae8c6060b70e9d666d?cp=1', // 중남미 외
      'https://smartstore.naver.com/rick/category/101fb10f7ece49d6a4c0ed870e2a9ffd?cp=1', // 조금 특별한
      'https://smartstore.naver.com/rick/category/10f4b014e5514216a1b089feb7aa12cc?cp=1', // Limited edition
      'https://smartstore.naver.com/rick/category/16163c66dcde43d68ce7256b4b8e0500?cp=1', // 디카페인
      'https://smartstore.naver.com/rick/category/50f80eff19174d7d87f137987dad2a03?cp=1', // 중강배전
    ],
    mallNames: ['로스터릭'],
  },
  lubia: {
    sourceId: 'lubia',
    roasterName: '루비아 커피',
    query: '루비아 원두',
    // 원두 카테고리만 직접 크롤링한다. (캡슐·티백·용품 카테고리는 제외)
    categoryUrls: [
      'https://smartstore.naver.com/rubiacoffee/category/f39ba6cbad2d4a4cb8ef45c7ce908285?cp=1', // 시그니처
      'https://smartstore.naver.com/rubiacoffee/category/8d2da31680b647b281c1b2eabc3981e1?cp=1', // 싱글 오리진
      'https://smartstore.naver.com/rubiacoffee/category/531d18d126bc49da88ad965ba9551ed5?cp=1', // 가향커피
      'https://smartstore.naver.com/rubiacoffee/category/3f7e21c90a9f454caf735af37eef72d4?cp=1', // 디카페인
      'https://smartstore.naver.com/rubiacoffee/category/5933bc678b094b20a8c9e4c743db59c3?cp=1', // 그란데(대용량)
    ],
    mallNames: ['루비아 커피', '루비아'],
  },
  hitte: {
    sourceId: 'hitte',
    roasterName: '히떼 로스터리',
    query: '히떼 원두',
    // 원두 카테고리만 직접 크롤링한다. (EASY COFFEE·GOODS 카테고리는 제외)
    categoryUrls: [
      'https://smartstore.naver.com/hytteroastery/category/6eaffefffc54495f86214fae639cf52b?cp=1', // ESPRESSO
      'https://smartstore.naver.com/hytteroastery/category/5bf5ed70b6ad4f738449292b90ec76ab?cp=1', // FILTER
    ],
    mallNames: ['히떼 로스터리'],
  },
  identity: {
    sourceId: 'identity',
    roasterName: '아이덴티티 커피랩',
    query: '아이덴티티 커피랩 원두',
    categoryUrl: 'https://smartstore.naver.com/identity_coffeelab/category/0b4e173f072040e4b682a7ca248ac875?cp=1',
    mallNames: ['아이덴티티커피랩', '아이덴티티 커피랩', 'identity_coffeelab'],
  },
  toch: {
    sourceId: 'toch',
    roasterName: '토치 커피',
    query: '토치 커피 원두',
    // 원두 카테고리만 직접 크롤링한다. (이지커피 카테고리는 제외)
    categoryUrls: [
      'https://smartstore.naver.com/toch/category/046e927a14bc47dcbeb6c41524ff8bb4?cp=1', // 블렌드 3종
      'https://smartstore.naver.com/toch/category/6bd2883247b64b1d868dd3405acc63d1?cp=1', // 싱글오리진
      'https://smartstore.naver.com/toch/category/9ff908ee7a0341fc9e1789b13b68e6d1?cp=1', // 디카페인
    ],
    mallNames: ['토치 커피', '토치커피', 'toch'],
  },
  fillout: {
    sourceId: 'fillout',
    roasterName: '필아웃커피',
    query: '필아웃커피 원두',
    // 커피 원두 카테고리만 직접 크롤링한다. (파우더 커피·굿즈 카테고리는 제외)
    categoryUrls: [
      'https://smartstore.naver.com/filloutcoffee/category/00f832f1c2da4600b90ddda5d6ae6853?cp=1', // 커피 원두
    ],
    mallNames: ['필아웃커피', '필아웃 커피', 'fillout'],
  },
  cafedoan: {
    sourceId: 'cafedoan',
    roasterName: '카페도안',
    query: '도안셀렉트샵 원두',
    categoryUrl: 'https://smartstore.naver.com/doanselectshop/category/6758314878ef4d478904279d7065dfba?cp=1',
    mallNames: ['도안 셀렉트 샵', '도안셀렉트샵', 'doanselectshop'],
  },
  coffeejg: {
    sourceId: 'coffeejg',
    roasterName: '커피정경 로스터리',
    query: '커피정경 원두',
    // 원두 카테고리 주소가 없어 네이버 쇼핑 검색 API로만 수집한다.
    storeUrl: 'https://smartstore.naver.com/coffeejg',
    mallNames: ['커피정경'],
  },
  malik: {
    sourceId: 'malik',
    roasterName: '말릭커피',
    query: '말릭커피 원두',
    categoryUrl: 'https://smartstore.naver.com/undercrema/category/be5659b19f7e4ce0b7cb3f5829607bbc?cp=1',
    mallNames: ['말릭커피'],
  },
};

function getSmartStoreListUrl(source, item = {}) {
  return item.categoryUrl
    || source.categoryUrl
    || source.categoryUrls?.[0]
    || source.storeUrl
    || '';
}

function getSmartStoreIdFromUrl(url) {
  const storeId = String(url || '').match(/smartstore\.naver\.com\/([^/?#]+)/i)?.[1] || '';
  return storeId && storeId !== 'main' ? storeId : '';
}

function getSmartStoreId(source, item = {}) {
  return getSmartStoreIdFromUrl(item.productUrl)
    || getSmartStoreIdFromUrl(item.link)
    || getSmartStoreIdFromUrl(item.categoryUrl)
    || getSmartStoreIdFromUrl(source.storeUrl)
    || getSmartStoreIdFromUrl(source.categoryUrl)
    || getSmartStoreIdFromUrl(source.categoryUrls?.[0])
    || '';
}

function normalizeSmartStoreProductUrl(url, source, item = {}) {
  const rawUrl = String(url || '');
  const productId = rawUrl.match(/smartstore\.naver\.com\/main\/products\/(\d+)/i)?.[1];
  const storeId = productId ? getSmartStoreId(source, item) : '';
  return productId && storeId ? `https://smartstore.naver.com/${storeId}/products/${productId}` : rawUrl;
}

function loadLocalEnv(rootDir = path.resolve(__dirname, '..')) {
  const localEnv = {};
  const envDirs = [
    rootDir,
    process.resourcesPath,
    process.execPath ? path.dirname(process.execPath) : '',
  ].filter(Boolean);

  envDirs.forEach((envDir) => {
    ['.env', '.env.local'].forEach((fileName) => {
      const envPath = path.join(envDir, fileName);
      if (!fs.existsSync(envPath)) return;

      fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex < 1) return;

        const key = trimmed.slice(0, separatorIndex).trim();
        const rawValue = trimmed.slice(separatorIndex + 1).trim();
        localEnv[key] = rawValue.replace(/^["']|["']$/g, '');
      });
    });
  });

  Object.entries(localEnv).forEach(([key, value]) => {
    if (process.env[key] == null) {
      process.env[key] = value;
    }
  });
}

function readNaverSearchConfig(env = process.env) {
  return {
    clientId: (env.NAVER_SHOPPING_CLIENT_ID || env.NAVER_COMMERCE_CLIENT_ID || '').trim(),
    clientSecret: (env.NAVER_SHOPPING_CLIENT_SECRET || env.NAVER_COMMERCE_CLIENT_SECRET || '').trim(),
  };
}

function requireNaverSearchConfig() {
  const config = readNaverSearchConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error('네이버 검색 API Client ID와 Secret을 .env에 넣어주세요.');
  }

  return config;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function createProductId(sourceId, item) {
  const rawId = item.productId || item.link || item.title;
  return `${sourceId}-${String(rawId).replace(/[^a-z0-9가-힣]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()}`;
}

// 네이버 쇼핑 광고형 긴 제목을 다른 카드 톤에 맞춰 정리한다.
function cleanShoppingTitle(rawTitle, roasterName = '') {
  let next = String(rawTitle || '');
  // 1) 별/꾸미기 토큰 제거
  next = next.replace(/★[^★]*★/g, ' ');
  // 2) 선두의 형용사 수식 제거: 최소 2음절, 형용사 어미("한/운/고/진/소") + 공백
  //    예: "달콤하고 부드러운". "달고나"는 뒤에 "나"가 붙어 lookahead로 차단됨.
  next = next.replace(/^(?:[가-힣]+(?:한|운|고|진|소)(?=\s)\s*){1,4}/, '');
  // 3) 용량/개수 표기 제거
  next = next.replace(/[,，]?\s*\d+(?:\.\d+)?\s*(kg|g)\b/gi, ' ');
  next = next.replace(/[,，]?\s*\d+\s*개(?![가-힣A-Za-z])/g, ' ');
  // 4) 포장/형태 후행어 제거
  next = next.replace(/(홀빈|분쇄커피|분쇄|프렌치프레스|에스프레소|드립용|핸드드립)/g, ' ');
  // 5) 로스터 브랜드명 중복 제거 (메타에 이미 표시됨). JS \b가 한글에 안 먹어서 공백/처음/끝 패딩으로 잡는다.
  if (roasterName) {
    const brand = roasterName.replace(/\s*커피$/, '').trim();
    if (brand) {
      next = next.replace(new RegExp(`(^|\\s)${brand}(?=\\s|$)`, 'g'), '$1');
    }
  }
  // 6) 빈 괄호/잔여 공백/쉼표 정리
  next = next.replace(/\(\s*\)|\[\s*\]/g, ' ');
  return next.replace(/[,，]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseWeight(title) {
  const kgMatch = title.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kgMatch) return Math.round(Number(kgMatch[1]) * 1000);

  const gramMatch = title.match(/(\d+(?:\.\d+)?)\s*g/i);
  if (gramMatch) return Math.round(Number(gramMatch[1]));

  return 200;
}

function hasExplicitWeight(title) {
  return /(\d+(?:\.\d+)?)\s*(?:kg|g)\b/i.test(String(title || ''));
}

function isAmbiguousBulkOptionProduct(product) {
  const title = String(product?.productName || product?.title || '');
  return /대용량/i.test(title) && !hasExplicitWeight(title);
}

function isNonBeanCoffeeTitle(title) {
  const text = String(title || '').toLowerCase();
  return NON_BEAN_COFFEE_WORDS.some((word) => text.includes(word));
}

function isGroundCoffeeProduct(title) {
  if (!title) return false;
  const lowerText = String(title).toLowerCase();
  const isWholeBeanSignal = /분쇄\s*(?:요청\s*)?불가|분쇄\s*(?:안\s*함|안함|없음)|홀\s*빈|whole\s*beans?/i.test(lowerText)
    || (/\bbeans\b/i.test(lowerText) && !/\b(?:ground|grind)\s+beans\b/i.test(lowerText));
  if (isWholeBeanSignal) {
    return false;
  }
  const isGroundSignal = /분쇄|grind|ground/i.test(lowerText);
  return isGroundSignal;
}

function isCollectableSmartStoreTitle(title) {
  if (isNonBeanCoffeeTitle(title)) return false;
  if (hasExplicitWeight(title) && parseWeight(title) > 1000) return false;
  if (isGroundCoffeeProduct(title)) return false;
  return true;
}

// 상품명에서 사전에 있는 맛 단어만 뽑는다. ("달고나 블랜드" → 달고나)
function getTasteNotes(title) {
  const notes = [];
  addNotesFromText(notes, title);
  return sanitizeTastingNotes(notes);
}

function ocrTextCachePathForImageUrl(imageUrl, options = {}) {
  const fingerprint = `${imageUrl}|${options.engine || 'paddle'}|${options.lang || 'kor+eng'}|${options.psm || '6'}`;
  const hash = crypto.createHash('sha1').update(fingerprint).digest('hex');
  return path.join(OCR_CACHE_DIR, `${hash}.txt`);
}

function cacheLogId(cachePath) {
  return path.basename(cachePath).slice(0, 12);
}

function logOcrCache(event, engine, cachePath, extra = '') {
  const suffix = extra ? ` ${extra}` : '';
  console.log(`[beanpick:ocr-cache] ${engine} ${event} ${cacheLogId(cachePath)}${suffix}`);
}

function cachePathForImageUrl(imageUrl) {
  const urlPath = new URL(imageUrl).pathname;
  const extension = path.extname(urlPath).slice(0, 8) || '.jpg';
  const hash = crypto.createHash('sha1').update(imageUrl).digest('hex');
  return path.join(OCR_CACHE_DIR, `${hash}${extension}`);
}

async function downloadImageToCache(imageUrl) {
  if (!imageUrl) return '';

  try {
    fs.mkdirSync(OCR_CACHE_DIR, { recursive: true });
    const imagePath = cachePathForImageUrl(imageUrl);
    if (fs.existsSync(imagePath)) {
      logOcrCache('hit', 'image', imagePath);
      return imagePath;
    }

    logOcrCache('miss', 'image', imagePath);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      logOcrCache('fail', 'image', imagePath, `status=${response.status}`);
      return '';
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(imagePath, buffer);
    logOcrCache('save', 'image', imagePath, `bytes=${buffer.length}`);
    return imagePath;
  } catch {
    return '';
  }
}

async function readOcrTextFromImageUrl(imageUrl, options = {}) {
  const imagePath = await downloadImageToCache(imageUrl);
  if (!imagePath) return '';

  try {
    fs.mkdirSync(OCR_CACHE_DIR, { recursive: true });
    const textPath = ocrTextCachePathForImageUrl(imageUrl, options);
    if (fs.existsSync(textPath)) {
      logOcrCache('hit', 'paddle', textPath);
      return fs.readFileSync(textPath, 'utf8');
    }

    logOcrCache('miss', 'paddle', textPath, `lang=${normalizePaddleOcrLang(options.lang)}`);

    const args = [
      path.join(__dirname, '..', 'scripts', 'paddle_ocr.py'),
      imagePath,
      '--lang',
      normalizePaddleOcrLang(options.lang),
    ];

    const text = await new Promise((resolve) => {
      execFile(options.pythonPath || getPaddleOcrPythonPath(), args, {
        timeout: options.timeout || 20000,
        windowsHide: true,
        env: {
          ...process.env,
          PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT: '0',
          PYTHONIOENCODING: 'utf-8',
        },
      }, (error, stdout) => {
        resolve(error ? null : String(stdout || ''));
      });
    });

    if (text == null) {
      logOcrCache('fail', 'paddle', textPath);
      return '';
    }
    fs.writeFileSync(textPath, text, 'utf8');
    logOcrCache('save', 'paddle', textPath, `chars=${text.length}`);
    return text;
  } catch {
    return '';
  }
}

const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_NOTE_PROMPT = '이 이미지는 커피 원두 상품 사진 또는 상세페이지 캡쳐입니다. 이미지에 적힌 커핑노트(테이스팅 노트, 향미 표현)만 한국어 단어로 뽑아주세요. 예: 초콜릿, 자몽, 자스민. 노트가 명확히 보이지 않으면 빈 배열을 반환하세요. 다른 설명 없이 JSON 배열 형식으로만 답하세요. 예: ["초콜릿", "자몽"]';

function guessImageMimeType(imagePath) {
  const extension = path.extname(imagePath).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  return 'image/jpeg';
}

// Gemini 비전 응답에서 JSON 배열만 뽑아 노트 후보 목록으로 변환
function parseGeminiNoteList(text) {
  const match = String(text || '').match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed.map((note) => String(note || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function readGeminiTasteNotesFromImageUrl(imageUrl) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.log('[beanpick:ocr-cache] gemini skip api-key-empty');
    return '';
  }

  const imagePath = await downloadImageToCache(imageUrl);
  if (!imagePath) return '';

  try {
    fs.mkdirSync(OCR_CACHE_DIR, { recursive: true });
    const textPath = ocrTextCachePathForImageUrl(imageUrl, { engine: 'gemini', lang: 'gemini', psm: GEMINI_MODEL });
    if (fs.existsSync(textPath)) {
      logOcrCache('hit', 'gemini', textPath);
      return fs.readFileSync(textPath, 'utf8');
    }

    logOcrCache('miss', 'gemini', textPath, `model=${GEMINI_MODEL}`);

    const base64Image = fs.readFileSync(imagePath).toString('base64');
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: GEMINI_NOTE_PROMPT },
            { inlineData: { mimeType: guessImageMimeType(imagePath), data: base64Image } },
          ],
        }],
        generationConfig: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      logOcrCache('fail', 'gemini', textPath, `status=${response.status}`);
      return '';
    }

    const json = await response.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    fs.writeFileSync(textPath, text, 'utf8');
    logOcrCache('save', 'gemini', textPath, `chars=${text.length}`);
    return text;
  } catch {
    return '';
  }
}

function cleanOcrText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/([가-힣])\s+(?=[가-힣])/g, '$1')
    .trim();
}

const NON_TASTING_NOTES = new Set([
  '원두',
  '디카페인',
  '블렌드',
  '블랜드',
  '다크',
  '홀빈',
  '분쇄',
  '커피',
  '확인 필요',
]);

const TASTING_NOTE_PATTERNS = [
  // Fruity - Berries (과일향 - 베리류)
  ['블루베리', /블루베리|blueberry/i],
  ['라즈베리', /라즈베리|raspberry/i],
  ['검은딸기', /검은딸기|blackberry/i],
  ['딸기', /딸기|strawberry/i],
  ['베리', /베리|berry/i],
  ['까치밥', /까치밥|currant/i],
  ['크랜베리', /크랜베리|cranberry/i],
  ['보이센베리', /보이센베리|boysenberry/i],
  // Fruity - Citrus (과일향 - 시트러스)
  ['오렌지', /오렌지|orange/i],
  ['레몬', /레몬|lemon/i],
  ['라임', /라임|lime/i],
  ['자몽', /자몽|grapefruit/i],
  ['시트러스', /시트러스|citrus/i],
  ['베르가못', /베르가못|베르가뭇|bergamot/i],
  ['유자', /유자|yuzu/i],
  // Fruity - Dried Fruit (과일향 - 말린 과일)
  ['건포도', /건포도|raisin/i],
  ['무화과', /무화과|fig/i],
  ['자두', /자두|plum/i],
  ['대추', /대추|jujube|date/i],
  ['말린살구', /말린살구|dried apricot/i],
  // Fruity - Tree Fruit (과일향 - 나무 과일)
  ['사과', /사과|(?<!pine)apple/i],
  ['배', /\bpear\b|서양배/i],
  ['살구', /살구|apricot/i],
  ['복숭아', /복숭아|복승아|peach/i],
  ['체리', /체리|cherry/i],
  // Fruity - Tropical (과일향 - 열대 과일)
  ['열대과일', /열대과일|업대과일|tropical/i],
  ['망고', /망고|mango/i],
  ['파인애플', /파인애플|pineapple/i],
  ['코코넛', /코코넛|coconut/i],
  ['멜론', /멜론|melon/i],
  ['파파야', /파파야|papaya/i],
  ['구아바', /구아바|guava/i],
  ['바나나', /바나나|banana/i],
  ['포도', /포도|grape/i],
  ['청포도', /청포도|greengrape/i],
  ['적포도', /적포도|redgrape/i],
  ['리치', /리치|lychee|litchi/i],
  ['패션프루트', /패션프루트|passionfruit/i],
  // Floral (꽃향)
  ['플로럴', /플로럴|floral/i],
  ['자스민', /자스민|jasmine/i],
  ['장미', /장미|rose/i],
  ['히비스커스', /히비스커스|hibiscus/i],
  ['꿀풀', /꿀풀|honeysuckle/i],
  ['진달래', /진달래|azalea/i],
  // Spices (향신료)
  ['스파이스', /스파이스|spice/i],
  ['계피', /계피|cinnamon/i],
  ['정향', /정향|clove/i],
  ['육두구', /육두구|nutmeg/i],
  ['카다몬', /카다몬|cardamom/i],
  ['검은후추', /검은후추|black pepper/i],
  ['생강', /생강|ginger/i],
  ['회향', /회향|anise/i],
  ['커민', /커민|cumin/i],
  ['오렌지꽃', /오렌지꽃|orange flower/i],
  // Nutty/Cocoa (견과류/코코아)
  ['초콜릿', /초콜릿|쵸콜릿|choco(?:late)?|cacao|카카오|코코아/i],
  ['다크초콜릿', /다크초콜릿|다크쵸콜릿|darkchoco(?:late)?/i],
  ['밀크초콜릿', /밀크초콜릿|밀크쵸콜릿|milkchoco(?:late)?/i],
  ['초코무스', /초코무스|chocomousse/i],
  ['아몬드', /아몬드|almond/i],
  ['헤이즐넛', /헤이즐넛|hazelnut/i],
  ['볶은아몬드', /볶은아몬드|roastedalmond/i],
  ['마카다미아', /마카다미아|macadamia/i],
  ['땅콩', /땅콩|peanut/i],
  ['견과류', /견과류|건과류|nutty|nuts?(?!meg)/i],
  ['호두', /호두|walnut/i],
  ['캐슈넛', /캐슈넛|cashew/i],
  // Sweet (단맛)
  ['꿀', /꿀|honey/i],
  ['캐러멜', /캐러멜|카라멜|caramel/i],
  ['브라운슈가', /브라운슈가|황설탕|brownsugar/i],
  ['당밀', /당밀|molasses/i],
  ['조청', /조청/i],
  ['시러피', /시러피|syrupy/i],
  ['바닐라', /바닐라|vanilla/i],
  ['달고나', /달고나/i],
  ['단맛', /단맛|sweet/i],
  ['메이플', /메이플|maple/i],
  ['뉘앙스', /뉘앙스|nuance/i],
  // Sour (신맛)
  ['신맛', /신맛|sour|tart/i],
  ['와이니', /와이니|winey|winy|wine/i],
  ['발효', /발효|fermented/i],
  ['식초', /식초|vinegar|acetic/i],
  ['요구르트', /요구르트|yogurt|lactic/i],
  // Roasted (구운 향)
  ['구운빵', /구운빵|토스트|toast/i],
  ['구운향', /구운향|roasted|roasting/i],
  ['태운맛', /태운맛|burnt|charred/i],
  ['재향', /재향|ashy|ash/i],
  ['스모키', /스모키|smoky|smoke/i],
  ['보리', /보리|barley|grain|cereal/i],
  ['빵', /빵|bread/i],
  // Green/Vegetative (풀향/채소향)
  ['풀향', /풀향|grassy|grass/i],
  ['허브', /허브|herbal|herb/i],
  ['신선', /신선|fresh|freshen/i],
  ['식초향', /식초향|vinegary|acidy/i],
  ['채소', /채소|vegetable|vegetative/i],
  ['짚', /짚|straw|hay/i],
  ['담배', /담배|tobacco/i],
  ['나뭇잎', /나뭇잎|leaf|leafy/i],
  ['향초', /향초|herbaceous|mint|thyme/i],
  ['크리미', /크리미|creamy/i],
  ['호박', /호박|pumpkin/i],
  ['녹차', /녹차|greentea/i],
  ['홍차', /홍차|blacktea/i],
  ['참깨', /참깨|참께|sesame/i],
];

function sanitizeTastingNotes(notes) {
  return normalizeTastingNotes(
    notes
      .map((note) => String(note || '').trim())
      .filter((note) => note && !NON_TASTING_NOTES.has(note)),
  );
}

function addNote(notes, note) {
  const cleanNote = String(note || '').trim();
  if (cleanNote && !NON_TASTING_NOTES.has(cleanNote) && !notes.includes(cleanNote)) {
    notes.push(cleanNote);
  }
}

function normalizeNoteText(text) {
  return String(text || '').replace(/\s+/g, '').toLowerCase();
}

function isSuspiciousOptionOnlyPrice(price, originalPrice) {
  const salePrice = Number(price || 0);
  const basePrice = Number(originalPrice || 0);
  return salePrice > 0
    && salePrice <= OPTION_ONLY_PRICE_MAX
    && basePrice >= OPTION_ONLY_ORIGINAL_MIN
    && basePrice / salePrice >= 10;
}

function normalizeSmartStorePrice(price, originalPrice) {
  return isSuspiciousOptionOnlyPrice(price, originalPrice) ? Number(originalPrice) : Number(price || 0);
}

function addNotesFromText(notes, text) {
  const compact = normalizeNoteText(text);

  TASTING_NOTE_PATTERNS.forEach(([note, pattern]) => {
    if (pattern.test(compact)) addNote(notes, note);
  });
}

function extractHashtagNoteTexts(text) {
  const notes = [];

  for (const match of text.matchAll(/#\s*([^#\s]+)/g)) {
    addNotesFromText(notes, match[1]);
  }

  return notes;
}

function extractNoteSection(text) {
  const noteMatch = text.match(/(?:cupping\s*note|tasting\s*note|taste\s*note|cup\s*note|\bnotes?\b|커핑\s*노트|향미|노트)\s*[:：]?\s*([^|]{0,240})/i);
  if (!noteMatch) return '';

  return noteMatch[1]
    .split(/\b(?:origin|composition|blend|altitude|variety|process|roasting\s*point|taste\s*scale)\b|원산지|구성|블렌드|고도|품종|가공/i)[0]
    .replace(/[|/]+/g, ' ')
    .trim();
}

function extractOcrTasteNotes(text) {
  const spacedText = String(text || '').replace(/\s+/g, ' ').trim();
  const normalized = cleanOcrText(text);
  const hashtagNotes = extractHashtagNoteTexts(spacedText);
  if (hashtagNotes.length > 0) return sanitizeTastingNotes(hashtagNotes);

  const noteText = extractNoteSection(normalized);

  const sectionNotes = [];
  addNotesFromText(sectionNotes, noteText);

  // 명확한 노트 영역만 사용해서 설명문 전체의 단맛/산미 추측을 막는다.
  const merged = [];
  for (const list of [sanitizeTastingNotes(sectionNotes), sanitizeTastingNotes(hashtagNotes)]) {
    for (const note of list) {
      if (!merged.includes(note)) merged.push(note);
      if (merged.length >= 5) break;
    }
    if (merged.length >= 5) break;
  }
  return merged.slice(0, 5);
}

// 썸네일 OCR 전용: "Tasting Note:" 라벨이 없어도 알려진 맛 단어를 전체 글자에서 직접 찾는다.
// 상품 상세설명(HTML)에는 쓰지 않는다 — 긴 마케팅 문구에서 엉뚱한 단어를 줍는 것을 막기 위함이다.
function extractFlavorNotesAnywhere(text) {
  const notes = [];
  addNotesFromText(notes, text);
  return sanitizeTastingNotes(notes).slice(0, 5);
}

async function getOcrTasteNotes(imageUrl) {
  // CI(깃허브 액션)에는 로컬 OCR이 없어서 Gemini를 먼저 시도하고, 없거나 실패하면 로컬 OCR로 전환
  if (process.env.GEMINI_API_KEY) {
    const geminiText = await readGeminiTasteNotesFromImageUrl(imageUrl);
    const geminiNotes = sanitizeTastingNotes(parseGeminiNoteList(geminiText));
    if (geminiNotes.length > 0) return geminiNotes;
  }

  const ocrText = await readOcrTextFromImageUrl(imageUrl, { lang: 'korean', psm: 6, timeout: 25000 });
  const anchoredNotes = extractOcrTasteNotes(ocrText);
  if (anchoredNotes.length > 0) return anchoredNotes;
  // 라벨이 없는 썸네일을 위해 전체 글자에서 한 번 더 찾는다.
  return extractFlavorNotesAnywhere(ocrText);
}

async function readOfficialMallImageText(imageUrl, options = {}, deps = {}) {
  const env = deps.env || process.env;
  const readGeminiText = deps.readGeminiText || readGeminiTasteNotesFromImageUrl;
  const readOcrText = deps.readOcrText || readOcrTextFromImageUrl;

  if (env.GEMINI_API_KEY) {
    const geminiText = await readGeminiText(imageUrl);
    const geminiNotes = sanitizeTastingNotes(parseGeminiNoteList(geminiText));
    if (geminiNotes.length > 0) {
      return `Tasting Note: ${geminiNotes.join(', ')}`;
    }
  }

  return readOcrText(imageUrl, options);
}

function isForceGeminiNotesEnabled(env = process.env) {
  return env.BEANPICK_FORCE_GEMINI_NOTES === '1';
}

function shouldRunThumbnailOcr(product, { force = false } = {}) {
  return Boolean(product?.imageUrl) && (force || !product.tastingNotes?.length);
}

function mergeTastingNotes(existingNotes, nextNotes) {
  const merged = [];
  for (const note of sanitizeTastingNotes([...(existingNotes || []), ...(nextNotes || [])])) {
    if (!merged.includes(note)) merged.push(note);
    if (merged.length >= 5) break;
  }
  return merged;
}

// 기본은 노트가 빈 상품만 보강한다. 정밀 수집 모드에서는 기존 노트가 있어도 썸네일을 다시 읽어 합친다.
async function enrichProductsWithThumbnailOcr(products, { concurrency = 3, force = isForceGeminiNotesEnabled() } = {}) {
  return mapWithConcurrency(products, concurrency, async (product) => {
    if (!shouldRunThumbnailOcr(product, { force })) return product;

    try {
      const ocrNotes = await getOcrTasteNotes(product.imageUrl);
      if (ocrNotes.length === 0) return product;
      return { ...product, tastingNotes: mergeTastingNotes(product.tastingNotes, ocrNotes) };
    } catch {
      return product;
    }
  });
}

function compactTitleKey(title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '');
}

// 검색 API 결과에서 얻은 노트를 제목이 같은(또는 포함 관계인) 상품에 옮겨 붙인다.
function mergeNotesFromSearchResults(products, searchProducts) {
  const notesByKey = new Map();
  for (const item of searchProducts || []) {
    if (item.tastingNotes?.length > 0) notesByKey.set(compactTitleKey(item.productName), item.tastingNotes);
  }
  if (notesByKey.size === 0) return products;

  return products.map((product) => {
    if (product.tastingNotes.length > 0) return product;

    const key = compactTitleKey(product.productName);
    let notes = notesByKey.get(key);
    if (!notes && key.length >= 6) {
      for (const [candidateKey, candidateNotes] of notesByKey) {
        if (candidateKey.length >= 6 && (candidateKey.includes(key) || key.includes(candidateKey))) {
          notes = candidateNotes;
          break;
        }
      }
    }
    return notes ? { ...product, tastingNotes: notes } : product;
  });
}

function extractSmartStoreDetailImageUrls(html) {
  return [...new Set(
    [...String(html || '').matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/gi)]
      .map((match) => match[1])
      .filter((url) => /^https?:\/\//i.test(url))
      .filter((url) => !/blank\.gif|\.svg|sprite/i.test(url)),
  )];
}

// 스마트스토어 상세 본문에서 노트 추출: 글자(무료)를 먼저 보고, 없으면 본문 이미지 OCR
async function extractNotesFromDetail(detailHtml, { maxImages = 4 } = {}) {
  const text = String(detailHtml || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const textNotes = extractOcrTasteNotes(text);
  if (textNotes.length > 0) return textNotes;

  for (const imageUrl of extractSmartStoreDetailImageUrls(detailHtml).slice(0, maxImages)) {
    const notes = await getOcrTasteNotes(imageUrl);
    if (notes.length > 0) return notes;
  }

  return [];
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

async function normalizeShoppingItem(item, source, index) {
  const rawTitle = stripHtml(item.title);
  const title = cleanShoppingTitle(rawTitle, source.roasterName) || rawTitle;
  const price = Number(item.lprice || 0);
  const titleNotes = getTasteNotes(rawTitle);
  const ocrNotes = await getOcrTasteNotes(item.image || '');
  const tastingNotes = sanitizeTastingNotes(ocrNotes.length > 0 ? [...ocrNotes, ...titleNotes] : titleNotes);

  return {
    id: createProductId(source.sourceId, item),
    roasterName: source.roasterName,
    productName: title,
    origin: stripHtml(item.mallName || ''),
    process: '',
    roastLevel: '확인 필요',
    price,
    weight: parseWeight(rawTitle),
    score: Math.max(60, 88 - index),
    tastingNotes,
    productUrl: normalizeSmartStoreProductUrl(item.link, source, item),
    storeUrl: getSmartStoreListUrl(source, item),
    imageUrl: item.image || '',
    isSoldOut: false,
    isNew: index < 2,
    lastCheckedAt: '방금',
    checkedMinutesAgo: index,
  };
}

function normalizeSmartStoreCategoryItem(item, source, index) {
  const rawTitle = stripHtml(item.title);
  const title = cleanShoppingTitle(rawTitle, source.roasterName) || rawTitle;
  const rawOriginal = Number(item.originalPrice || 0);
  const price = normalizeSmartStorePrice(item.price, rawOriginal);
  const originalPrice = rawOriginal > price ? rawOriginal : undefined;
  const titleNotes = getTasteNotes(rawTitle);

  return {
    id: `${source.sourceId}-${String(item.id || item.productUrl || rawTitle).replace(/[^a-z0-9가-힣]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()}`,
    roasterName: source.roasterName,
    productName: title,
    origin: source.roasterName,
    process: '',
    roastLevel: '확인 필요',
    price,
    originalPrice,
    weight: parseWeight(rawTitle),
    score: Math.max(60, 88 - index),
    tastingNotes: sanitizeTastingNotes(titleNotes),
    productUrl: normalizeSmartStoreProductUrl(item.productUrl, source, item),
    storeUrl: getSmartStoreListUrl(source, item),
    imageUrl: item.imageUrl || '',
    isSoldOut: Boolean(item.isSoldOut),
    isNew: index < 2,
    lastCheckedAt: '방금',
    checkedMinutesAgo: index,
  };
}

function normalizeSmartStoreCategoryItems(sourceId, items) {
  const source = SMARTSTORE_SOURCES[sourceId];
  if (!source) {
    throw new Error(`지원하지 않는 스마트스토어입니다: ${sourceId}`);
  }

  return items
    .filter((item) => isCollectableSmartStoreTitle(stripHtml(item.title)))
    .map((item, index) => normalizeSmartStoreCategoryItem(item, source, index))
    .filter((product) => !isAmbiguousBulkOptionProduct(product))
    .filter((product) => Number(product.weight || 0) <= 1000);
}

function isSourceItem(item, source) {
  const mallName = stripHtml(item.mallName).toLowerCase();
  return source.mallNames.some((name) => mallName === name.toLowerCase() || mallName.includes(name.toLowerCase()));
}

async function searchNaverShopping(sourceId) {
  const source = SMARTSTORE_SOURCES[sourceId];
  if (!source) {
    throw new Error(`지원하지 않는 스마트스토어입니다: ${sourceId}`);
  }

  const config = requireNaverSearchConfig();
  const url = new URL(NAVER_SHOPPING_SEARCH_URL);
  url.searchParams.set('query', source.query);
  url.searchParams.set('display', '30');
  url.searchParams.set('start', '1');
  url.searchParams.set('sort', 'sim');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Naver-Client-Id': config.clientId,
      'X-Naver-Client-Secret': config.clientSecret,
    },
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body.errorMessage || body.message || body.errorCode || '';
    throw new Error(`네이버 쇼핑 검색 실패 (${response.status})${message ? `: ${message}` : ''}`);
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const sourceItems = items
    .filter((item) => isSourceItem(item, source))
    .filter((item) => isCollectableSmartStoreTitle(stripHtml(item.title)));

  return {
    ok: true,
    sourceId,
    sourceUrl: 'https://shopping.naver.com',
    query: source.query,
    total: Number(body.total || 0),
    fetchedAt: new Date().toISOString(),
    products: (await mapWithConcurrency(sourceItems, 3, (item, index) => normalizeShoppingItem(item, source, index)))
      .filter((product) => !isAmbiguousBulkOptionProduct(product)),
    warning: sourceItems.length === 0 ? `${source.roasterName} 상품을 네이버 쇼핑 검색 결과에서 찾지 못했습니다.` : '',
  };
}

async function testSmartStoreSearch() {
  const sourceIds = Object.keys(SMARTSTORE_SOURCES);
  const results = await Promise.all(sourceIds.map((sourceId) => searchNaverShopping(sourceId)));
  const productCount = results.reduce((sum, result) => sum + result.products.length, 0);

  return {
    ok: true,
    productCount,
    sources: results.map((result) => ({
      sourceId: result.sourceId,
      query: result.query,
      total: result.total,
      productCount: result.products.length,
      products: result.products.slice(0, 5).map((product) => ({
        productName: product.productName,
        tastingNotes: product.tastingNotes,
      })),
      warning: result.warning,
    })),
    message: `네이버 쇼핑에서 스마트스토어 원두 ${productCount}개를 찾았습니다.`,
  };
}

module.exports = {
  SMARTSTORE_SOURCES,
  _test: {
    cleanShoppingTitle,
    extractOcrTasteNotes,
    extractFlavorNotesAnywhere,
    getTasteNotes,
    isSuspiciousOptionOnlyPrice,
    isAmbiguousBulkOptionProduct,
    isCollectableSmartStoreTitle,
    normalizeSmartStoreCategoryItems,
    normalizeSmartStorePrice,
    parseWeight,
    normalizeTastingNotes,
    getOcrCacheDir,
    parseGeminiNoteList,
    readOfficialMallImageText,
    shouldRunThumbnailOcr,
    mergeTastingNotes,
    extractNotesFromDetail,
    extractSmartStoreDetailImageUrls,
    mergeNotesFromSearchResults,
    normalizeSmartStoreProductUrl,
  },
  enrichProductsWithThumbnailOcr,
  extractNotesFromDetail,
  mergeNotesFromSearchResults,
  loadLocalEnv,
  readOfficialMallImageText,
  readOcrTextFromImageUrl,
  normalizeSmartStoreCategoryItems,
  searchNaverShopping,
  testSmartStoreSearch,
};
