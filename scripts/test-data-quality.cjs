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

if (failures.length > 0) {
  console.error('데이터 품질 검증 실패:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('데이터 품질 검증 통과');
