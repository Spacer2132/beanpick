const dataQuality = require('../electron/dataQuality.cjs');
const githubPublisher = require('../electron/githubPublisher.cjs');

const failures = [];

function expect(condition, message, details = '') {
  if (!condition) failures.push(`${message}${details ? `: ${details}` : ''}`);
}

// 정상 상품(200g, 22,000원)은 그대로 통과해야 한다
const normal = { id: 'normal', roasterName: '테스트', productName: '에티오피아 예가체프', price: 22000, weight: 200 };
const normalResult = dataQuality.validateProduct(normal);
expect(!normalResult.excluded, '정상 상품은 제외되면 안 됩니다', JSON.stringify(normalResult));
expect(!normalResult.flagged, '정상 상품은 확인 대상으로 표시되면 안 됩니다', JSON.stringify(normalResult));

// 실제 발견된 오류: 22g, 10g처럼 비정상적으로 작은 용량은 제외되어야 한다
const roasterlic = { id: 'roasterlic', roasterName: '로스터릭', productName: 'Limited edition x 2ea', price: 12000, weight: 22 };
expect(dataQuality.validateProduct(roasterlic).excluded, '22g처럼 비정상적으로 작은 용량은 제외되어야 합니다');

const filloutAuction = { id: 'fillout-auction', roasterName: '필아웃커피', productName: '에티오피아 알로 옥션랏', price: 10000, weight: 10 };
expect(dataQuality.validateProduct(filloutAuction).excluded, '10g처럼 비정상적으로 작은 용량은 제외되어야 합니다');

// 가격이 4원처럼 비정상적으로 낮으면 제외되어야 한다
const garbagePrice = { id: 'garbage', roasterName: '테스트', productName: '가격 오류', price: 4, weight: 200 };
expect(dataQuality.validateProduct(garbagePrice).excluded, '가격이 비정상적으로 낮으면(4원) 제외되어야 합니다');

// 용량/가격은 범위 안이지만 100g당 가격이 극단적으로 높으면 제외하지 말고 확인 대상으로만 표시한다
const extremePer100 = { id: 'extreme', roasterName: '카페도안', productName: 'ROSE COFFEE Panama Longboard', price: 137000, weight: 35 };
const extremeResult = dataQuality.validateProduct(extremePer100);
expect(!extremeResult.excluded, '100g당 가격이 높아도 용량/가격 자체가 정상 범위면 제외하면 안 됩니다', JSON.stringify(extremeResult));
expect(extremeResult.flagged, '100g당 가격이 비정상적으로 높으면 확인 대상으로 표시해야 합니다', JSON.stringify(extremeResult));
expect(extremeResult.per100 === 391429, '100g당 가격을 올바르게 계산해야 합니다', String(extremeResult.per100));

// 무게 오류: 제목에 "1kg"이 있는데 저장 용량이 200g이면 제외되어야 한다 (실제 버티고/나이트호크 버그)
const bulk1kgBroken = { id: 'bulk-broken', roasterName: '커피리브레', productName: '[대용량 원두] 버티고 1kg', price: 45000, weight: 200 };
const bulkBrokenResult = dataQuality.validateProduct(bulk1kgBroken);
expect(bulkBrokenResult.excluded, '제목이 1kg인데 저장이 200g이면 제외되어야 합니다', JSON.stringify(bulkBrokenResult));

// 제목 "1kg"과 저장 1000g이 일치하면 통과해야 한다 (정상 상태)
const bulk1kgOk = { id: 'bulk-ok', roasterName: '커피리브레', productName: '[대용량 원두] 버티고 1kg', price: 45000, weight: 1000 };
expect(!dataQuality.validateProduct(bulk1kgOk).excluded, '제목과 저장 용량이 일치하면(1kg/1000g) 통과해야 합니다', JSON.stringify(dataQuality.validateProduct(bulk1kgOk)));

// 제목에 여러 용량(200g/500g/1kg)이 있고 저장이 그 중 하나면 통과해야 한다
const multiOption = { id: 'multi', roasterName: '테스트', productName: '에티오피아 200g/500g/1kg 선택', price: 22000, weight: 500 };
expect(!dataQuality.validateProduct(multiOption).excluded, '제목 용량 중 하나와 일치하면 통과해야 합니다', JSON.stringify(dataQuality.validateProduct(multiOption)));

// 제목에 "대용량"만 있고 숫자가 없는데 저장이 200g이면 제외되어야 한다
const bulkNoNumber = { id: 'bulk-nonum', roasterName: '테스트', productName: '대용량 블렌드 원두', price: 30000, weight: 200 };
expect(dataQuality.validateProduct(bulkNoNumber).excluded, '대용량인데 저장 용량이 너무 작으면 제외되어야 합니다', JSON.stringify(dataQuality.validateProduct(bulkNoNumber)));

// 제목 속 "Guji", "grade" 같은 g 단어는 용량으로 읽으면 안 된다 (오탐 방지)
expect(dataQuality.extractTitleWeights('에티오피아 Guji G1 워시드').length === 0, '단어에 붙은 g은 용량으로 읽으면 안 됩니다', JSON.stringify(dataQuality.extractTitleWeights('에티오피아 Guji G1 워시드')));
expect(!dataQuality.validateProduct({ id: 'guji', roasterName: '테스트', productName: '에티오피아 Guji 워시드', price: 22000, weight: 200 }).excluded, '제목에 용량 표기가 없으면 200g 저장은 정상입니다');

// validateProducts는 정상/제외/확인필요 상품을 나눠야 한다
const grouped = dataQuality.validateProducts([normal, roasterlic, filloutAuction, garbagePrice, extremePer100]);
expect(grouped.clean.length === 2, '정상 상품만 clean에 남아야 합니다', String(grouped.clean.length));
expect(grouped.excluded.length === 3, '용량/가격 오류 상품은 excluded에 들어가야 합니다', String(grouped.excluded.length));
expect(grouped.flagged.length === 1, '100g당 가격이 비정상인 상품은 flagged에 들어가야 합니다', String(grouped.flagged.length));
expect(grouped.report.total === 5, 'report.total은 전체 개수여야 합니다', String(grouped.report.total));
expect(grouped.report.cleanCount === 2 && grouped.report.excludedCount === 3 && grouped.report.flaggedCount === 1, 'report 요약 수치가 맞아야 합니다', JSON.stringify(grouped.report));

// buildGithubSnapshot은 게시 전에 이상 상품을 걸러내야 한다
const snapshot = githubPublisher.buildGithubSnapshot([normal, roasterlic, garbagePrice], '2026-06-15T00:00:00.000Z');
expect(snapshot.products.length === 1, '게시 데이터에는 정상 상품만 남아야 합니다', String(snapshot.products.length));
expect(snapshot.count === 1, 'count는 게시되는 상품 수와 같아야 합니다', String(snapshot.count));
expect(snapshot.quality.excludedCount === 2, '제외된 상품 수가 quality 정보에 남아야 합니다', String(snapshot.quality.excludedCount));
expect(snapshot.quality.excluded.some((item) => item.id === 'roasterlic'), '제외 목록에 어떤 상품인지 알 수 있는 정보가 있어야 합니다', JSON.stringify(snapshot.quality.excluded));

const previousSmartStoreSnapshot = {
  products: [
    {
      id: 'identity-old',
      roasterName: '아이덴티티 커피랩',
      productName: '미드센추리 블렌드',
      price: 48000,
      originalPrice: 66000,
      weight: 1000,
      productUrl: 'https://smartstore.naver.com/identity_coffeelab/products/6684189550',
      storeUrl: 'https://smartstore.naver.com/identity_coffeelab/category/0b4e173f072040e4b682a7ca248ac875?cp=1',
    },
    {
      id: 'fillout-old',
      roasterName: '필아웃커피',
      productName: '블렌드 원두',
      price: 18000,
      weight: 200,
      productUrl: 'https://smartstore.naver.com/filloutcoffee/products/5310178180',
      storeUrl: 'https://smartstore.naver.com/filloutcoffee/category/00f832f1c2da4600b90ddda5d6ae6853?cp=1',
      priceOptions: [
        {
          id: '200g-18000',
          price: 18000,
          originalPrice: 20000,
          weight: 200,
          productUrl: 'https://smartstore.naver.com/filloutcoffee/products/5310178180',
        },
      ],
    },
  ],
};
const preservedSnapshot = githubPublisher.buildGithubSnapshot([
  {
    id: 'identity-new',
    roasterName: '아이덴티티 커피랩',
    productName: '미드센추리 블렌드',
    price: 48000,
    weight: 1000,
    productUrl: 'https://smartstore.naver.com/main/products/6684189550',
    storeUrl: 'https://smartstore.naver.com/identity_coffeelab/category/0b4e173f072040e4b682a7ca248ac875?cp=1',
  },
  {
    id: 'fillout-new',
    roasterName: '필아웃커피',
    productName: '블렌드 원두',
    price: 18000,
    weight: 200,
    productUrl: 'https://smartstore.naver.com/main/products/5310178180',
    storeUrl: 'https://smartstore.naver.com/filloutcoffee/category/00f832f1c2da4600b90ddda5d6ae6853?cp=1',
    priceOptions: [
      {
        id: '200g-18000',
        price: 18000,
        weight: 200,
        productUrl: 'https://smartstore.naver.com/main/products/5310178180',
      },
    ],
  },
  {
    id: 'doan-new',
    roasterName: '카페도안',
    productName: '테스트 원두',
    price: 22000,
    weight: 200,
    productUrl: 'https://smartstore.naver.com/main/products/7576023321',
    storeUrl: 'https://smartstore.naver.com/doanselectshop/category/6758314878ef4d478904279d7065dfba?cp=1',
  },
  {
    id: 'coffeejg-new',
    roasterName: '커피정경 로스터리',
    productName: '디카페인 에티오피아',
    price: 18000,
    weight: 200,
    productUrl: 'https://smartstore.naver.com/main/products/13181681419',
    storeUrl: '',
  },
], '2026-06-15T00:00:00.000Z', { previousSnapshot: previousSmartStoreSnapshot });
expect(preservedSnapshot.products[0].originalPrice === 66000, '이전 게시본의 스마트스토어 정상가는 같은 상품에 보존되어야 합니다', JSON.stringify(preservedSnapshot.products[0]));
expect(preservedSnapshot.products[0].productUrl === 'https://smartstore.naver.com/identity_coffeelab/products/6684189550', '이전 게시본의 직접 스마트스토어 상품 링크도 보존되어야 합니다', JSON.stringify(preservedSnapshot.products[0]));
expect(preservedSnapshot.products[1].priceOptions[0].originalPrice === 20000, '용량별 가격 옵션의 정상가도 보존되어야 합니다', JSON.stringify(preservedSnapshot.products[1].priceOptions));
expect(preservedSnapshot.products[1].priceOptions[0].productUrl === 'https://smartstore.naver.com/filloutcoffee/products/5310178180', '용량별 가격 옵션의 직접 스마트스토어 링크도 보존되어야 합니다', JSON.stringify(preservedSnapshot.products[1].priceOptions));
expect(preservedSnapshot.products[2].productUrl === 'https://smartstore.naver.com/doanselectshop/products/7576023321', '스토어 주소를 알면 정상가가 없어도 main 스마트스토어 링크를 직접 링크로 바꿔야 합니다', JSON.stringify(preservedSnapshot.products[2]));
expect(preservedSnapshot.products[3].productUrl === 'https://smartstore.naver.com/coffeejg/products/13181681419', '커피정경처럼 등록된 스토어는 storeUrl이 비어 있어도 직접 링크로 바꿔야 합니다', JSON.stringify(preservedSnapshot.products[3]));
// 옵션이 있는 상품은 상단을 건너뛰고 옵션별로만 복원하므로, 같은 정상가가 상단+옵션으로 이중 집계되지 않는다.
expect(preservedSnapshot.quality.preservedDiscountCount === 2, '보존된 정상가 수가 quality 정보에 남아야 합니다(상단 중복 집계 없이)', JSON.stringify(preservedSnapshot.quality));

// 뿌리 수정 재현: 이전 1kg 정상가(51000)가 현재 200g 판매가(상단·200g 옵션)에 붙으면 안 된다 (칠린 블렌드 유형)
const previousMultiWeight = {
  products: [{
    id: 'chilling-old',
    roasterName: '아이덴티티커피랩',
    productName: '칠린 블렌드',
    price: 39000,
    originalPrice: 51000,
    weight: 1000,
    productUrl: 'https://smartstore.naver.com/identity_coffeelab/products/1234567890',
    storeUrl: 'https://smartstore.naver.com/identity_coffeelab/category/x?cp=1',
  }],
};
const cleanSnapshot = githubPublisher.buildGithubSnapshot([{
  id: 'chilling-new',
  roasterName: '아이덴티티커피랩',
  productName: '칠린 블렌드',
  price: 11000, // 200g 판매가가 상단으로 올라온 묶음 카드
  weight: 1000, // 대표 용량은 1kg (200g 가격 + 1kg 용량이 섞임)
  productUrl: 'https://smartstore.naver.com/identity_coffeelab/products/1234567890',
  storeUrl: 'https://smartstore.naver.com/identity_coffeelab/category/x?cp=1',
  priceOptions: [
    { id: '200g', price: 11000, weight: 200, productUrl: '' },
    { id: '1kg', price: 39000, originalPrice: 51000, weight: 1000, productUrl: 'https://smartstore.naver.com/identity_coffeelab/products/1234567890' },
  ],
}], '2026-06-15T00:00:00.000Z', { previousSnapshot: previousMultiWeight });
const chilling = cleanSnapshot.products[0];
expect(chilling.originalPrice === undefined, '용량 옵션이 있으면 상단에 이전 1kg 정상가(51000)를 붙이면 안 됩니다', String(chilling.originalPrice));
expect((chilling.priceOptions.find((option) => option.weight === 200)?.originalPrice || 0) === 0, '200g 옵션에도 1kg 정상가가 붙으면 안 됩니다', JSON.stringify(chilling.priceOptions.find((option) => option.weight === 200)));
expect(chilling.priceOptions.find((option) => option.weight === 1000)?.originalPrice === 51000, '1kg 옵션의 정상가(51000)는 그대로 보존되어야 합니다', JSON.stringify(chilling.priceOptions.find((option) => option.weight === 1000)));

function encodeSnapshot(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function manySmartStoreProducts(count, { offset = 0, withOriginal = false } = {}) {
  return Array.from({ length: count }, (_, index) => {
    const productNo = 7000000000 + offset + index;
    return {
      id: `smart-${offset}-${index}`,
      roasterName: '테스트 스마트스토어',
      productName: `테스트 원두 ${index}`,
      price: 10000,
      originalPrice: withOriginal ? 20000 : undefined,
      weight: 200,
      productUrl: `https://smartstore.naver.com/teststore/products/${productNo}`,
      storeUrl: 'https://smartstore.naver.com/teststore/category/beans?cp=1',
    };
  });
}

// 부분 수집 실패 가드 테스트용: 스마트스토어가 아닌 평범한 상품을 여러 로스터리로 나눠 만든다.
function manyPlainProducts(count, { roasters = 1, namePrefix = '원두' } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${namePrefix}-${index}`,
    roasterName: `로스터리${index % roasters}`,
    productName: `${namePrefix} ${index}`,
    price: 22000,
    weight: 200,
    productUrl: `https://example.com/product/${index}`,
  }));
}

async function runPublisherTests() {
  const publishCalls = [];
  const previousSnapshotForPublish = { products: previousSmartStoreSnapshot.products };
  const publishResult = await githubPublisher.publishProductsToGitHub({
    products: [
      {
        id: 'identity-new',
        roasterName: '아이덴티티 커피랩',
        productName: '미드센추리 블렌드',
        price: 48000,
        weight: 1000,
        productUrl: 'https://smartstore.naver.com/main/products/6684189550',
        storeUrl: 'https://smartstore.naver.com/identity_coffeelab/category/0b4e173f072040e4b682a7ca248ac875?cp=1',
      },
    ],
    token: 'test-token',
    fetchImpl: async (url, options = {}) => {
      publishCalls.push({ url, options });
      if (!options.method) {
        return { ok: true, json: async () => ({ sha: 'old-sha', content: encodeSnapshot(previousSnapshotForPublish) }) };
      }
      const body = JSON.parse(options.body);
      const postedSnapshot = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
      expect(postedSnapshot.products[0].originalPrice === 66000, 'GitHub에 올리는 JSON에도 보존된 정상가가 들어가야 합니다', JSON.stringify(postedSnapshot.products[0]));
      return { ok: true, json: async () => ({ content: { path: 'docs/products.json' }, commit: { sha: 'new-sha' } }) };
    },
  });
  expect(publishResult.ok === true, '보존 가능한 게시 요청은 성공해야 합니다', JSON.stringify(publishResult));
  expect(publishCalls.some((call) => call.options?.method === 'PUT'), '정상 게시에서는 GitHub PUT을 호출해야 합니다');

  const blockedCalls = [];
  const previousGoodSnapshot = { products: manySmartStoreProducts(30, { withOriginal: true }) };
  const currentBadProducts = manySmartStoreProducts(30, { offset: 1000, withOriginal: false })
    .map((product, index) => ({ ...product, productName: `새로 잡힌 원두 ${index}` }));
  const blockedResult = await githubPublisher.publishProductsToGitHub({
    products: currentBadProducts,
    token: 'test-token',
    fetchImpl: async (url, options = {}) => {
      blockedCalls.push({ url, options });
      if (!options.method) {
        return { ok: true, json: async () => ({ sha: 'old-sha', content: encodeSnapshot(previousGoodSnapshot) }) };
      }
      return { ok: true, json: async () => ({ content: { path: 'docs/products.json' }, commit: { sha: 'bad-sha' } }) };
    },
  });
  expect(blockedResult.ok === false, '스마트스토어 정상가 정보가 급감하면 게시를 막아야 합니다', JSON.stringify(blockedResult));
  expect(/스마트스토어/.test(blockedResult.error || ''), '게시 차단 메시지는 스마트스토어 품질 문제를 설명해야 합니다', blockedResult.error);
  expect(!blockedCalls.some((call) => call.options?.method === 'PUT'), '차단된 게시에서는 GitHub PUT을 호출하면 안 됩니다');

  // 부분 수집 실패 가드: 이전 40개(로스터리 4곳) 대비 전체 상품 수가 절반 이하로 줄면 막아야 한다
  const previousFullSnapshot = { products: manyPlainProducts(40, { roasters: 4 }) };
  const getPreviousFull = async (url, options = {}) => {
    if (!options.method) return { ok: true, json: async () => ({ sha: 'old-sha', content: encodeSnapshot(previousFullSnapshot) }) };
    return { ok: true, json: async () => ({ content: { path: 'docs/products.json' }, commit: { sha: 'new-sha' } }) };
  };

  const countDropCalls = [];
  const countDropResult = await githubPublisher.publishProductsToGitHub({
    products: manyPlainProducts(15, { roasters: 1, namePrefix: '남은원두' }),
    token: 'test-token',
    fetchImpl: async (url, options = {}) => { countDropCalls.push({ url, options }); return getPreviousFull(url, options); },
  });
  expect(countDropResult.ok === false, '상품 수가 절반 이하로 줄면 게시를 막아야 합니다', JSON.stringify(countDropResult));
  expect(/상품 수/.test(countDropResult.error || ''), '차단 메시지는 상품 수 급감을 설명해야 합니다', countDropResult.error);
  expect(!countDropCalls.some((call) => call.options?.method === 'PUT'), '상품 수 급감으로 차단되면 PUT을 호출하면 안 됩니다');

  // 전체 수는 절반을 넘어도(40→24) 로스터리 수가 4곳→1곳으로 줄면 막아야 한다
  const roasterDropResult = await githubPublisher.publishProductsToGitHub({
    products: manyPlainProducts(24, { roasters: 1, namePrefix: '한곳원두' }),
    token: 'test-token',
    fetchImpl: getPreviousFull,
  });
  expect(roasterDropResult.ok === false, '로스터리 수가 절반 이하로 줄면 게시를 막아야 합니다', JSON.stringify(roasterDropResult));
  expect(/로스터리 수/.test(roasterDropResult.error || ''), '차단 메시지는 로스터리 수 급감을 설명해야 합니다', roasterDropResult.error);

  // 오탐 방지: 40→38개, 로스터리 4곳 유지처럼 정상 소폭 변동은 막으면 안 된다
  const healthyCalls = [];
  const healthyResult = await githubPublisher.publishProductsToGitHub({
    products: manyPlainProducts(38, { roasters: 4, namePrefix: '정상원두' }),
    token: 'test-token',
    fetchImpl: async (url, options = {}) => { healthyCalls.push({ url, options }); return getPreviousFull(url, options); },
  });
  expect(healthyResult.ok === true, '상품/로스터리 수가 정상 범위면 게시를 막으면 안 됩니다', JSON.stringify(healthyResult));
  expect(healthyCalls.some((call) => call.options?.method === 'PUT'), '정상 업데이트는 GitHub PUT을 호출해야 합니다');

  // 게시 충돌(sha 불일치)이 나면 최신 sha를 다시 읽어 재시도해야 한다
  let putAttempts = 0;
  let getCount = 0;
  const retryResult = await githubPublisher.publishProductsToGitHub({
    products: manyPlainProducts(40, { roasters: 4, namePrefix: '재시도원두' }),
    token: 'test-token',
    fetchImpl: async (url, options = {}) => {
      if (!options.method) {
        getCount += 1;
        return { ok: true, json: async () => ({ sha: getCount === 1 ? 'stale-sha' : 'fresh-sha', content: encodeSnapshot(previousFullSnapshot) }) };
      }
      putAttempts += 1;
      if (putAttempts === 1) {
        return { ok: false, status: 409, text: async () => 'sha does not match' };
      }
      const body = JSON.parse(options.body);
      expect(body.sha === 'fresh-sha', '재시도 PUT은 다시 읽은 최신 sha를 써야 합니다', body.sha);
      return { ok: true, json: async () => ({ content: { path: 'docs/products.json' }, commit: { sha: 'done' } }) };
    },
  });
  expect(retryResult.ok === true, 'sha 충돌 후 재시도하면 게시에 성공해야 합니다', JSON.stringify(retryResult));
  expect(putAttempts === 2, '첫 PUT이 충돌하면 한 번 더 시도해야 합니다', String(putAttempts));
  expect(getCount === 2, '충돌 시 최신 sha를 위해 파일을 다시 읽어야 합니다', String(getCount));

  // 잘못된 토큰(401)처럼 재시도해도 소용없는 오류는 곧바로 실패해야 한다 (무한 재시도 방지)
  let badTokenPuts = 0;
  const badTokenResult = await githubPublisher.publishProductsToGitHub({
    products: manyPlainProducts(40, { roasters: 4, namePrefix: '토큰오류원두' }),
    token: 'test-token',
    fetchImpl: async (url, options = {}) => {
      if (!options.method) return { ok: true, json: async () => ({ sha: 'old-sha', content: encodeSnapshot(previousFullSnapshot) }) };
      badTokenPuts += 1;
      return { ok: false, status: 401, text: async () => 'Bad credentials' };
    },
  });
  expect(badTokenResult.ok === false, '재시도 불가 오류(401)는 실패로 끝나야 합니다', JSON.stringify(badTokenResult));
  expect(badTokenPuts === 1, '재시도 불가 오류는 한 번만 시도해야 합니다', String(badTokenPuts));
}

runPublisherTests().then(() => {
  if (failures.length > 0) {
    console.error('데이터 품질 검증 실패:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('데이터 품질 검증 통과');
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
