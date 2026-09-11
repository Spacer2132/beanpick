// 수집 엔진 교체 7단계 1회차: 원문 관측과 스냅샷의 목록 정합성 비교.
// 같은 판매처의 저장 원문에서 상품 ID를 다시 뽑아 스냅샷과 비교한다.
// 라이브 재수집은 하지 않는다. 원문(rawStore)과 마지막 게시 스냅샷만 읽는다.
// 가격·옵션 비교는 상세 원문 저장이 도입된 뒤 다음 회차 범위다.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = path.join(ROOT, 'docs', 'products.json');
const OUT_DIR = path.join(ROOT, 'output', 'compare');

const { listChannels, checkRegistryDrift, findChannelByUrl } = require(path.join(ROOT, 'electron', 'collection', 'registry.cjs'));
const { extractExternalProductId } = require(path.join(ROOT, 'electron', 'collection', 'contract.cjs'));
const { listRawObservations, readRawObservation } = require(path.join(ROOT, 'electron', 'collection', 'rawStore.cjs'));
const { extractCafe24ListItemLinks } = require(path.join(ROOT, 'src', 'services', 'adapters', 'stockStatus.cjs'));

// ── 플랫폼별 원문 → 상품 ID 추출기 ─────────────────────────────
// 각 추출기는 실측으로 검증했다 (2026-09-11): cafe24 7곳 anchorBoxId, smartStore 9곳 /products/N,
// terarosa rows[].itemkey 37=totalcount 37, imweb 2곳 data-product-properties(&quot; 디코딩 필요).

function extractSmartStoreIds(body) {
  return [...new Set([...body.matchAll(/\/products\/(\d+)/g)].map((match) => match[1]))];
}

function extractCafe24Ids(body, url) {
  let origin = '';
  try { origin = new URL(url).origin; } catch { origin = ''; }
  return extractCafe24ListItemLinks(body, origin).map((item) => item.productNo).filter(Boolean);
}

function extractTerarosaIds(body) {
  try {
    const parsed = JSON.parse(body);
    return [...new Set((parsed.rows || []).map((row) => String(row.itemkey || '').trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

function decodeHtmlEntities(value) {
  return String(value || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

// imweb 목록은 data-product-properties='{...}' 형태만 믿는다.
// momos 원문에는 같은 이름을 참조하는 JS 코드가 섞여 있어 넓게 매칭하면 오매칭된다.
function extractImwebIds(body) {
  const ids = new Set();
  for (const match of body.matchAll(/data-product-properties='([^']*)'/gi)) {
    try {
      const properties = JSON.parse(decodeHtmlEntities(match[1]));
      const idx = String(properties.idx || '').trim();
      if (idx) ids.add(idx);
    } catch {
      // 속성값이 아니거나 JSON이 아니면 건너뛴다.
    }
  }
  return [...ids];
}

function extractIdsForChannel(channel, body, url) {
  if (channel.channelType === 'smartStore') return extractSmartStoreIds(body);
  if (channel.platform === 'imweb') return extractImwebIds(body);
  if (channel.platform === 'api') return extractTerarosaIds(body);
  if (channel.platform === 'cafe24') return extractCafe24Ids(body, url);
  return [];
}

// ── 원문 관측 읽기 ─────────────────────────────────────────────
function collectRawIdsByChannel(registry) {
  const byChannel = {};
  for (const meta of listRawObservations()) {
    const entry = byChannel[meta.channelId] = byChannel[meta.channelId] || { ids: new Set(), observations: [] };
    entry.observations.push({ observationId: meta.observationId, url: meta.url, lastSeenAt: meta.lastSeenAt, bytes: meta.bytes });
    const channel = registry.find((item) => item.channelId === meta.channelId);
    if (!channel) continue;
    const raw = readRawObservation(meta.observationId);
    if (!raw) continue;
    extractIdsForChannel(channel, raw.body, meta.url).forEach((id) => entry.ids.add(id));
  }
  return byChannel;
}

// ── 스냅샷 읽기 ────────────────────────────────────────────────
function collectSnapshotIdsByChannel(registry) {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const products = Array.isArray(snapshot) ? snapshot : snapshot.products;
  const byChannel = {};
  let unattributed = 0;
  let unidentified = 0;
  for (const product of products) {
    const channel = findChannelByUrl(product.productUrl);
    if (!channel) { unattributed += 1; continue; }
    // 커피리브레처럼 상세 URL이 검색 주소면 URL에서 ID를 못 뽑는다. 상품 id는 '<sourceId>-<externalId>' 형태라 여기서 잡는다.
    const prefix = `${channel.sourceId}-`;
    const idFallback = String(product.id || '').startsWith(prefix) ? String(product.id).slice(prefix.length) : '';
    const externalId = extractExternalProductId(product.productUrl) || idFallback;
    if (!externalId) { unidentified += 1; continue; }
    const entry = byChannel[channel.channelId] = byChannel[channel.channelId] || { ids: new Set(), products: [] };
    entry.ids.add(externalId);
    entry.products.push({
      externalId,
      id: product.id,
      isStale: Boolean(product.isStale || product.roasterPreservedReason),
      isSoldOut: Boolean(product.isSoldOut),
    });
  }
  return { byChannel, unattributed, unidentified, total: products.length };
}

// ── 비교 ────────────────────────────────────────────────────────
function compare() {
  const problems = checkRegistryDrift();
  if (problems.length > 0) {
    console.warn('[compare] 등록 설정 불일치:');
    problems.forEach((problem) => console.warn(`  - ${problem}`));
  }
  const registry = listChannels();
  const rawByChannel = collectRawIdsByChannel(registry);
  const snap = collectSnapshotIdsByChannel(registry);

  const rows = [];
  for (const channel of registry) {
    const raw = rawByChannel[channel.channelId];
    const snapshotEntry = snap.byChannel[channel.channelId];
    const rawIds = raw ? [...raw.ids] : [];
    const snapshotIds = snapshotEntry ? [...snapshotEntry.ids] : [];
    const rawSet = new Set(rawIds);
    const snapshotSet = new Set(snapshotIds);
    const matched = rawIds.filter((id) => snapshotSet.has(id));
    const rawOnly = rawIds.filter((id) => !snapshotSet.has(id));
    // 스냅샷만 있는 상품은 URL/상품id에서 뽑은 externalId 기준으로 판정한다.
    // 스마트스토어 상품 id는 '<로스터명>-<상품명>' 형태라 sourceId prefix로는 ID를 못 뽑는다.
    const snapshotOnly = snapshotEntry
      ? snapshotEntry.products.filter((product) => !rawSet.has(product.externalId))
      : [];

    // 원문에서 뽑을 ID가 아예 없으면 비교가 아니라 관측 부재다.
    const hasRaw = Boolean(raw) && rawIds.length > 0;
    rows.push({
      channelId: channel.channelId,
      sourceId: channel.sourceId,
      roasterName: channel.roasterName,
      platform: channel.platform,
      hasRaw,
      observationCount: raw ? raw.observations.length : 0,
      observationUrls: raw ? [...new Set(raw.observations.map((o) => o.url))] : [],
      lastSeenAt: raw ? raw.observations.map((o) => o.lastSeenAt).sort().pop() : null,
      rawCount: rawIds.length,
      snapshotCount: snapshotIds.length,
      matchedCount: matched.length,
      rawOnlyIds: rawOnly,
      snapshotOnly: snapshotOnly.map((product) => ({ id: product.id, isStale: product.isStale, isSoldOut: product.isSoldOut })),
    });
  }

  return { generatedAt: new Date().toISOString(), snapshotTotal: snap.total, unattributed: snap.unattributed, unidentified: snap.unidentified, rows };
}

// ── 출력 ────────────────────────────────────────────────────────
function main() {
  const report = compare();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `list-integrity-${report.generatedAt.replace(/[:.]/g, '-').slice(0, 19)}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[compare] 스냅샷 ${report.snapshotTotal}개 (미배정 ${report.unattributed}, ID추출실패 ${report.unidentified})`);
  console.log('채널 | 플랫폼 | 원문ID | 스냅샷ID | 일치 | 원문만 | 스냅샷만 | 관측');
  for (const row of report.rows) {
    const mark = row.hasRaw ? '' : ' (원문없음)';
    console.log(`${row.sourceId} | ${row.platform} | ${row.rawCount} | ${row.snapshotCount} | ${row.matchedCount} | ${row.rawOnlyIds.length} | ${row.snapshotOnly.length} | ${row.observationCount}${mark}`);
  }
  const noRaw = report.rows.filter((row) => !row.hasRaw).map((row) => row.sourceId);
  if (noRaw.length > 0) console.log(`[compare] 원문 관측이 없는 채널: ${noRaw.join(', ')}`);
  console.log(`[compare] 리포트: ${outPath}`);
}

main();
