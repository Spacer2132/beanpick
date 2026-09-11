// 수집 엔진 교체 7단계 3회차: 스마트스토어 상세 캐시와 스냅샷의 가격·옵션 비교.
// 상세 캐시는 구 엔진이 상세에서 뽑은 해석본(priceOptions)을 보존한다.
// 스냅샷은 그 해석본이 그룹핑·병합을 거친 최종 모습이다.
// 이 비교는 병합 과정에서 가격이 왜곡되거나 옵션이 소실되지 않는지를 검증한다.
// 원문(detailHtml)은 캐시에 남지 않으므로 원문→해석 재검증은 범위 밖이다.
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = path.join(ROOT, 'docs', 'products.json');
const OUT_DIR = path.join(ROOT, 'output', 'compare');

const { findChannelByUrl } = require(path.join(ROOT, 'electron', 'collection', 'registry.cjs'));
const { extractExternalProductId } = require(path.join(ROOT, 'electron', 'collection', 'contract.cjs'));

function getDetailCacheDir() {
  if (process.env.BEANPICK_SMARTSTORE_DETAIL_CACHE_DIR) return process.env.BEANPICK_SMARTSTORE_DETAIL_CACHE_DIR;
  const base = process.env.LOCALAPPDATA || process.env.XDG_CACHE_HOME || (process.env.HOME ? path.join(process.env.HOME, '.cache') : '');
  return base ? path.join(base, 'BeanPick', 'smartstore-detail-cache') : path.join(os.tmpdir(), 'beanpick-smartstore-detail');
}

// 같은 상품의 캐시가 여러 개(상품명 지문 차이)일 수 있다. 가장 최근 것만 쓴다.
function readLatestCacheByProductNo() {
  const dir = getDetailCacheDir();
  if (!fs.existsSync(dir)) return new Map();
  const latest = new Map();
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const productNo = name.split('-')[0];
    try {
      const cache = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      const seenMs = Date.parse(cache.cachedAt || '');
      const previous = latest.get(productNo);
      if (!previous || (Number.isFinite(seenMs) && seenMs > Date.parse(previous.cachedAt || ''))) {
        latest.set(productNo, cache);
      }
    } catch {
      // 깨진 캐시 항목은 건너뛴다.
    }
  }
  return latest;
}

// ── 스냅샷 옵션 인덱스 ─────────────────────────────────────────
// productNo 직접 인덱스와 (채널, 무게) 폴백 인덱스를 함께 만든다.
// 그룹핑으로 흡수된 옵션은 대표 상품의 priceOptions에 productUrl로 남는다.
function buildSnapshotIndexes() {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const products = Array.isArray(snapshot) ? snapshot : snapshot.products;
  const byProductNo = new Map();
  const byChannelWeight = new Map();
  const excludedByProductNo = new Set();

  const addOption = (channelId, productNo, weight, price, snapshotProductId) => {
    const key = String(productNo);
    if (!byProductNo.has(key)) byProductNo.set(key, []);
    byProductNo.get(key).push({ weight, price, snapshotProductId });
    const weightKey = `${channelId}::${weight}`;
    if (!byChannelWeight.has(weightKey)) byChannelWeight.set(weightKey, []);
    byChannelWeight.get(weightKey).push({ weight, price, snapshotProductId, productNo });
  };

  for (const product of products) {
    const channel = findChannelByUrl(product.productUrl);
    if (!channel || channel.channelType !== 'smartStore') continue;
    for (const option of Array.isArray(product.priceOptions) ? product.priceOptions : []) {
      const optionNo = extractExternalProductId(option.productUrl || '') || extractExternalProductId(product.productUrl);
      if (optionNo) addOption(channel.channelId, optionNo, Number(option.weight || 0), Number(option.price || 0), product.id);
    }
    const representativeNo = extractExternalProductId(product.productUrl);
    if (representativeNo) addOption(channel.channelId, representativeNo, Number(product.weight || 0), Number(product.price || 0), product.id);
  }

  for (const excluded of snapshot?.quality?.excluded || []) {
    const dash = String(excluded.id || '').indexOf('-');
    if (dash <= 0) continue;
    excludedByProductNo.add(String(excluded.id).slice(dash + 1));
  }

  return { byProductNo, byChannelWeight, excludedByProductNo, total: products.length };
}

// ── 비교 ────────────────────────────────────────────────────────
function compare() {
  const caches = readLatestCacheByProductNo();
  const indexes = buildSnapshotIndexes();
  const rows = [];
  let matched = 0;
  let priceDiff = 0;
  let missing = 0;
  let excluded = 0;
  let weightOnly = 0;
  const diffs = [];

  for (const [productNo, cache] of caches) {
    const options = Array.isArray(cache.priceOptions) ? cache.priceOptions : [];
    if (options.length === 0) continue;
    const channelId = findChannelByUrl(options[0]?.productUrl || '')?.channelId || '';
    for (const option of options) {
      const weight = Number(option.weight || 0);
      const price = Number(option.price || 0);
      if (!weight || !price) continue;
      const direct = indexes.byProductNo.get(String(productNo)) || [];
      const sameWeight = direct.filter((entry) => Number(entry.weight) === weight);
      let entry = sameWeight[0] || null;
      let matchKind = 'direct';
      if (!entry && channelId) {
        // 그룹핑으로 대표 상품에 흡수된 경우 같은 채널의 같은 무게에서 찾는다. 오탐 가능성이 있어 종류를 남긴다.
        entry = (indexes.byChannelWeight.get(`${channelId}::${weight}`) || [])[0] || null;
        matchKind = 'weight-only';
      }
      if (!entry) {
        if (indexes.excludedByProductNo.has(String(productNo))) {
          excluded += 1;
        } else {
          missing += 1;
          if (rows.length < 400) {
            rows.push({ productNo, weight, price, classification: 'missing-in-snapshot', cachedAt: cache.cachedAt });
          }
        }
        continue;
      }
      if (Number(entry.price) === price) {
        matched += 1;
        if (matchKind === 'weight-only') weightOnly += 1;
      } else {
        priceDiff += 1;
        diffs.push({
          productNo,
          weight,
          cachePrice: price,
          snapshotPrice: Number(entry.price),
          matchKind,
          cachedAt: cache.cachedAt,
          snapshotProductId: entry.snapshotProductId,
        });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    cacheProducts: caches.size,
    compared: matched + priceDiff + missing + excluded,
    matched,
    matchedWeightOnly: weightOnly,
    priceDiff,
    missingInSnapshot: missing,
    excludedInSnapshot: excluded,
    diffs,
    missingRows: rows,
    snapshotTotal: indexes.total,
  };
}

function main() {
  const report = compare();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `detail-prices-${report.generatedAt.replace(/[:.]/g, '-').slice(0, 19)}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[compare:prices] 캐시 상품 ${report.cacheProducts}개 · 비교 옵션 ${report.compared}개 (스냅샷 ${report.snapshotTotal}종 기준)`);
  console.log(`[compare:prices] 가격 일치 ${report.matched}${report.matchedWeightOnly ? `(무게폴백 ${report.matchedWeightOnly})` : ''} · 가격 불일치 ${report.priceDiff} · 스냅샷에 없음 ${report.missingInSnapshot} · 게이트 제외 ${report.excludedInSnapshot}`);
  for (const diff of report.diffs.slice(0, 15)) {
    console.log(`    ${diff.productNo} | ${diff.weight}g | 캐시 ${diff.cachePrice} vs 스냅샷 ${diff.snapshotPrice} | ${diff.matchKind} | 캐시시각 ${String(diff.cachedAt).slice(0, 16)}`);
  }
  if (report.diffs.length > 15) console.log(`    ... 외 ${report.diffs.length - 15}개`);
  console.log(`[compare:prices] 리포트: ${outPath}`);
}

main();
