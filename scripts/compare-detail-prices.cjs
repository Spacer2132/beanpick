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
// 옵션 productUrl에서 뽑은 productNo 직접 인덱스만 만든다.
// 그룹핑으로 흡수된 옵션은 대표 상품의 priceOptions에 productUrl로 남는다.
// (채널+무게 폴백은 서로 다른 상품과 비교하는 오탐 원인이라 제거했다.)
function buildSnapshotIndexes() {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const products = Array.isArray(snapshot) ? snapshot : snapshot.products;
  const byProductNo = new Map();
  const excludedByProductNo = new Set();

  const addOption = (productNo, weight, price, snapshotProductId) => {
    const key = String(productNo);
    if (!byProductNo.has(key)) byProductNo.set(key, []);
    byProductNo.get(key).push({ weight, price, snapshotProductId });
  };

  for (const product of products) {
    const channel = findChannelByUrl(product.productUrl);
    if (!channel || channel.channelType !== 'smartStore') continue;
    for (const option of Array.isArray(product.priceOptions) ? product.priceOptions : []) {
      const optionNo = extractExternalProductId(option.productUrl || '') || extractExternalProductId(product.productUrl);
      if (optionNo) addOption(optionNo, Number(option.weight || 0), Number(option.price || 0), product.id);
    }
    const representativeNo = extractExternalProductId(product.productUrl);
    if (representativeNo) addOption(representativeNo, Number(product.weight || 0), Number(product.price || 0), product.id);
  }

  for (const excluded of snapshot?.quality?.excluded || []) {
    const dash = String(excluded.id || '').indexOf('-');
    if (dash <= 0) continue;
    excludedByProductNo.add(String(excluded.id).slice(dash + 1));
  }

  return { byProductNo, excludedByProductNo, total: products.length };
}

// ── 비교 ────────────────────────────────────────────────────────
function compare() {
  const caches = readLatestCacheByProductNo();
  const indexes = buildSnapshotIndexes();
  const snapshotPublishedAt = Date.parse(JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')).publishedAt || '');
  const rows = [];
  let matched = 0;
  let priceDiff = 0;
  let missing = 0;
  let excluded = 0;
  let noWeight = 0;
  const diffs = [];

  for (const [productNo, cache] of caches) {
    const options = Array.isArray(cache.priceOptions) ? cache.priceOptions : [];
    if (options.length === 0) continue;
    for (const option of options) {
      const weight = Number(option.weight || 0);
      const price = Number(option.price || 0);
      if (!weight || !price) continue;
      // 옵션의 실제 productUrl이 우선이다. 파일명 productNo는 옵션 URL이 비었을 때 폴백.
      // (그룹 옵션은 대표와 번호가 다른 경우가 있어 파일명 기준 매칭은 오탐을 만든다.)
      const optionNo = extractExternalProductId(option.productUrl || '') || String(productNo);
      const candidates = indexes.byProductNo.get(optionNo) || [];
      const sameWeight = candidates.filter((entry) => Number(entry.weight) === weight);
      const entry = sameWeight[0] || null;
      if (!entry) {
        if (candidates.length > 0) {
          // 같은 상품은 있으나 같은 무게가 없음 — 옵션 소실 후보.
          noWeight += 1;
          if (rows.length < 400) {
            rows.push({ productNo: optionNo, weight, price, classification: 'no-matching-weight', cachedAt: cache.cachedAt });
          }
        } else if (indexes.excludedByProductNo.has(optionNo)) {
          excluded += 1;
        } else {
          missing += 1;
          if (rows.length < 400) {
            rows.push({ productNo: optionNo, weight, price, classification: 'missing-in-snapshot', cachedAt: cache.cachedAt });
          }
        }
        continue;
      }
      const cacheNewer = Number.isFinite(snapshotPublishedAt) && Date.parse(cache.cachedAt || '') > snapshotPublishedAt;
      if (Number(entry.price) === price) {
        matched += 1;
      } else {
        priceDiff += 1;
        diffs.push({
          productNo: optionNo,
          weight,
          cachePrice: price,
          snapshotPrice: Number(entry.price),
          cachedAt: cache.cachedAt,
          cacheNewerThanSnapshot: cacheNewer,
          snapshotProductId: entry.snapshotProductId,
        });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    cacheProducts: caches.size,
    compared: matched + priceDiff + missing + excluded + noWeight,
    matched,
    priceDiff,
    // 같은 그룹의 여러 캐시가 동일 옵션 세트를 품고 있어 옵션 단위 비교는 중복 카운트된다.
    uniquePriceDiffProducts: new Set(diffs.map((d) => `${d.productNo}::${d.weight}::${d.cachePrice}::${d.snapshotPrice}`)).size,
    missingInSnapshot: missing,
    excludedInSnapshot: excluded,
    noMatchingWeight: noWeight,
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
  console.log(`[compare:prices] 가격 일치 ${report.matched} · 가격 불일치 ${report.priceDiff}(유니크 상품 ${report.uniquePriceDiffProducts}) · 무게 대응 없음 ${report.noMatchingWeight} · 스냅샷에 없음 ${report.missingInSnapshot} · 게이트 제외 ${report.excludedInSnapshot}`);
  for (const diff of report.diffs.slice(0, 15)) {
    console.log(`    ${diff.productNo} | ${diff.weight}g | 캐시 ${diff.cachePrice} vs 스냅샷 ${diff.snapshotPrice} | 캐시${diff.cacheNewerThanSnapshot ? '가 최신' : '가 오래됨'} | 캐시시각 ${String(diff.cachedAt).slice(0, 16)}`);
  }
  if (report.diffs.length > 15) console.log(`    ... 외 ${report.diffs.length - 15}개`);
  console.log(`[compare:prices] 리포트: ${outPath}`);
}

main();
