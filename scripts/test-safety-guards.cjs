// 안전장치 회귀 테스트: 게시 가드(붕괴/급감/할인)와 생명줄 타임아웃 하한을 지킨다.
// 배경: .wiki/wiki/topics/publish-hang-postmortem.md (2026-06 발행 사흘 정지 사건)
// 이 테스트가 실패하면 테스트를 고치지 말고, 가드/타임아웃을 되돌릴 것.
const fs = require('node:fs');
const path = require('node:path');

const publisher = require(path.join(__dirname, '..', 'electron', 'githubPublisher.cjs'));

const failures = [];

function expect(condition, message, details = '') {
  if (!condition) failures.push(`${message}${details ? `: ${details}` : ''}`);
}

// ── Part 1. 게시 가드 ─────────────────────────────────────────────

expect(typeof publisher.findCollapsedRoaster === 'function', 'findCollapsedRoaster 가드가 사라짐 (githubPublisher.cjs exports 확인)');
expect(typeof publisher.getPublishBlockReason === 'function', 'getPublishBlockReason 가드가 사라짐 (githubPublisher.cjs exports 확인)');

function makeRoasterProducts(roasterName, count) {
  return Array.from({ length: count }, (_, i) => ({
    roasterName,
    productName: `${roasterName} 원두 ${i}`,
    productUrl: `https://example-mall.com/${roasterName}/products/${i}`,
    price: 15000,
  }));
}

function makeBaseline(roasters, perRoaster) {
  const products = [];
  for (let r = 1; r <= roasters; r += 1) {
    products.push(...makeRoasterProducts(`로스터리${r}`, perRoaster));
  }
  return products;
}

const baseline = makeBaseline(19, 20); // 실서비스와 비슷한 규모: 19곳 × 20개 = 380개

// 1) 동일 데이터 재게시는 막지 않는다.
expect(
  publisher.getPublishBlockReason({ products: baseline }, { products: baseline }) === '',
  '정상 데이터인데 게시가 차단됨',
);

// 2) 단일 로스터리 붕괴(20→3)를 잡는다. (카페도안 사태 유형)
const collapsedNext = baseline
  .filter((p) => p.roasterName !== '로스터리1')
  .concat(makeRoasterProducts('로스터리1', 3));
const collapsed = publisher.findCollapsedRoaster(baseline, collapsedNext);
expect(collapsed && collapsed.name === '로스터리1', '단일 로스터리 붕괴를 못 잡음', JSON.stringify(collapsed));
const collapseReason = publisher.getPublishBlockReason({ products: baseline }, { products: collapsedNext });
expect(collapseReason.includes('로스터리1'), '붕괴 차단 사유에 로스터리명이 없음', collapseReason);

// 3) 전체 상품 수 반토막을 잡는다.
const halvedReason = publisher.getPublishBlockReason({ products: baseline }, { products: baseline.slice(0, 150) });
expect(halvedReason.includes('상품 수'), '전체 급감을 못 잡음', halvedReason);

// 4) 로스터리 수 반토막(총 상품 수는 유지)을 잡는다.
const fewerRoasters = makeBaseline(9, 45); // 9곳 × 45개 = 405개 (총수는 안 줄었지만 로스터리는 19→9)
const roasterReason = publisher.getPublishBlockReason({ products: baseline }, { products: fewerRoasters });
expect(roasterReason.includes('로스터리 수'), '로스터리 수 급감을 못 잡음', roasterReason);

// 5) 소규모 데이터(이전 20개 미만)에는 급감 가드를 적용하지 않는다.
const tiny = makeRoasterProducts('신규로스터리', 10);
expect(
  publisher.getPublishBlockReason({ products: tiny }, { products: tiny.slice(0, 3) }) === '',
  '소규모 데이터에 급감 가드가 잘못 발동됨',
);

// 6) 스마트스토어 할인정보 급감(정상가 소실)을 잡는다.
function makeDiscountProducts(count, withDiscount) {
  return Array.from({ length: count }, (_, i) => ({
    roasterName: '스토어A',
    productName: `할인 원두 ${i}`,
    productUrl: `https://smartstore.naver.com/storea/products/${1000 + i}`,
    price: 18000,
    originalPrice: withDiscount ? 25000 : 0,
  }));
}
const discountReason = publisher.getPublishBlockReason(
  { products: makeDiscountProducts(25, true) },
  { products: makeDiscountProducts(25, false) },
);
expect(discountReason.includes('할인'), '스마트스토어 할인정보 급감을 못 잡음', discountReason);

// 7) 진짜 할인 종료(가격이 정상가로 복귀)는 막지 않는다. (2026-07 필아웃커피 월초 할인종료 오탐 사건)
function makeEndedDiscountProducts(count) {
  return Array.from({ length: count }, (_, i) => ({
    roasterName: '스토어A',
    productName: `할인 원두 ${i}`,
    productUrl: `https://smartstore.naver.com/storea/products/${1000 + i}`,
    price: 25000, // 할인가(18000)가 아니라 이전 정상가로 복귀
    originalPrice: 0,
  }));
}
expect(
  publisher.getPublishBlockReason(
    { products: makeDiscountProducts(25, true) },
    { products: makeEndedDiscountProducts(25) },
  ) === '',
  '정상가로 복귀한 진짜 할인 종료를 수집 실패로 오판해 차단함',
);

// 8) 할인 종료와 수집 실패가 섞이면, "설명 안 되는" 감소만으로 판단한다.
function makeMixedDiscountProducts(count, endedCount) {
  return Array.from({ length: count }, (_, i) => ({
    roasterName: '스토어A',
    productName: `할인 원두 ${i}`,
    productUrl: `https://smartstore.naver.com/storea/products/${1000 + i}`,
    // 앞쪽 endedCount개는 정상가 복귀(설명됨), 나머지는 할인가 그대로에 정상가만 소실(설명 안 됨)
    price: i < endedCount ? 25000 : 18000,
    originalPrice: 0,
  }));
}
// 25개 중 20개는 정상 종료(설명됨), 5개만 수집 실패 → 임계치(13개) 밑돌아 통과해야 함
expect(
  publisher.getPublishBlockReason(
    { products: makeDiscountProducts(25, true) },
    { products: makeMixedDiscountProducts(25, 20) },
  ) === '',
  '대부분 정상 종료인데 소수 수집 실패 때문에 잘못 차단함',
);
// 25개 중 5개만 정상 종료, 20개는 수집 실패 → 임계치 넘어 차단해야 함
const mixedBadReason = publisher.getPublishBlockReason(
  { products: makeDiscountProducts(25, true) },
  { products: makeMixedDiscountProducts(25, 5) },
);
expect(mixedBadReason.includes('원인 불명'), '대부분 수집 실패인데 일부 정상 종료 때문에 차단을 놓침', mixedBadReason);

// ── Part 2. 생명줄 타임아웃 하한 ──────────────────────────────────
// 사건 교훈: "정상 작업의 실측 소요시간을 재지 않고 타임아웃을 줄이지 말 것".
// 아래 값을 줄이려면 실측 근거와 사용자 승인이 필요하다. 이 테스트를 고쳐 통과시키지 말 것.

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
const naverSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'naverShoppingSearch.cjs'), 'utf8');

function extractNumber(source, regex, label) {
  const match = source.match(regex);
  if (!match) {
    failures.push(`${label}: 코드에서 찾지 못함 — 구조를 바꿨다면 이 테스트도 함께 갱신할 것`);
    return null;
  }
  return Number(match[1]);
}

function expectFloor(value, floor, label) {
  if (value === null) return;
  expect(value >= floor, `${label}이(가) 하한 ${floor}ms 밑으로 줄어듦`, `${value}ms`);
}

// 스마트스토어 카테고리 페이지 로드 (홈 회선에서 5초로는 카페도안이 무너진다)
expectFloor(
  extractNumber(mainSource, /SMARTSTORE_PAGE_LOAD_TIMEOUT_MS\s*=\s*(\d+)/, '스마트스토어 페이지 로드 타임아웃'),
  25000,
  '스마트스토어 페이지 로드 타임아웃',
);

// 공식몰 상세보강 예산 (멈춰도 상품 목록은 반환하는 graceful degradation의 기준)
expectFloor(
  extractNumber(mainSource, /OFFICIAL_ENRICH_BUDGET_MS\s*=\s*(\d+)/, '공식몰 상세보강 예산'),
  90000,
  '공식몰 상세보강 예산',
);

// fetchHtmlPage 하드캡 (CI에서 abort가 안 먹혀도 무조건 빠져나오는 최후 방어선)
expectFloor(
  extractNumber(mainSource, /withTimeout\(fetchHtmlPageRaw\([^)]*\),\s*(\d+)/, 'fetchHtmlPage 하드캡'),
  15000,
  'fetchHtmlPage 하드캡',
);

// Gemini 비전 OCR (정상 소요 ~20초. 5초로 줄이면 컵노트가 잘린다)
const geminiCallIdx = naverSource.indexOf('${GEMINI_API_URL}?key=');
if (geminiCallIdx === -1) {
  failures.push('Gemini OCR 호출부를 찾지 못함 — 구조를 바꿨다면 이 테스트도 함께 갱신할 것');
} else {
  const before = naverSource.slice(Math.max(0, geminiCallIdx - 600), geminiCallIdx);
  const timerMatches = [...before.matchAll(/controller\.abort\(\),\s*(\d+)\)/g)];
  const ocrTimeout = timerMatches.length ? Number(timerMatches[timerMatches.length - 1][1]) : null;
  if (ocrTimeout === null) {
    failures.push('Gemini OCR 타임아웃 타이머를 찾지 못함 — 구조를 바꿨다면 이 테스트도 함께 갱신할 것');
  } else {
    expectFloor(ocrTimeout, 20000, 'Gemini 비전 OCR 타임아웃');
  }
}

// ── 결과 ─────────────────────────────────────────────────────────

if (failures.length > 0) {
  console.error('[safety-guards:test] 실패');
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log('[safety-guards:test] 통과: 게시 가드(붕괴/급감/할인) 작동 + 타임아웃 하한 유지 확인 완료');
