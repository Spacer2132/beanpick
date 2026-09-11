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
// 스냅샷 수집이 스마트스토어 items를 걸러 쓰는 것과 같은 정규화 체인. rawOnly 판정에 재현해 쓴다.
const { _test: { normalizeSmartStoreCategoryItems } } = require(path.join(ROOT, 'electron', 'naverShoppingSearch.cjs'));

// ── 플랫폼별 원문 → 상품 ID·이름 추출기 ─────────────────────────
// 각 추출기는 실측으로 검증했다 (2026-09-11): cafe24 7곳 anchorBoxId, smartStore 9곳 /products/N,
// terarosa rows[].itemkey 37=totalcount 37, imweb 2곳 data-product-properties(&quot; 디코딩 필요).

function decodeHtmlEntities(value) {
  return String(value || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

// 스마트스토어 수집이 상품명을 뽑는 경로와 동일하게 data-shp-contents-dtl의 chnl_prod_nm을 읽는다.
// raw에는 스냅샷 정규화 체인 재현에 필요한 items 모양(title·price·productUrl)을 담는다.
function extractSmartStoreItems(body, channel) {
  const slug = (() => {
    for (const url of channel.listUrls) {
      const hit = String(url).match(/smartstore\.naver\.com\/([^/?#]+)/i);
      if (hit) return hit[1];
    }
    return '';
  })();
  const items = new Map();
  for (const tag of body.matchAll(/<[^>]*data-shp-contents-id="(\d+)"[^>]*>/g)) {
    const id = tag[1];
    if (items.has(id)) continue;
    const attrs = tag[0];
    if (!/data-shp-contents-type="chnl_prod_no"/.test(attrs)) continue;
    let name = '';
    let price = 0;
    const dtl = attrs.match(/data-shp-contents-dtl="([^"]*)"/i)?.[1] || '';
    try {
      const details = JSON.parse(decodeHtmlEntities(dtl));
      const detail = Object.fromEntries(details.map((entry) => [entry.key, entry.value]));
      name = String(detail.chnl_prod_nm || '');
      price = Number(detail.price || 0) || 0;
    } catch {
      // dtl이 없거나 깨져 있으면 이름 없이 ID만 쓴다.
    }
    items.set(id, {
      id,
      name,
      raw: {
        id,
        title: name,
        price,
        originalPrice: 0,
        productUrl: slug ? `https://smartstore.naver.com/${slug}/products/${id}` : '',
        imageUrl: '',
        isSoldOut: false,
      },
    });
  }
  return [...items.values()];
}

function extractCafe24Items(body, url) {
  let origin = '';
  try { origin = new URL(url).origin; } catch { origin = ''; }
  const items = new Map();
  for (const block of body.matchAll(/<li\s+id=["']anchorBoxId_([^"']+)["'][\s\S]*?(?=<li\s+id=["']anchorBoxId_|<\/ul>)/gi)) {
    const productNo = block[1];
    if (items.has(productNo)) continue;
    const nameHtml = block[0].match(/<div\s+class=["']name["'][^>]*>[\s\S]*?<\/div>/i)?.[0] || '';
    const name = nameHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s*상품명\s*:\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    // 이름을 못 뽑아도 ID는 비교 대상이므로 빈 이름으로라도 남긴다.
    items.set(productNo, name);
  }
  return [...items].map(([id, name]) => ({ id, name }));
}

function extractTerarosaItems(body) {
  try {
    const parsed = JSON.parse(body);
    return (parsed.rows || [])
      .map((row) => ({ id: String(row.itemkey || '').trim(), name: String(row.itemname || '').trim() }))
      .filter((item) => item.id);
  } catch {
    return [];
  }
}

// imweb 목록은 data-product-properties='{...}' 형태만 믿는다.
// momos 원문에는 같은 이름을 참조하는 JS 코드가 섞여 있어 넓게 매칭하면 오매칭된다.
function extractImwebItems(body) {
  const items = new Map();
  for (const match of body.matchAll(/data-product-properties='([^']*)'/gi)) {
    try {
      const properties = JSON.parse(decodeHtmlEntities(match[1]));
      const idx = String(properties.idx || '').trim();
      if (idx && !items.has(idx)) items.set(idx, String(properties.name || '').trim());
    } catch {
      // 속성값이 아니거나 JSON이 아니면 건너뛴다.
    }
  }
  return [...items].map(([id, name]) => ({ id, name }));
}

function extractItemsForChannel(channel, body, url) {
  if (channel.channelType === 'smartStore') return extractSmartStoreItems(body, channel);
  if (channel.platform === 'imweb') return extractImwebItems(body);
  if (channel.platform === 'api') return extractTerarosaItems(body);
  if (channel.platform === 'cafe24') return extractCafe24Items(body, url);
  return [];
}

// ── 원문만 있는 상품의 성격 판별 ────────────────────────────────
// 스마트스토어는 스냅샷 수집이 쓰는 것과 같은 제목 필터로 정확히 판정한다.
// 나머지 플랫폼은 어댑터 차단어·원두 신호의 핵심만 따온 휴리스틉 보조 분류다.
const HEURISTIC_BLOCKED_WORDS = ['드립백', '브루밍', '캡슐', '콜드브루', '인스턴트', '스틱', '믹스', '파우더', '더치', '굿즈', '텀블러', '머그', '에코백', '구독', '정기', '드리퍼', '서버', '그라인더', '머신', '필터', '컵', '백포', '포스터', '스티커', 'drip', 'capsule', 'cold brew', 'stick', 'goods', 'tumbler', 'mug', 'subscription'];
const HEURISTIC_BEAN_SIGNALS = ['원두', '홀빈', '블렌드', '블랜드', '싱글오리진', 'single origin', 'washed', 'natural', 'honey', '워시드', '내추럴', '게이샤', '디카페인', 'decaf', 'coffee', '에티오피아', '케냐', '콜롬비아', '브라질', '과테말라', '온두라스', '르완다', '인도네시아', '예가체프', '시다모', '코스타리카', '파나마', '니카라과', '멕시코', '페루', '볼리비아'];

function classifyRawOnlyItem(channel, name) {
  if (!name) return 'no-name';
  if (channel.channelType === 'smartStore') return null; // 스마트스토어는 기존 필터 함수로 판정한다.
  const lower = name.toLowerCase();
  if (HEURISTIC_BLOCKED_WORDS.some((word) => lower.includes(word))) return 'blocked-word';
  if (HEURISTIC_BEAN_SIGNALS.some((word) => lower.includes(word))) return 'bean-signal';
  return 'unknown';
}

// ── 원문 관측 읽기 ─────────────────────────────────────────────
function collectRawItemsByChannel(registry) {
  const byChannel = {};
  for (const meta of listRawObservations()) {
    const entry = byChannel[meta.channelId] = byChannel[meta.channelId] || { items: new Map(), observations: [] };
    entry.observations.push({ observationId: meta.observationId, url: meta.url, lastSeenAt: meta.lastSeenAt, bytes: meta.bytes });
    const channel = registry.find((item) => item.channelId === meta.channelId);
    if (!channel) continue;
    const raw = readRawObservation(meta.observationId);
    if (!raw) continue;
    for (const item of extractItemsForChannel(channel, raw.body, meta.url)) {
      const previous = entry.items.get(item.id);
      if (!previous) {
        entry.items.set(item.id, item);
      } else {
        // 이름·원시 형태는 있는 쪽을 우선해 합친다. 같은 상품이 카테고리·페이지 관측에 걸쳐 나올 수 있다.
        entry.items.set(item.id, {
          id: item.id,
          name: previous.name || item.name,
          raw: previous.raw || item.raw,
        });
      }
    }
  }
  return byChannel;
}

// ── 스냅샷 읽기 ────────────────────────────────────────────────
// 메인 상품뿐 아니라 두 부속 위치도 함께 읽는다.
// - priceOptions[].productUrl: 용량 변형이 그룹 대표의 옵션으로 흡수된 자리.
// - quality.excluded[]: 게시 품질 게이트가 의도적으로 제외한 상품(예: 18g 샘플).
function collectSnapshotIdsByChannel(registry) {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const products = Array.isArray(snapshot) ? snapshot : snapshot.products;
  const byChannel = {};
  let unattributed = 0;
  let unidentified = 0;
  const addId = (channel, externalId, kind) => {
    const entry = byChannel[channel.channelId] = byChannel[channel.channelId] || { ids: new Set(), products: [] };
    // 옵션으로 흡수된 ID도 스냅샷이 알고 있는 ID로 친다. 용량 변형이 대표 상품 안에 병합된 자리다.
    entry.ids.add(externalId);
    const productEntry = entry.products.find((p) => p.externalId === externalId);
    if (productEntry) {
      productEntry.kinds.push(kind);
    } else {
      entry.products.push({ externalId, id: '', kinds: [kind], isStale: false, isSoldOut: false });
    }
  };
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
      kinds: ['main'],
    });
    for (const option of Array.isArray(product.priceOptions) ? product.priceOptions : []) {
      const optionId = extractExternalProductId(option.productUrl || '');
      if (optionId) addId(channel, optionId, 'option');
    }
  }
  const excludedIds = new Map();
  for (const excluded of snapshot?.quality?.excluded || []) {
    // excluded 항목에는 productUrl이 없다. id가 '<sourceId>-<externalId>' 형태라 여기서 배정한다.
    const dash = String(excluded.id || '').indexOf('-');
    if (dash <= 0) continue;
    const sourceId = String(excluded.id).slice(0, dash);
    const channel = registry.find((item) => item.sourceId === sourceId);
    if (!channel) continue;
    const externalId = String(excluded.id).slice(dash + 1);
    if (externalId) excludedIds.set(`${channel.channelId}::${externalId}`, excluded.reasons || []);
  }
  return { byChannel, excludedIds, unattributed, unidentified, total: products.length };
}

// ── 비교 ────────────────────────────────────────────────────────
async function compare() {
  const problems = checkRegistryDrift();
  if (problems.length > 0) {
    console.warn('[compare] 등록 설정 불일치:');
    problems.forEach((problem) => console.warn(`  - ${problem}`));
  }
  const registry = listChannels();
  const rawByChannel = collectRawItemsByChannel(registry);
  const snap = collectSnapshotIdsByChannel(registry);
  // 스냅샷이 상품을 묶는 데 쓰는 그룹 키 정규화. ESM이라 동적 import로 가져온다.
  const { normalizeProductNameForGroup } = await import(`file://${path.join(ROOT, 'src', 'services', 'coreFeatures.js').replace(/\\/g, '/')}`);

  const rows = [];
  for (const channel of registry) {
    const raw = rawByChannel[channel.channelId];
    const snapshotEntry = snap.byChannel[channel.channelId];
    const rawItems = raw ? [...raw.items.values()] : [];
    const snapshotIds = snapshotEntry ? [...snapshotEntry.ids] : [];
    const rawSet = new Set(rawItems.map((item) => item.id));
    const snapshotSet = new Set(snapshotIds);
    const matchedCount = rawItems.filter((item) => snapshotSet.has(item.id)).length;

    // 스마트스토어는 스냅샷과 같은 정규화 체인 + 그룹핑을 원문에 재적용해
    // "원문에만 있고 그룹으로도 설명 안 되는" 상품만 누락 후보로 남긴다.
    let groupReplay = null;
    let rawOnly = [];
    if (channel.channelType === 'smartStore' && rawItems.length > 0) {
      const replayItems = rawItems.filter((item) => item.raw?.title).map((item) => ({ ...item.raw }));
      let normalized = [];
      try {
        normalized = normalizeSmartStoreCategoryItems(channel.sourceId, replayItems);
      } catch (error) {
        console.warn(`[compare] ${channel.sourceId} 정규화 재현 실패: ${error?.message || error}`);
      }
      const groups = new Map();
      for (const product of normalized) {
        const key = [product.roasterName, normalizeProductNameForGroup(product.productName)].join('::').toLowerCase().replace(/\s+/g, '');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(String(product.productUrl || '').match(/\/products\/(\d+)/)?.[1] || '');
      }
      const uncovered = [...groups.entries()]
        .filter(([, ids]) => !ids.some((id) => snapshotSet.has(id) || snap.excludedIds.has(`${channel.channelId}::${id}`)))
        .map(([key, ids]) => ({ key, representativeId: ids[0] || '', name: key.split('::')[1] || '' }));
      groupReplay = {
        normalizedCount: normalized.length,
        groupCount: groups.size,
        coveredGroups: groups.size - uncovered.length,
        uncoveredGroups: uncovered,
      };
      rawOnly = rawItems.filter((item) => !snapshotSet.has(item.id)).map((item) => ({
        ...item,
        classification: 'absorbed-by-grouping',
      }));
    } else {
      rawOnly = rawItems
        .filter((item) => !snapshotSet.has(item.id))
        .map((item) => ({
          ...item,
          classification: snap.excludedIds.has(`${channel.channelId}::${item.id}`)
            ? 'excluded-by-quality-gate'
            : classifyRawOnlyItem(channel, item.name),
        }));
    }
    const snapshotOnly = snapshotEntry
      ? snapshotEntry.products.filter((product) => !rawSet.has(product.externalId))
      : [];

    // 원문에서 뽑을 ID가 아예 없으면 비교가 아니라 관측 부재다.
    const hasRaw = Boolean(raw) && rawItems.length > 0;
    rows.push({
      channelId: channel.channelId,
      sourceId: channel.sourceId,
      roasterName: channel.roasterName,
      platform: channel.platform,
      hasRaw,
      observationCount: raw ? raw.observations.length : 0,
      observationUrls: raw ? [...new Set(raw.observations.map((o) => o.url))] : [],
      lastSeenAt: raw ? raw.observations.map((o) => o.lastSeenAt).sort().pop() : null,
      rawCount: rawItems.length,
      snapshotCount: snapshotIds.length,
      matchedCount,
      rawOnly,
      // 스마트스토어는 그룹핑 재현 후에도 스냅샷에 없는 그룹이 진짜 누락 후보다.
      rawOnlySuspectCount: groupReplay ? groupReplay.uncoveredGroups.length : rawOnly.filter((item) => item.classification === 'bean-signal').length,
      groupReplay,
      snapshotOnly: snapshotOnly.map((product) => ({ id: product.id, isStale: product.isStale, isSoldOut: product.isSoldOut })),
    });
  }

  return { generatedAt: new Date().toISOString(), snapshotTotal: snap.total, unattributed: snap.unattributed, unidentified: snap.unidentified, rows };
}

// ── 출력 ────────────────────────────────────────────────────────
async function main() {
  const report = await compare();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `list-integrity-${report.generatedAt.replace(/[:.]/g, '-').slice(0, 19)}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[compare] 스냅샷 ${report.snapshotTotal}개 (미배정 ${report.unattributed}, ID추출실패 ${report.unidentified})`);
  console.log('채널 | 플랫폼 | 원문 | 스냅샷 | 일치 | 원문만 | 의심 | 스냅샷만 | 관측');
  for (const row of report.rows) {
    const mark = row.hasRaw ? '' : ' (원문없음)';
    const replay = row.groupReplay ? ` 정규화${row.groupReplay.normalizedCount}/그룹${row.groupReplay.groupCount}` : '';
    console.log(`${row.sourceId} | ${row.platform} | ${row.rawCount} | ${row.snapshotCount} | ${row.matchedCount} | ${row.rawOnly.length} | ${row.rawOnlySuspectCount} | ${row.snapshotOnly.length} | ${row.observationCount}${mark}${replay}`);
  }
  const suspects = report.rows.filter((row) => row.rawOnlySuspectCount > 0);
  for (const row of suspects) {
    if (row.groupReplay) {
      console.log(`[compare] ${row.sourceId} 그룹핑 재현 후 누락 후보 ${row.groupReplay.uncoveredGroups.length}개:`);
      for (const group of row.groupReplay.uncoveredGroups.slice(0, 12)) console.log(`    ${group.representativeId} | ${String(group.name).slice(0, 60)}`);
    } else {
      const list = row.rawOnly.filter((item) => item.classification === 'bean-signal');
      console.log(`[compare] ${row.sourceId} 원두 신호 ${list.length}개:`);
      for (const item of list.slice(0, 12)) console.log(`    ${item.id} | ${String(item.name).slice(0, 60)}`);
      if (list.length > 12) console.log(`    ... 외 ${list.length - 12}개`);
    }
  }
  const noRaw = report.rows.filter((row) => !row.hasRaw).map((row) => row.sourceId);
  if (noRaw.length > 0) console.log(`[compare] 원문 관측이 없는 채널: ${noRaw.join(', ')}`);
  console.log(`[compare] 리포트: ${outPath}`);
}

main();
