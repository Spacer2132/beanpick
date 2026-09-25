#!/usr/bin/env node
// Muse 감사용 원문 묶음 만들기 — 사용자 PC에서 한 번 실행한다.
//
// 읽는 것 (전부 로컬 캐시, 네트워크 접근 없음, .env 읽지 않음):
//   - docs/products.json                         기준 스냅샷
//   - %LOCALAPPDATA%/BeanPick/smartstore-detail-cache   스마트스토어 상세 본문·이미지 목록
//   - %LOCALAPPDATA%/BeanPick/raw-observations          공식몰·스마트스토어 원문(gzip)
//   - %LOCALAPPDATA%/BeanPick/ocr-cache  +  repo .ocr-cache   이미지별 OCR/Gemini 결과
//
// 쓰는 것:
//   audit-input/manifest.json         어떤 상품에 어떤 원문이 있는지, 커버리지 요약
//   audit-input/products/<id>.json    상품별 증거 묶음
//
// 사용법:  node muse-handoff/export-audit-evidence.cjs [--out audit-input] [--max-html-kb 300]
// 경로를 바꾸려면 BEANPICK_SMARTSTORE_DETAIL_CACHE_DIR / BEANPICK_RAW_OBSERVATION_DIR / BEANPICK_OCR_CACHE_DIR 사용.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const OUT_DIR = path.resolve(ROOT, argValue('--out', 'audit-input'));
const MAX_HTML_BYTES = Number(argValue('--max-html-kb', '300')) * 1024;

const env = process.env;
const cacheBase = env.LOCALAPPDATA || env.XDG_CACHE_HOME || (env.HOME ? path.join(env.HOME, '.cache') : '');
const DETAIL_CACHE_DIR = env.BEANPICK_SMARTSTORE_DETAIL_CACHE_DIR || (cacheBase ? path.join(cacheBase, 'BeanPick', 'smartstore-detail-cache') : '');
const RAW_DIR = env.BEANPICK_RAW_OBSERVATION_DIR || (cacheBase ? path.join(cacheBase, 'BeanPick', 'raw-observations') : '');
const OCR_DIRS = [
  env.BEANPICK_OCR_CACHE_DIR || (cacheBase ? path.join(cacheBase, 'BeanPick', 'ocr-cache') : ''),
  path.join(ROOT, '.ocr-cache'),
].filter((dir, index, list) => dir && fs.existsSync(dir) && list.indexOf(dir) === index);

// ── 비밀값 제거 ─────────────────────────────────────────────
// 현재 프로세스 환경변수 중 비밀로 보이는 값의 원문, 그리고 흔한 토큰 형식을 지운다.
const SECRET_ENV_NAME = /(KEY|SECRET|TOKEN|PASSWORD|PAT|CLIENT_ID|COOKIE|SESSION)/i;
const secretLiterals = Object.entries(env)
  .filter(([name, value]) => SECRET_ENV_NAME.test(name) && typeof value === 'string' && value.length >= 8)
  .map(([, value]) => value);
const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_\-]{30,}/g, // Google API key
  /gh[pousr]_[0-9A-Za-z]{30,}/g, // GitHub token
  /github_pat_[0-9A-Za-z_]{40,}/g,
  /sk-[0-9A-Za-z_\-]{20,}/g,
  /Bearer\s+[0-9A-Za-z._\-]{20,}/gi,
  /("?(?:access_?token|refresh_?token|authorization|cookie|set-cookie|session_?id|client_?secret|NNB|NID_AUT|NID_SES)"?\s*[:=]\s*)"[^"]{6,}"/gi,
];
let redactions = 0;
function scrub(text) {
  let out = String(text ?? '');
  for (const literal of secretLiterals) {
    if (out.includes(literal)) {
      redactions += out.split(literal).length - 1;
      out = out.split(literal).join('[REDACTED]');
    }
  }
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match, prefix) => {
      redactions += 1;
      return typeof prefix === 'string' ? `${prefix}"[REDACTED]"` : '[REDACTED]';
    });
  }
  return out;
}

// ── HTML 정리 ───────────────────────────────────────────────
function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}
function htmlToText(html) {
  return stripHtml(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|dd|dt|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}
function imageSources(html) {
  const urls = new Set();
  for (const match of String(html || '').matchAll(/<img[^>]+(?:src|data-src|ec-data-src)\s*=\s*["']([^"']+)["']/gi)) {
    urls.add(match[1]);
  }
  return [...urls];
}
function jsonLdBlocks(html) {
  return [...String(html || '').matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim());
}
function metaTags(html) {
  const tags = {};
  for (const match of String(html || '').matchAll(/<meta[^>]+(?:property|name)\s*=\s*["']([^"']+)["'][^>]*content\s*=\s*["']([^"']*)["']/gi)) {
    if (/^(og:|description|keywords|product:)/i.test(match[1])) tags[match[1]] = match[2];
  }
  return tags;
}
function cap(text, limit = MAX_HTML_BYTES) {
  const buffer = Buffer.from(String(text || ''), 'utf8');
  if (buffer.length <= limit) return { text: String(text || ''), truncated: false, bytes: buffer.length };
  return { text: buffer.subarray(0, limit).toString('utf8'), truncated: true, bytes: buffer.length };
}

// ── OCR 캐시 키 (electron/naverShoppingSearch.cjs 와 같은 방식) ──
function readSourceConstant(name) {
  try {
    const source = fs.readFileSync(path.join(ROOT, 'electron', 'naverShoppingSearch.cjs'), 'utf8');
    return source.match(new RegExp(`const ${name} = '([^']+)'`))?.[1] || '';
  } catch {
    return '';
  }
}
const GEMINI_MODEL = readSourceConstant('GEMINI_MODEL');
const GEMINI_NOTE_PROMPT_VERSION = readSourceConstant('GEMINI_NOTE_PROMPT_VERSION');
const OCR_KEY_VARIANTS = [
  { engine: 'gemini', lang: GEMINI_NOTE_PROMPT_VERSION, psm: GEMINI_MODEL },
  { engine: 'paddle', lang: 'kor+eng', psm: '6' },
];
function ocrEntriesForImage(imageUrl) {
  const found = [];
  for (const variant of OCR_KEY_VARIANTS) {
    const fingerprint = `${imageUrl}|${variant.engine}|${variant.lang}|${variant.psm}`;
    const hash = crypto.createHash('sha1').update(fingerprint).digest('hex');
    for (const dir of OCR_DIRS) {
      const file = path.join(dir, `${hash}.txt`);
      if (fs.existsSync(file)) {
        found.push({
          imageUrl,
          engine: variant.engine,
          promptOrLang: variant.lang,
          cacheDir: dir === path.join(ROOT, '.ocr-cache') ? 'repo/.ocr-cache' : 'local/ocr-cache',
          // 주의: gemini 항목은 원문 OCR이 아니라 모델이 뽑은 노트 결과다.
          output: scrub(fs.readFileSync(file, 'utf8')),
        });
        break;
      }
    }
  }
  return found;
}

// ── 스마트스토어 상세 캐시 ───────────────────────────────────
function loadDetailCacheIndex() {
  const index = new Map();
  if (!DETAIL_CACHE_DIR || !fs.existsSync(DETAIL_CACHE_DIR)) return index;
  for (const name of fs.readdirSync(DETAIL_CACHE_DIR)) {
    const match = name.match(/^(\d+)-[0-9a-f]{40}\.json$/);
    if (!match) continue;
    try {
      const file = path.join(DETAIL_CACHE_DIR, name);
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const list = index.get(match[1]) || [];
      list.push({ file: name, data, mtime: fs.statSync(file).mtimeMs });
      index.set(match[1], list);
    } catch {
      // 깨진 캐시는 건너뛴다.
    }
  }
  for (const list of index.values()) list.sort((a, b) => b.mtime - a.mtime);
  return index;
}

// ── 원문 저장소 ──────────────────────────────────────────────
function loadRawObservations() {
  const list = [];
  if (!RAW_DIR || !fs.existsSync(RAW_DIR)) return list;
  for (const name of fs.readdirSync(RAW_DIR)) {
    if (!name.endsWith('.meta.json')) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(RAW_DIR, name), 'utf8'));
      list.push({ meta, bodyFile: path.join(RAW_DIR, name.replace(/\.meta\.json$/, '.body.gz')) });
    } catch {
      // 깨진 메타는 건너뛴다.
    }
  }
  return list;
}
function readBody(entry) {
  try {
    return zlib.gunzipSync(fs.readFileSync(entry.bodyFile)).toString('utf8');
  } catch {
    return '';
  }
}
function urlKeys(url) {
  try {
    const parsed = new URL(url);
    // 쿼리로 상품을 구분하는 몰(테라로사 ItemCode 등)은 경로만으로 묶으면 모든 상품이 한 원문에 붙는다.
    const keys = [`${parsed.host}${parsed.pathname}${parsed.search}`];
    if (!parsed.search) keys.push(`${parsed.host}${parsed.pathname}`);
    for (const name of ['product_no', 'ItemCode', 'itemCode', 'idx', 'no', 'goodsNo', 'branduid']) {
      const value = parsed.searchParams.get(name);
      if (value) keys.push(`${parsed.host}|${name}=${value}`);
    }
    return keys;
  } catch {
    return [String(url || '')];
  }
}
function smartStoreProductNo(url) {
  return String(url || '').match(/\/products\/(\d+)/)?.[1] || '';
}

// ── 실행 ────────────────────────────────────────────────────
function gitHead() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

function main() {
  const snapshotPath = path.join(ROOT, 'docs', 'products.json');
  const snapshotRaw = fs.readFileSync(snapshotPath, 'utf8');
  const snapshot = JSON.parse(snapshotRaw);
  const products = snapshot.products || [];

  const detailIndex = loadDetailCacheIndex();
  const rawObservations = loadRawObservations();
  const rawByKey = new Map();
  for (const entry of rawObservations) {
    for (const url of entry.meta.urls || [entry.meta.url]) {
      const keys = [...urlKeys(url)];
      const productNo = smartStoreProductNo(url);
      if (productNo) keys.push(`ss|${productNo}`);
      for (const key of keys) {
        const list = rawByKey.get(key) || [];
        if (!list.includes(entry)) list.push(entry);
        rawByKey.set(key, list);
      }
    }
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT_DIR, 'products'), { recursive: true });

  const coverage = { total: products.length, detailCache: 0, detailText: 0, detailImages: 0, rawObservation: 0, ocrAny: 0, noEvidenceBeyondSnapshot: 0 };
  const perProduct = [];

  for (const product of products) {
    const evidence = { detailCache: null, rawObservations: [], ocr: [] };
    const productNo = smartStoreProductNo(product.productUrl);

    // 1) 스마트스토어 상세 캐시
    const cached = productNo ? detailIndex.get(productNo)?.[0] : null;
    if (cached) {
      const data = cached.data;
      const html = cap(stripHtml(data.detailHtml || ''));
      evidence.detailCache = {
        file: cached.file,
        cachedAt: data.cachedAt || '',
        status: data.status || '',
        detailText: scrub(data.detailText || htmlToText(data.detailHtml || '')),
        detailHtmlStripped: scrub(html.text),
        detailHtmlTruncated: html.truncated,
        detailImageUrls: data.detailImageUrls || imageSources(data.detailHtml || ''),
        priceOptions: data.priceOptions || [],
        otherKeys: Object.keys(data).filter((key) => !['detailHtml', 'detailText', 'detailImageUrls', 'priceOptions'].includes(key)),
      };
      coverage.detailCache += 1;
      if (evidence.detailCache.detailText.trim()) coverage.detailText += 1;
      if (evidence.detailCache.detailImageUrls.length) coverage.detailImages += 1;
    }

    // 2) 원문 저장소
    const keys = [...urlKeys(product.productUrl)];
    if (productNo) keys.push(`ss|${productNo}`);
    const matched = new Set();
    for (const key of keys) for (const entry of rawByKey.get(key) || []) matched.add(entry);
    for (const entry of [...matched].sort((a, b) => String(b.meta.lastSeenAt).localeCompare(String(a.meta.lastSeenAt))).slice(0, 3)) {
      const body = readBody(entry);
      const isJson = /json/i.test(entry.meta.contentType || '') || /^\s*[\[{]/.test(body);
      const html = cap(isJson ? body : stripHtml(body));
      evidence.rawObservations.push({
        observationId: entry.meta.observationId,
        channelId: entry.meta.channelId,
        url: entry.meta.url,
        contentType: entry.meta.contentType,
        lastSeenAt: entry.meta.lastSeenAt,
        extractorVersion: entry.meta.extractorVersion || '',
        text: isJson ? '' : scrub(htmlToText(body)).slice(0, MAX_HTML_BYTES),
        body: scrub(html.text),
        bodyTruncated: html.truncated,
        jsonLd: isJson ? [] : jsonLdBlocks(body).map(scrub),
        meta: isJson ? {} : metaTags(body),
        imageUrls: isJson ? [] : imageSources(body),
      });
    }
    if (evidence.rawObservations.length) coverage.rawObservation += 1;

    // 3) OCR 캐시 (대표 이미지 + 상세 이미지 + 기존 노트 근거 이미지)
    const images = new Set([product.imageUrl]);
    for (const url of evidence.detailCache?.detailImageUrls || []) images.add(url);
    for (const obs of evidence.rawObservations) for (const url of obs.imageUrls) images.add(url);
    for (const item of product.tastingNoteEvidence || []) if (item.sourceUrl) images.add(item.sourceUrl);
    for (const url of images) if (url) evidence.ocr.push(...ocrEntriesForImage(url));
    if (evidence.ocr.length) coverage.ocrAny += 1;

    const hasEvidence = Boolean(evidence.detailCache || evidence.rawObservations.length || evidence.ocr.length);
    if (!hasEvidence) coverage.noEvidenceBeyondSnapshot += 1;

    const safeId = String(product.id).replace(/[^a-z0-9_-]+/gi, '_');
    fs.writeFileSync(
      path.join(OUT_DIR, 'products', `${safeId}.json`),
      `${JSON.stringify({ id: product.id, snapshotRecord: product, evidence }, null, 2)}\n`,
      'utf8',
    );
    perProduct.push({
      id: product.id,
      file: `products/${safeId}.json`,
      roasterName: product.roasterName,
      isSoldOut: Boolean(product.isSoldOut),
      hasDetailCache: Boolean(evidence.detailCache),
      hasDetailText: Boolean(evidence.detailCache?.detailText?.trim()),
      detailImageCount: evidence.detailCache?.detailImageUrls?.length || 0,
      rawObservationCount: evidence.rawObservations.length,
      ocrEntryCount: evidence.ocr.length,
      hasEvidenceBeyondSnapshot: hasEvidence,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    repoHead: gitHead(),
    snapshot: {
      path: 'docs/products.json',
      publishedAt: snapshot.publishedAt || '',
      count: products.length,
      sha256: crypto.createHash('sha256').update(snapshotRaw).digest('hex'),
    },
    sources: {
      smartstoreDetailCache: DETAIL_CACHE_DIR && fs.existsSync(DETAIL_CACHE_DIR) ? `${detailIndex.size} productNos` : 'not found',
      rawObservations: RAW_DIR && fs.existsSync(RAW_DIR) ? `${rawObservations.length} observations` : 'not found',
      ocrCacheDirs: OCR_DIRS.map((dir) => (dir === path.join(ROOT, '.ocr-cache') ? 'repo/.ocr-cache' : 'local/ocr-cache')),
      ocrKeyVariants: OCR_KEY_VARIANTS.map((v) => `${v.engine}|${v.lang}|${v.psm}`),
    },
    notes: [
      'OCR 캐시 매칭은 현재 코드의 캐시 키(모델·프롬프트 버전)로만 찾는다. 예전 버전으로 만든 캐시(repo .ocr-cache 대부분)는 매칭되지 않을 수 있다.',
      'gemini OCR 캐시 항목은 이미지 원문 텍스트가 아니라 모델이 추출한 노트 결과다. Golden 근거로 쓸 때는 원문 증거가 아니라 "BeanPick 현재 추출값"으로 취급하라.',
      '원문 저장소(raw-observations)는 기본 7일·200MB로 정리되므로 오래된 상품은 원문이 없을 수 있다.',
      'script/style 태그는 제거했다. 비밀값으로 보이는 문자열은 [REDACTED]로 치환했다.',
    ],
    redactions,
    coverage,
    products: perProduct,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const totalBytes = fs.readdirSync(path.join(OUT_DIR, 'products'))
    .reduce((sum, name) => sum + fs.statSync(path.join(OUT_DIR, 'products', name)).size, 0);
  console.log(`[export] 상품 ${products.length}건 → ${path.relative(ROOT, OUT_DIR)}/ (${(totalBytes / 1024 / 1024).toFixed(1)}MB)`);
  console.log(`[export] 스마트스토어 상세 캐시: ${manifest.sources.smartstoreDetailCache}`);
  console.log(`[export] 원문 저장소: ${manifest.sources.rawObservations}`);
  console.log(`[export] OCR 캐시 폴더: ${manifest.sources.ocrCacheDirs.join(', ') || '없음'}`);
  console.log(`[export] 커버리지 ${JSON.stringify(coverage)}`);
  console.log(`[export] 비밀값 치환 ${redactions}건`);
  if (coverage.noEvidenceBeyondSnapshot > products.length * 0.5) {
    console.warn('[export] 경고: 절반 이상이 스냅샷 외 원문이 없다. 앱으로 한 번 수집을 돌린 직후(7일 이내)에 다시 실행하라.');
  }
  console.log('[export] 업로드 전에 manifest.json 과 상품 파일 몇 개를 직접 열어 비밀값이 없는지 확인하라.');
}

main();
