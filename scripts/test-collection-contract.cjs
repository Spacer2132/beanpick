// 수집 계약 회귀 테스트: 근거 없는 확정값과 근거 없는 완전성 표시를 막는다.
// 설계: .wiki/wiki/topics/roastery-collection-engine-replacement-2026-09-10.md
// 이 테스트가 실패하면 테스트를 고치지 말고 계약을 되돌릴 것.
const fs = require('node:fs');
const path = require('node:path');

const contract = require(path.join(__dirname, '..', 'electron', 'collection', 'contract.cjs'));

const failures = [];

function expect(condition, message, details = '') {
  if (!condition) failures.push(`${message}${details ? `: ${details}` : ''}`);
}

function expectThrows(run, message) {
  try {
    run();
    failures.push(message);
  } catch {
    // 기대한 거부
  }
}

const { COMPLETENESS } = contract;

// ── Part 1. 공통 식별자 ───────────────────────────────────────
const channelId = contract.createChannelId('coffeelibre', 'officialMall');
expect(channelId === 'coffeelibre:officialMall', '판매채널 ID 형식이 바뀜', channelId);

const productId = contract.createChannelProductId(channelId, '8055');
expect(productId === 'coffeelibre:officialMall::8055', '판매채널 상품 ID 형식이 바뀜', String(productId));
expect(contract.createChannelProductId(channelId, '') === null, '고유 상품 번호가 없는데 확정 ID를 만들었다');
expect(contract.createOptionId(productId, { weightGram: 200 }) === 'coffeelibre:officialMall::8055::200g', '옵션 ID 형식이 바뀜');
expect(contract.createOptionId(null, { weightGram: 200 }) === null, '상품 ID 없이 옵션 ID를 만들었다');

const parsed = contract.parseChannelProductId(productId);
expect(parsed.roasteryId === 'coffeelibre' && parsed.channelType === 'officialMall' && parsed.externalProductId === '8055', '식별자 역파싱이 깨짐', JSON.stringify(parsed));
// 등록 계층이 만드는 ID와 계약이 만드는 ID는 같은 형식이어야 한다.
expect(contract.createChannelId('fritz', 'officialMall') === 'fritz:officialMall', '계약과 등록 계층의 판매채널 ID 형식이 갈라짐');

// ── Part 2. RawObservation ────────────────────────────────────
const observation = contract.createRawObservation({ channelId, url: 'https://coffeelibre.kr/product/detail.html?product_no=8055', body: '<html>본문</html>' });
const sameObservation = contract.createRawObservation({ channelId, url: 'https://coffeelibre.kr/other', body: '<html>본문</html>' });
expect(observation.observationId === sameObservation.observationId, '같은 원문인데 관측 ID가 달라짐');
expect(observation.bytes > 0 && observation.sha256.length === 64, '원문 해시·크기가 기록되지 않음');
const otherChannelObservation = contract.createRawObservation({ channelId: 'fritz:officialMall', url: 'https://fritz.co.kr/x', body: '<html>본문</html>' });
expect(otherChannelObservation.observationId !== observation.observationId, '판매처가 다른데 같은 내용이라고 한 관측으로 합쳐졌다');
expect(otherChannelObservation.sha256 === observation.sha256, '같은 내용인데 내용 해시가 달라짐');
expectThrows(() => contract.createRawObservation({ channelId, url: '', body: 'x' }), '원문 URL 없이 관측을 만들 수 있었다');

// ── Part 3. FieldClaim ────────────────────────────────────────
function makeClaim(overrides = {}) {
  return contract.createFieldClaim({
    field: 'tastingNotes',
    value: ['자두'],
    subjectId: productId,
    observationId: observation.observationId,
    locator: 'div.detail > p:nth-child(2)',
    method: 'domText',
    confidence: 0.6,
    extractorVersion: 'notes@1',
    observedAt: '2026-09-10T05:00:00.000Z',
    ...overrides,
  });
}

expect(makeClaim().confidence === 0.6, '정상 주장이 만들어지지 않음');
expectThrows(() => makeClaim({ observationId: '' }), '근거 관측 없이 확정값을 만들 수 있었다');
expectThrows(() => makeClaim({ locator: '' }), '근거 위치 없이 확정값을 만들 수 있었다');
expectThrows(() => makeClaim({ extractorVersion: '' }), '추출기 버전 없이 확정값을 만들 수 있었다');
expectThrows(() => makeClaim({ method: 'guess' }), '알 수 없는 추출 방법을 받아들였다');
expectThrows(() => makeClaim({ confidence: 1.4 }), '신뢰도 범위를 벗어난 값을 받아들였다');

const resolved = contract.resolveClaims([
  makeClaim({ value: ['상품명추론'], method: 'vision', confidence: 0.4 }),
  makeClaim({ value: ['공식노트'], method: 'structuredData', confidence: 0.9 }),
]);
expect(resolved.values.tastingNotes[0] === '공식노트', '근거가 강한 주장이 이기지 않음', JSON.stringify(resolved.values));
expect(resolved.evidence.tastingNotes.observationId === observation.observationId, '확정값에 근거가 붙지 않음');

const tie = contract.resolveClaims([
  makeClaim({ value: ['텍스트'], method: 'domText', confidence: 0.7 }),
  makeClaim({ value: ['표'], method: 'domTable', confidence: 0.7 }),
]);
expect(tie.values.tastingNotes[0] === '표', '신뢰도가 같을 때 추출 방법 순위로 정해지지 않음');

// ── Part 4. 목록·옵션 완전성 ──────────────────────────────────
expect(contract.evaluateListCompleteness({ pagesFetched: 3, endConfirmed: true, itemsFound: 12 }) === COMPLETENESS.COMPLETE, '정상 목록이 완전으로 판정되지 않음');
expect(contract.evaluateListCompleteness({ pagesFetched: 3, endConfirmed: false, itemsFound: 12 }) === COMPLETENESS.PARTIAL, '끝 확인 없이 목록을 완전으로 판정했다');
expect(contract.evaluateListCompleteness({ pagesFetched: 3, pagesFailed: 1, endConfirmed: true, itemsFound: 12 }) === COMPLETENESS.PARTIAL, '실패한 페이지가 있는데 완전으로 판정했다');
expect(contract.evaluateListCompleteness({ pagesFetched: 0 }) === COMPLETENESS.FAILED, '한 페이지도 못 받았는데 실패로 판정되지 않음');
expect(contract.evaluateListCompleteness({ blocked: true, pagesFetched: 1 }) === COMPLETENESS.BLOCKED, '접근 차단이 별도 상태로 남지 않음');
expect(contract.evaluateListCompleteness({ pagesFetched: 2, endConfirmed: true, itemsFound: 0 }) === COMPLETENESS.EMPTY, '실제 0개와 수집 실패가 구분되지 않음');

expect(contract.evaluateOptionCompleteness({ enumerationConfirmed: true, observedCount: 3 }) === COMPLETENESS.COMPLETE, '정상 옵션이 완전으로 판정되지 않음');
expect(contract.evaluateOptionCompleteness({ enumerationConfirmed: false, observedCount: 3 }) === COMPLETENESS.PARTIAL, '전체 옵션 확인 없이 완전으로 판정했다');
expect(contract.evaluateOptionCompleteness({ enumerationConfirmed: false, observedCount: 0 }) === COMPLETENESS.FAILED, '옵션 수집 실패가 실패로 남지 않음');
expect(contract.evaluateOptionCompleteness({ enumerationConfirmed: true, observedCount: 2, expectedCount: 5 }) === COMPLETENESS.PARTIAL, '기대 개수보다 적은데 완전으로 판정했다');

const { COMPLETE, PARTIAL, EMPTY, FAILED, BLOCKED } = {
  COMPLETE: COMPLETENESS.COMPLETE,
  PARTIAL: COMPLETENESS.PARTIAL,
  EMPTY: COMPLETENESS.EMPTY,
  FAILED: COMPLETENESS.FAILED,
  BLOCKED: COMPLETENESS.BLOCKED,
};
expect(contract.combineListCompleteness([COMPLETE, COMPLETE]) === COMPLETE, '전부 완전인데 완전이 아님');
expect(contract.combineListCompleteness([COMPLETE, EMPTY]) === COMPLETE, '완전 + 실제 0개는 완전이어야 함');
expect(contract.combineListCompleteness([COMPLETE, FAILED]) === PARTIAL, '카테고리 하나가 실패했는데 완전으로 판정했다');
expect(contract.combineListCompleteness([COMPLETE, BLOCKED]) === PARTIAL, '카테고리 하나가 차단됐는데 완전으로 판정했다');
expect(contract.combineListCompleteness([FAILED, FAILED]) === FAILED, '전부 실패인데 실패로 판정되지 않음');
expect(contract.combineListCompleteness([EMPTY, EMPTY]) === EMPTY, '전부 0개인데 실제 0개로 판정되지 않음');
expect(contract.combineListCompleteness([]) === FAILED, '판정할 부분이 없는데 실패로 남지 않음');
expect(contract.combineListCompleteness([FAILED, BLOCKED]) === FAILED, '받은 게 하나도 없는데 부분 수집으로 판정했다');
expect(contract.combineListCompleteness([BLOCKED, BLOCKED]) === BLOCKED, '전부 차단인데 차단으로 남지 않음');
expect(contract.combineListCompleteness([PARTIAL, FAILED]) === PARTIAL, '일부라도 받았으면 부분 수집이어야 함');

// ── Part 5. 수집 실행 상태 ────────────────────────────────────
let clock = 1000;
const run = contract.createCollectionRun({ runId: 'run:test', startedAt: '2026-09-10T00:00:00.000Z', now: () => clock });
run.beginSource('a:smartStore');
clock += 2500;
run.endSource('a:smartStore', { status: COMPLETENESS.COMPLETE, itemCount: 12 });
run.beginSource('b:cafe24');
clock += 400;
run.endSource('b:cafe24', { status: COMPLETENESS.PARTIAL, itemCount: 9, usedFallback: true });
const finished = run.finish();

expect(finished.sources.length === 2, '판매처별 실행 기록이 남지 않음');
expect(finished.sources[0].elapsedMs === 2500, '판매처별 소요시간이 기록되지 않음', String(finished.sources[0].elapsedMs));
expect(finished.succeededSources === 1, '완전 수집 판매처 수가 틀림', String(finished.succeededSources));
expect(finished.fallbackSources === 1, '폴백으로 메운 판매처가 최신 성공과 구분되지 않음');
expectThrows(() => run.endSource('없는소스', { status: COMPLETENESS.COMPLETE }), '시작하지 않은 판매처를 종료할 수 있었다');
expectThrows(() => {
  const other = contract.createCollectionRun();
  other.beginSource('c:cafe24');
  other.endSource('c:cafe24', { status: 'ok' });
}, '알 수 없는 수집 상태를 받아들였다');

// ── Part 6. 호환층 (합성) ─────────────────────────────────────
const legacyFromEmpty = contract.toLegacyProduct({
  channelProductId: productId,
  roasterName: '커피리브레',
  productName: '테스트',
  optionCompleteness: COMPLETENESS.COMPLETE,
  options: [],
  price: 19000,
  weight: 200,
});
expect(legacyFromEmpty.priceOptionsComplete === false, '옵션 0개인데 완전 수집으로 내보냈다');
expect(legacyFromEmpty.priceOptionsStatus === 'partial', '옵션 0개일 때 상태가 partial로 낮춰지지 않음', legacyFromEmpty.priceOptionsStatus);

const legacyFromBlocked = contract.toLegacyProduct({
  channelProductId: productId,
  optionCompleteness: COMPLETENESS.BLOCKED,
  options: [{ weight: 200, price: 19000 }],
});
expect(legacyFromBlocked.priceOptionsStatus === 'failed', '접근 차단이 기존 상태에서 실패로 내려가지 않음');

const legacyStale = contract.toLegacyProduct({ channelProductId: productId, optionCompleteness: COMPLETENESS.PARTIAL, options: [], usedFallback: true });
expect(legacyStale.isStale === true, '폴백으로 메운 상품에 오래된 값 표시가 없음');

// 오래된 값 표시: 값은 그대로 두고 최신성만 정직하게 바꾼다.
const staleNow = Date.parse('2026-09-10T05:00:00.000Z');
const stale = contract.markStaleProduct(
  { id: 'x', price: 19000, originalPrice: 24000, discountRate: 0.21, lastCheckedAt: '방금 전', checkedMinutesAgo: 0 },
  { observedAtMs: staleNow - 3 * 60 * 60 * 1000, nowMs: staleNow },
);
expect(stale.isStale === true, '오래된 값에 표시가 붙지 않음');
expect(stale.checkedMinutesAgo === 180, '오래된 값의 경과 시간이 실제로 계산되지 않음', String(stale.checkedMinutesAgo));
expect(stale.lastCheckedAt.includes('3시간 전'), '오래된 값이 여전히 방금 전으로 표시됨', stale.lastCheckedAt);
expect(stale.lastCheckedAt !== '방금 전', '오래된 값을 최신 수집 성공으로 표시했다');
expect(stale.price === 19000 && stale.originalPrice === 24000 && stale.discountRate === 0.21, '오래된 값 표시가 가격·할인 값을 건드렸다');
expect(stale.lastObservedAt === new Date(staleNow - 3 * 60 * 60 * 1000).toISOString(), '마지막 관측 시각이 남지 않음');

const staleUnknown = contract.markStaleProduct({ id: 'y', checkedMinutesAgo: 5 }, { observedAtMs: null, nowMs: staleNow });
expect(staleUnknown.lastCheckedAt === '갱신 실패 · 이전 정보', '관측 시각을 모를 때 표시가 정직하지 않음', staleUnknown.lastCheckedAt);

expect(contract.extractExternalProductId('https://smartstore.naver.com/rick/products/12534453185') === '12534453185', '스마트스토어 상품 번호를 못 읽음');
expect(contract.extractExternalProductId('https://coffeelibre.kr/product/detail.html?product_no=8055') === '8055', 'cafe24 상품 번호를 못 읽음');
expect(contract.extractExternalProductId('https://www.terarosa.com/product/detail/?ItemCode=100543') === '100543', '테라로사 상품 번호를 못 읽음');
expect(contract.extractExternalProductId('https://coffeelibre.kr/product/search.html?keyword=%EB%82%98%EC%9D%B4') === '', '검색 URL에서 상품 번호를 만들어냈다');

// ── Part 7. 실데이터 343건 회귀 ───────────────────────────────
const snapshotPath = path.join(__dirname, '..', 'docs', 'products.json');
if (!fs.existsSync(snapshotPath)) {
  failures.push('docs/products.json이 없어 실데이터 검증을 못 했습니다');
} else {
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  let unidentified = 0;
  let legacyFakeComplete = 0;
  let contractFakeComplete = 0;
  let optionCountChanged = 0;
  let priceChanged = 0;
  let weightChanged = 0;
  let freshnessChanged = 0;
  let staleLost = 0;

  for (const product of snapshot.products) {
    const options = Array.isArray(product.priceOptions) ? product.priceOptions : [];
    if (product.priceOptionsComplete === true && options.length === 0) legacyFakeComplete += 1;

    const record = contract.fromLegacyProduct(product, { channelId: 'test:channel' });
    if (!record.identified) unidentified += 1;

    const roundTripped = contract.toLegacyProduct(record);
    if (roundTripped.priceOptionsComplete === true && roundTripped.priceOptions.length === 0) contractFakeComplete += 1;
    if (roundTripped.priceOptions.length !== options.length) optionCountChanged += 1;
    // 가격은 게시 가드와 가격 이력의 기준값이라 왕복에서 변하면 안 된다.
    if (Number(roundTripped.price || 0) !== Number(product.price || 0)) priceChanged += 1;
    if (Number(roundTripped.weight || 0) !== Number(product.weight || 0)) weightChanged += 1;
    if (roundTripped.lastCheckedAt !== product.lastCheckedAt) freshnessChanged += 1;
    if (product.roasterPreservedReason && roundTripped.isStale !== true) staleLost += 1;
  }

  expect(snapshot.products.length === snapshot.count, '스냅샷 개수와 실제 상품 수가 다름');
  expect(legacyFakeComplete === 11, '기준값(무근거 완전 11건)이 바뀜. output/baseline을 다시 뽑을 것', String(legacyFakeComplete));
  expect(contractFakeComplete === 0, '계약을 거쳐도 무근거 완전 표시가 남음', String(contractFakeComplete));
  expect(unidentified === 16, '고유 상품 번호 없는 행이 기준값 16건과 다름', String(unidentified));
  expect(optionCountChanged === 0, '호환층이 옵션 개수를 바꿈', String(optionCountChanged));
  expect(priceChanged === 0, '호환층 왕복에서 가격이 바뀜', String(priceChanged));
  expect(weightChanged === 0, '호환층 왕복에서 용량이 바뀜', String(weightChanged));
  expect(freshnessChanged === 0, '호환층 왕복에서 마지막 확인 표시가 바뀜', String(freshnessChanged));
  expect(staleLost === 0, '호환층 왕복에서 오래된 값 표시가 사라짐', String(staleLost));

  console.log(`[collection-contract:test] 실데이터 ${snapshot.products.length}건 · 무근거 완전 ${legacyFakeComplete}→${contractFakeComplete}건 · 확정 ID 없는 행 ${unidentified}건`);
}

// ── Part 8. 게시 스냅샷이 오래된 값을 최신으로 내보내지 않는지 ──
const publisher = require(path.join(__dirname, '..', 'electron', 'githubPublisher.cjs'));

const freshProduct = {
  id: 'fresh-1', roasterName: '테스트로스터', productName: '신선', productUrl: 'https://smartstore.naver.com/a/products/1',
  price: 20000, weight: 200, lastCheckedAt: '방금 전', checkedMinutesAgo: 0,
};
const preservedProduct = {
  id: 'stale-1', roasterName: '테스트로스터', productName: '보존', productUrl: 'https://smartstore.naver.com/a/products/2',
  price: 19000, originalPrice: 24000, weight: 200, lastCheckedAt: '방금 전', checkedMinutesAgo: 0,
  roasterPreservedReason: '수집 실패로 이전 데이터 유지',
};

const snapshotOut = publisher.buildGithubSnapshot(
  [freshProduct, preservedProduct],
  '2026-09-10T05:00:00.000Z',
  { previousSnapshot: { publishedAt: '2026-09-10T03:00:00.000Z', products: [] } },
);
const publishedStale = snapshotOut.products.find((product) => product.id === 'stale-1');
const publishedFresh = snapshotOut.products.find((product) => product.id === 'fresh-1');

expect(Boolean(publishedStale), '보존 상품이 게시 스냅샷에서 사라짐');
expect(publishedStale?.lastCheckedAt !== '방금 전', '보존 상품이 게시 스냅샷에서 방금 전으로 나갔다', String(publishedStale?.lastCheckedAt));
expect(publishedStale?.checkedMinutesAgo === 120, '보존 상품의 경과 시간이 직전 게시 시각 기준으로 계산되지 않음', String(publishedStale?.checkedMinutesAgo));
expect(publishedStale?.price === 19000 && publishedStale?.originalPrice === 24000, '보존 상품의 가격·정상가가 바뀌었다. 할인 가드가 수집 실패로 오해할 수 있다');
expect(publishedFresh?.lastCheckedAt === '방금 전', '정상 수집 상품의 표시가 바뀌었다', String(publishedFresh?.lastCheckedAt));
expect(snapshotOut.quality.staleProductCount === 1, '오래된 상품 수가 품질 보고에 남지 않음', String(snapshotOut.quality.staleProductCount));

// ── Part 9. 판매처 등록 계층 ──────────────────────────────────
const registry = require(path.join(__dirname, '..', 'electron', 'collection', 'registry.cjs'));
const channels = registry.listChannels();

expect(registry.checkRegistryDrift().length === 0, '등록 설정에 문제가 있음', registry.checkRegistryDrift().join(' / '));
expect(channels.length === 19, '판매처 수가 19곳이 아님', String(channels.length));
expect(new Set(channels.map((channel) => channel.channelId)).size === channels.length, '판매처 ID가 중복임');
expect(channels.every((channel) => ['smartStore', 'cafe24', 'imweb', 'api'].includes(channel.platform)), '알 수 없는 플랫폼이 있음');
expect(channels.every((channel) => channel.driver), '드라이버가 지정되지 않은 판매처가 있음');
expect(registry.getChannelId('fritz') === 'fritz:officialMall', '판매처 ID 생성이 바뀜', registry.getChannelId('fritz'));
expect(registry.findChannelByUrl('https://smartstore.naver.com/rick/products/1')?.sourceId === 'roasterick', '스마트스토어 주소로 판매처를 못 찾음');
expect(registry.findChannelByUrl('https://coffeelibre.kr/product/detail.html?product_no=1')?.sourceId === 'coffeelibre', '공식몰 주소로 판매처를 못 찾음');

// 화면용 로스터리 목록이 실제 수집 설정과 어긋나면 죽은 주소를 사용자에게 보여주게 된다.
const roasterySourceText = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'roasterySources.ts'), 'utf8');
const displayEntries = [...roasterySourceText.matchAll(/id: '([^']+)',\s*roasterName: '([^']+)',\s*channelType: '([^']+)',\s*sourceUrl: '([^']+)'/g)]
  .map((match) => ({ id: match[1], roasterName: match[2], channelType: match[3], sourceUrl: match[4] }));

expect(displayEntries.length === channels.length, '화면 목록과 등록 계층의 판매처 수가 다름', `${displayEntries.length} vs ${channels.length}`);
for (const entry of displayEntries) {
  const channel = registry.getChannelBySourceId(entry.id);
  if (!channel) {
    failures.push(`화면 목록의 ${entry.id}에 해당하는 수집 설정이 없습니다`);
    continue;
  }
  if (channel.channelType !== entry.channelType) failures.push(`${entry.id}의 판매 경로가 다릅니다: ${entry.channelType} vs ${channel.channelType}`);
  const matched = registry.findChannelByUrl(entry.sourceUrl);
  if (matched?.sourceId !== entry.id) {
    failures.push(`${entry.id}의 화면 주소가 실제 수집 주소와 다릅니다: ${entry.sourceUrl}`);
  }
}

// 별도 경로를 쓰는 판매처는 등록 주소와 수집기 상수가 같아야 한다.
const mainSourceText = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
for (const sourceId of ['momos', 'terarosa']) {
  const listUrl = registry.getChannelBySourceId(sourceId).listUrls[0];
  expect(mainSourceText.includes(`'${listUrl}'`), `${sourceId}의 등록 주소가 수집기 상수와 다릅니다`, listUrl);
}

// ── Part 10. 원문 저장소 ──────────────────────────────────────
// 실제 캐시를 건드리지 않도록 임시 폴더를 쓴다.
const os = require('node:os');
const rawDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beanpick-raw-test-'));
process.env.BEANPICK_RAW_OBSERVATION_DIR = rawDir;
const rawStore = require(path.join(__dirname, '..', 'electron', 'collection', 'rawStore.cjs'));

try {
  const html = '<html><body>목록 원문 <b>1</b></body></html>';
  const first = rawStore.putRawObservation({ channelId: 'fritz:officialMall', url: 'https://fritz.co.kr/list?p=1', body: html, fetchedAt: '2026-09-10T05:00:00.000Z', extractorVersion: 'officialMallList@1' });
  expect(first.reused === false, '첫 저장인데 재사용으로 기록됨');
  expect(first.storedBytes > 0, '원문이 저장되지 않음');

  const readBack = rawStore.readRawObservation(first.observationId);
  expect(readBack?.body === html, '저장한 원문과 읽은 원문이 다름');
  expect(readBack?.meta.extractorVersion === 'officialMallList@1', '추출기 버전이 남지 않음');

  // 같은 내용을 다른 주소에서 다시 만나도 본문 파일은 하나만 쌓인다.
  const again = rawStore.putRawObservation({ channelId: 'fritz:officialMall', url: 'https://fritz.co.kr/list?p=1&t=2', body: html, fetchedAt: '2026-09-10T06:00:00.000Z' });
  expect(again.observationId === first.observationId, '같은 내용인데 관측 ID가 달라짐');
  expect(again.reused === true, '같은 내용을 다시 저장했다');
  expect(again.seenCount === 2 && again.urls.length === 2, '재관측 기록이 누적되지 않음', JSON.stringify({ seenCount: again.seenCount, urls: again.urls.length }));
  expect(again.firstSeenAt === '2026-09-10T05:00:00.000Z' && again.lastSeenAt === '2026-09-10T06:00:00.000Z', '첫 관측·마지막 관측 시각이 구분되지 않음');

  rawStore.putRawObservation({ channelId: 'fritz:officialMall', url: 'https://fritz.co.kr/list?p=2', body: '<html>다른 원문</html>', fetchedAt: '2026-09-10T06:00:00.000Z' });
  expect(rawStore.listRawObservations().length === 2, '저장된 원문 개수가 맞지 않음', String(rawStore.listRawObservations().length));

  const pruned = rawStore.pruneRawObservations({ maxAgeDays: 7, now: Date.parse('2026-09-30T00:00:00.000Z') });
  expect(pruned.removed === 2 && pruned.kept === 0, '오래된 원문이 정리되지 않음', JSON.stringify(pruned));
  expect(rawStore.listRawObservations().length === 0, '정리 후에도 원문이 남음');

  const older = rawStore.putRawObservation({ channelId: 'a:b', url: 'u1', body: 'x'.repeat(5000), fetchedAt: '2026-09-10T07:00:00.000Z' });
  const newer = rawStore.putRawObservation({ channelId: 'a:b', url: 'u2', body: 'y'.repeat(5000), fetchedAt: '2026-09-10T08:00:00.000Z' });
  // 한 건만 들어가는 한도를 주면 최근 것이 남아야 한다.
  const capped = rawStore.pruneRawObservations({ maxTotalBytes: newer.storedBytes, now: Date.parse('2026-09-10T09:00:00.000Z') });
  expect(capped.removed === 1 && capped.kept === 1, '총량 한도를 넘겼는데 정리되지 않음', JSON.stringify(capped));
  expect(rawStore.readRawObservation(newer.observationId) !== null, '총량 정리가 최근 원문을 지웠다');
  expect(rawStore.readRawObservation(older.observationId) === null, '총량 정리가 오래된 원문을 남겼다');
} finally {
  fs.rmSync(rawDir, { recursive: true, force: true });
  delete process.env.BEANPICK_RAW_OBSERVATION_DIR;
}

// ── Part 11. 실행 기록 관리자 ─────────────────────────────────
const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beanpick-run-test-'));
process.env.BEANPICK_COLLECTION_RUN_DIR = runDir;
const runManager = require(path.join(__dirname, '..', 'electron', 'collection', 'runManager.cjs'));

(async () => {
  try {
    runManager.resetForTest();

    const good = await runManager.runSource('fritz', async () => ({ ok: true, pages: [1, 2], listCompleteness: COMPLETENESS.COMPLETE }));
    expect(good.ok === true, '수집 결과가 그대로 돌아오지 않음');

    await runManager.runSource('centercoffee', async () => ({ ok: true, pages: [1, 2], listCompleteness: COMPLETENESS.PARTIAL }));
    // ok:false로 돌려주는 판매처도 실패로 기록해야 한다.
    await runManager.runSource('cafedoan', async () => ({ ok: false, error: '차단' }));

    let threw = false;
    try {
      await runManager.runSource('lubia', async () => {
        throw new Error('네트워크 끊김');
      });
    } catch (error) {
      threw = error.message === '네트워크 끊김';
    }
    expect(threw, '실패한 판매처의 오류가 부르던 쪽으로 전달되지 않음');

    const record = runManager.getCurrentRunRecord();
    expect(record.sources.length === 4, '판매처 실행 기록 수가 맞지 않음', String(record.sources.length));
    expect(record.sources.map((entry) => entry.status).join(',') === 'complete,partial,failed,failed', '판매처 상태가 잘못 기록됨', record.sources.map((entry) => entry.status).join(','));
    expect(record.sources.every((entry) => typeof entry.elapsedMs === 'number'), '판매처별 소요시간이 기록되지 않음');
    expect(record.sources[3].error === '네트워크 끊김', '실패 사유가 기록되지 않음');
    expect(record.sources[0].unit === 'pages' && record.sources[0].itemCount === 2, '공식몰 결과 단위가 페이지로 기록되지 않음', JSON.stringify({ unit: record.sources[0].unit, itemCount: record.sources[0].itemCount }));
    const productUnit = await runManager.runSource('toch', async () => ({ ok: true, products: [1, 2, 3], listCompleteness: COMPLETENESS.COMPLETE }));
    expect(productUnit.ok === true && runManager.getCurrentRunRecord().sources[4].unit === 'products', '스마트스토어 결과 단위가 상품으로 기록되지 않음');
    expect(record.sources[0].channelId === 'fritz:officialMall', '기록에 등록 계층의 판매처 ID를 쓰지 않음', record.sources[0].channelId);
    expect(record.succeededSources === 1, '완전 수집 판매처 수가 틀림', String(record.succeededSources));

    // 테라로사 API 실패 폴백은 형식만 성공이다. 완전 수집으로 세면 비교 근거가 오염된다.
    await runManager.runSource('terarosa', async () => ({ ok: true, apiRows: [], html: '<html></html>', warning: 'Terarosa product API could not be read.' }));
    await runManager.runSource('werk', async () => ({ ok: true, pages: [1], warning: '일부 페이지를 못 받았습니다.' }));
    const warned = runManager.getCurrentRunRecord().sources;
    expect(warned[5].status === 'failed', '경고가 붙은 빈 결과를 완전 수집으로 기록했다', warned[5].status);
    expect(warned[6].status === 'partial', '경고가 붙은 결과를 완전 수집으로 기록했다', warned[6].status);

    const saved = runManager.listRuns();
    expect(saved.length === 1 && saved[0].sources.length === 7, '실행 기록이 파일로 남지 않음', JSON.stringify(saved.map((entry) => entry.sources.length)));

    // 실제 기록 파일명과 같은 형식으로 만들어야 정리 순서를 제대로 검사할 수 있다.
    const olderNames = ['run-2026-09-01T00-00-00-000Z.json', 'run-2026-09-02T00-00-00-000Z.json', 'run-2026-09-03T00-00-00-000Z.json'];
    for (const name of olderNames) {
      fs.writeFileSync(path.join(runDir, name), `{"runId":"${name}","sources":[]}\n`, 'utf8');
    }
    const before = fs.readdirSync(runDir).filter((name) => name.endsWith('.json')).sort();
    expect(before.length === 4, '정리 전 기록 수가 맞지 않음', String(before.length));

    expect(runManager.pruneRuns(2) === 2, '오래된 실행 기록이 정리되지 않음');
    const after = fs.readdirSync(runDir).filter((name) => name.endsWith('.json')).sort();
    expect(after.length === 2, '정리 후 남은 실행 기록 수가 맞지 않음', String(after.length));
    // 개수만 맞추면 최근 기록을 지우고도 통과한다. 어떤 파일이 남았는지를 본다.
    expect(after.join(',') === [olderNames[2], before[before.length - 1]].sort().join(','), '정리가 최근 기록을 지웠다', after.join(','));
    expect(after.includes(olderNames[0]) === false && after.includes(olderNames[1]) === false, '가장 오래된 기록이 남아 있음', after.join(','));
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
    delete process.env.BEANPICK_COLLECTION_RUN_DIR;
  }

  if (failures.length > 0) {
    console.error('[collection-contract:test] 실패');
    failures.forEach((failure) => console.error(` - ${failure}`));
    process.exit(1);
  }

  console.log('[collection-contract:test] 통과: 식별자·근거·완전성·실행 기록·등록 계층·원문·호환층 계약 확인 완료');
})().catch((error) => {
  console.error('[collection-contract:test] 실패:', error?.message || error);
  process.exit(1);
});
