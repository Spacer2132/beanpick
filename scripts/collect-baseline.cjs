// 수집 엔진 교체 1단계: 현재 엔진의 판매처별 기준값을 실제 산출물에서 뽑아 저장한다.
// 라이브 재수집은 하지 않는다. 마지막 게시 스냅샷 + 마지막 자동게시 로그 + 스마트스토어 상세 캐시만 읽는다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = path.join(ROOT, 'docs', 'products.json');
const LOG_DIR = path.join(ROOT, 'output');
const OUT_DIR = path.join(ROOT, 'output', 'baseline');

// 5단계 등록 계층이 판매처 목록의 단일 출처다. 이 스크립트가 따로 설정을 적지 않는다.
function buildRegistry() {
  const { listChannels, checkRegistryDrift } = require(path.join(ROOT, 'electron', 'collection', 'registry.cjs'));
  const problems = checkRegistryDrift();
  if (problems.length > 0) {
    console.warn('[baseline] 등록 설정 불일치:');
    problems.forEach((problem) => console.warn(`  - ${problem}`));
  }
  return listChannels();
}

function attribute(registry, productUrl) {
  const url = String(productUrl || '');
  const hit = registry.find((channel) => channel.matchKey && url.includes(channel.matchKey));
  return hit ? hit.sourceId : '(미상)';
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function createSourceRow(sourceId) {
  return {
    sourceId,
    roasterNames: new Set(),
    rows: 0,
    groupedRows: 0,
    idPrefixes: new Set(),
    withOptions: 0,
    optionsComplete: 0,
    completeWithoutOptions: 0,
    optionCountTotal: 0,
    withPrice: 0,
    withWeight: 0,
    withDiscount: 0,
    withNotes: 0,
    soldOut: 0,
    per100: [],
    listUrlOnly: 0,
  };
}

function summarizeSnapshot(registry) {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const perSource = {};
  for (const product of snapshot.products) {
    const sourceId = attribute(registry, product.productUrl);
    if (!perSource[sourceId]) perSource[sourceId] = createSourceRow(sourceId);
    const row = perSource[sourceId];
    const options = Array.isArray(product.priceOptions) ? product.priceOptions : [];
    row.roasterNames.add(product.roasterName);
    row.rows += 1;
    if (Number(product.groupedProductCount || 0) > 1) row.groupedRows += 1;
    row.idPrefixes.add(String(product.id).split('-')[0]);
    if (options.length > 0) row.withOptions += 1;
    if (product.priceOptionsComplete === true) row.optionsComplete += 1;
    // 근거(옵션)가 하나도 없는데 완전 수집으로 표시된 행. 새 엔진에서 0건이어야 한다.
    if (product.priceOptionsComplete === true && options.length === 0) row.completeWithoutOptions += 1;
    row.optionCountTotal += options.length;
    if (Number(product.price) > 0) row.withPrice += 1;
    if (Number(product.weight) > 0) row.withWeight += 1;
    if (Number(product.discountRate || 0) > 0) row.withDiscount += 1;
    if (Array.isArray(product.tastingNotes) && product.tastingNotes.length > 0) row.withNotes += 1;
    if (product.isSoldOut) row.soldOut += 1;
    if (Number(product.price) > 0 && Number(product.weight) > 0) {
      row.per100.push(Math.round((product.price / product.weight) * 100));
    }
    // 상품 고유 페이지가 아니라 검색·목록 페이지로만 연결된 행은 상품 식별이 확정되지 않은 것이다.
    if (/\/(search|list)\.html|\?keyword=/i.test(String(product.productUrl || ''))) row.listUrlOnly += 1;
  }
  return { snapshot, perSource };
}

function summarizeLatestLog() {
  const logs = fs.readdirSync(LOG_DIR).filter((name) => /^auto-publish-\d+\.log$/.test(name)).sort();
  if (logs.length === 0) return null;
  const file = logs[logs.length - 1];
  const text = fs.readFileSync(path.join(LOG_DIR, file), 'utf8');
  const markers = [...text.matchAll(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (START|END) auto-publish(?: \(exit (\d+)\))?/g)];
  const runs = [];
  for (let index = 0; index < markers.length - 1; index += 1) {
    if (markers[index][2] !== 'START' || markers[index + 1][2] !== 'END') continue;
    const startedAt = markers[index][1];
    const endedAt = markers[index + 1][1];
    runs.push({
      startedAt,
      endedAt,
      elapsedSec: Math.round((new Date(endedAt.replace(' ', 'T')) - new Date(startedAt.replace(' ', 'T'))) / 1000),
      exitCode: Number(markers[index + 1][3] ?? -1),
    });
  }
  const smartStoreCategoryLines = {};
  for (const match of text.matchAll(/\[beanpick:smartstore-category\] ([a-z0-9]+) /g)) {
    smartStoreCategoryLines[match[1]] = (smartStoreCategoryLines[match[1]] || 0) + 1;
  }
  return {
    file,
    runs,
    loadSuccessLines: (text.match(/beanpick:load-success/g) || []).length,
    loadFallbackLines: (text.match(/beanpick:load-fallback/g) || []).length,
    smartStoreCategoryLines,
    // 로그에 판매처별 타임스탬프가 없어 판매처별 소요시간은 이 방법으로 얻을 수 없다.
    perSourceElapsed: null,
  };
}

function getDetailCacheDir() {
  const env = process.env;
  if (env.BEANPICK_SMARTSTORE_DETAIL_CACHE_DIR) return env.BEANPICK_SMARTSTORE_DETAIL_CACHE_DIR;
  const base = env.LOCALAPPDATA || env.XDG_CACHE_HOME || (env.HOME ? path.join(env.HOME, '.cache') : '');
  return base ? path.join(base, 'BeanPick', 'smartstore-detail-cache') : '';
}

function summarizeDetailCache(registry, snapshot) {
  const dir = getDetailCacheDir();
  if (!dir || !fs.existsSync(dir)) return { dir, exists: false };
  const productNoToSource = {};
  for (const product of snapshot.products) {
    const productNo = String(product.productUrl || '').match(/smartstore\.naver\.com\/[^/]+\/products\/(\d+)/i)?.[1];
    if (productNo) productNoToSource[productNo] = attribute(registry, product.productUrl);
  }
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json'));
  const statusCount = {};
  const perSource = {};
  const samples = {};
  for (const name of files) {
    const productNo = name.split('-')[0];
    const sourceId = productNoToSource[productNo] || '(스냅샷에 없음)';
    let parsed = null;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    } catch {
      statusCount.unreadable = (statusCount.unreadable || 0) + 1;
      continue;
    }
    const status = parsed.status || '(없음)';
    statusCount[status] = (statusCount[status] || 0) + 1;
    if (!perSource[sourceId]) {
      perSource[sourceId] = { files: 0, withOptions: 0, withText: 0, oldestCachedAt: null, newestCachedAt: null };
    }
    const row = perSource[sourceId];
    row.files += 1;
    if (Array.isArray(parsed.priceOptions) && parsed.priceOptions.length > 0) row.withOptions += 1;
    if (String(parsed.detailText || '').trim()) row.withText += 1;
    if (parsed.cachedAt) {
      if (!row.oldestCachedAt || parsed.cachedAt < row.oldestCachedAt) row.oldestCachedAt = parsed.cachedAt;
      if (!row.newestCachedAt || parsed.cachedAt > row.newestCachedAt) row.newestCachedAt = parsed.cachedAt;
    }
    if (!samples[sourceId] && sourceId !== '(스냅샷에 없음)') {
      const raw = fs.readFileSync(path.join(dir, name));
      samples[sourceId] = {
        file: name,
        bytes: raw.length,
        sha256: crypto.createHash('sha256').update(raw).digest('hex'),
      };
    }
  }
  return { dir, exists: true, files: files.length, statusCount, perSource, samples };
}

// 4단계에서 도입한 원문 저장소 현황. 공식몰 대표 원문 공백을 여기서 확인한다.
function summarizeRawStore() {
  const rawStore = require(path.join(ROOT, 'electron', 'collection', 'rawStore.cjs'));
  const dir = rawStore.getRawStoreDir();
  const entries = rawStore.listRawObservations();
  const perChannel = {};
  for (const entry of entries) {
    const channelId = entry.channelId || '(미상)';
    if (!perChannel[channelId]) perChannel[channelId] = { observations: 0, storedBytes: 0, newestSeenAt: null, sample: null };
    const row = perChannel[channelId];
    row.observations += 1;
    row.storedBytes += Number(entry.storedBytes || 0);
    if (!row.newestSeenAt || entry.lastSeenAt > row.newestSeenAt) row.newestSeenAt = entry.lastSeenAt;
    if (!row.sample) row.sample = { observationId: entry.observationId, url: entry.urls?.[0] || entry.url, sha256: entry.sha256 };
  }
  return {
    dir,
    observations: entries.length,
    storedBytes: entries.reduce((sum, entry) => sum + Number(entry.storedBytes || 0), 0),
    perChannel,
  };
}

// 6단계 실행 기록. 자동게시 로그와 달리 한글이 깨지지 않고 판매처별 상태·소요시간이 그대로 남는다.
function summarizeRuns() {
  const runManager = require(path.join(ROOT, 'electron', 'collection', 'runManager.cjs'));
  const runs = runManager.listRuns();
  const latest = runs[runs.length - 1] || null;
  return {
    dir: runManager.getRunDir(),
    runs: runs.length,
    latest: latest && {
      runId: latest.runId,
      startedAt: latest.startedAt,
      elapsedMs: latest.elapsedMs,
      succeededSources: latest.succeededSources,
      fallbackSources: latest.fallbackSources,
      sources: (latest.sources || [])
        .slice()
        .sort((a, b) => b.elapsedMs - a.elapsedMs)
        .map(({ channelId, status, itemCount, unit, elapsedMs, error }) => ({ channelId, status, itemCount, unit, elapsedMs, error })),
    },
  };
}

function toSourceSummary(row) {
  return {
    sourceId: row.sourceId,
    roasterNames: [...row.roasterNames],
    rows: row.rows,
    groupedRows: row.groupedRows,
    idPrefixes: [...row.idPrefixes],
    withOptions: row.withOptions,
    optionsComplete: row.optionsComplete,
    completeWithoutOptions: row.completeWithoutOptions,
    optionCountTotal: row.optionCountTotal,
    withPrice: row.withPrice,
    withWeight: row.withWeight,
    withDiscount: row.withDiscount,
    withNotes: row.withNotes,
    soldOut: row.soldOut,
    per100Min: row.per100.length ? Math.min(...row.per100) : null,
    per100Median: median(row.per100),
    per100Max: row.per100.length ? Math.max(...row.per100) : null,
    listUrlOnly: row.listUrlOnly,
  };
}

function main() {
  const registry = buildRegistry();
  const { snapshot, perSource } = summarizeSnapshot(registry);
  const log = summarizeLatestLog();
  const detailCache = summarizeDetailCache(registry, snapshot);
  const rawStore = summarizeRawStore();
  const collectionRuns = summarizeRuns();
  const sources = Object.values(perSource).map(toSourceSummary).sort((a, b) => b.rows - a.rows);

  const baseline = {
    capturedAt: new Date().toISOString(),
    method: '라이브 재수집 없음. docs/products.json + 최신 auto-publish 로그 + 스마트스토어 상세 캐시에서 산출.',
    snapshot: {
      path: 'docs/products.json',
      publishedAt: snapshot.publishedAt,
      count: snapshot.count,
      quality: snapshot.quality,
    },
    registry: registry.map(({ channelId, sourceId, channelType, platform, driver, matchKey }) => ({ channelId, sourceId, channelType, platform, driver, matchKey })),
    sources,
    log,
    detailCache,
    rawStore,
    collectionRuns,
    knownGaps: [
      '게시 스냅샷은 그룹 병합 후 결과라 옵션 단위 원본 행 수는 확보하지 못했다.',
      ...(rawStore.observations === 0
        ? ['원문 저장소가 비어 있다. 수집을 한 번 돌린 뒤 다시 뽑아야 공식몰 대표 원문이 남는다.']
        : []),
    ],
    resolvedGaps: [
      '판매처별 소요시간·완전성은 6단계 실행 기록(collection-runs)에서 기계가 읽을 수 있는 형태로 확보한다.',
      '공식몰 목록 대표 원문은 4단계 원문 저장소에서 확보한다.',
    ],
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = String(snapshot.publishedAt || new Date().toISOString()).slice(0, 10).replace(/-/g, '');
  const outPath = path.join(OUT_DIR, `baseline-${stamp}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');

  console.log(`기준 스냅샷: ${baseline.snapshot.publishedAt} / ${baseline.snapshot.count}개`);
  console.log(`판매처 ${sources.length}곳, 등록 설정 ${registry.length}건`);
  console.log('');
  console.log('sourceId         행수  그룹  옵션  완전  가격  용량  노트  품절  헛완전  목록링크  100g중앙');
  for (const source of sources) {
    console.log([
      source.sourceId.padEnd(16),
      String(source.rows).padStart(4),
      String(source.groupedRows).padStart(5),
      String(source.withOptions).padStart(5),
      String(source.optionsComplete).padStart(5),
      String(source.withPrice).padStart(5),
      String(source.withWeight).padStart(5),
      String(source.withNotes).padStart(5),
      String(source.soldOut).padStart(5),
      String(source.completeWithoutOptions).padStart(7),
      String(source.listUrlOnly).padStart(9),
      String(source.per100Median ?? '-').padStart(9),
    ].join(' '));
  }
  console.log('');
  if (log) {
    console.log(`로그 ${log.file}: 실행 ${log.runs.length}회, load-success ${log.loadSuccessLines}줄, load-fallback ${log.loadFallbackLines}줄`);
    for (const run of log.runs) {
      console.log(`  ${run.startedAt} → ${run.endedAt} (${run.elapsedSec}초, exit ${run.exitCode})`);
    }
  }
  console.log('');
  console.log(`상세 캐시: ${detailCache.exists ? `${detailCache.files}개 / ${JSON.stringify(detailCache.statusCount)}` : '없음'}`);
  console.log(`원문 저장소: 관측 ${rawStore.observations}건 / ${Math.round(rawStore.storedBytes / 1024)}KB / 채널 ${Object.keys(rawStore.perChannel).length}곳`);
  if (collectionRuns.latest) {
    const { latest } = collectionRuns;
    const partial = latest.sources.filter((entry) => entry.status !== 'complete');
    console.log(`실행 기록: ${collectionRuns.runs}회 보관 / 마지막 ${Math.round(latest.elapsedMs / 1000)}초 / 완전 ${latest.succeededSources}곳 / 완전 아님 ${partial.length}곳${partial.length > 0 ? ` (${partial.map((entry) => `${entry.channelId}:${entry.status}`).join(', ')})` : ''}`);
  } else {
    console.log('실행 기록: 없음 (수집을 한 번 돌리면 남는다)');
  }
  console.log(`저장: ${path.relative(ROOT, outPath)}`);
}

main();
