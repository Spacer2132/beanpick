const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { createCollectionEngine } = require(path.join(ROOT, 'electron', 'collection', 'engine.cjs'));
const { findChannelByUrl } = require(path.join(ROOT, 'electron', 'collection', 'registry.cjs'));

const snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'products.json'), 'utf8'));
const engine = createCollectionEngine({});
const allowedChanges = new Set(['priceOptionsComplete', 'priceOptionsStatus']);
const summary = { products: snapshot.products.length, attributed: 0, sources: {}, identical: 0, statusOnly: 0, unexpected: [] };

for (const product of snapshot.products) {
  const channel = findChannelByUrl(product.productUrl);
  if (!channel) {
    summary.unexpected.push({ id: product.id, differences: ['unattributed'] });
    continue;
  }

  summary.attributed += 1;
  summary.sources[channel.sourceId] = (summary.sources[channel.sourceId] || 0) + 1;
  const migrated = engine.promoteProducts(channel.sourceId, [product])[0];
  const keys = new Set([...Object.keys(product), ...Object.keys(migrated)]);
  const differences = [...keys].filter((key) => JSON.stringify(product[key]) !== JSON.stringify(migrated[key]));
  const unexpected = differences.filter((key) => !allowedChanges.has(key));

  if (unexpected.length > 0) summary.unexpected.push({ id: product.id, differences: unexpected });
  else if (differences.length > 0) summary.statusOnly += 1;
  else summary.identical += 1;
}

console.log(`[compare:migration] 상품 ${summary.products} · 귀속 ${summary.attributed} · 판매처 ${Object.keys(summary.sources).length}`);
console.log(`[compare:migration] 완전 동일 ${summary.identical} · 옵션 상태만 변경 ${summary.statusOnly} · 예상 밖 차이 ${summary.unexpected.length}`);
if (summary.unexpected.length > 0) {
  console.error(JSON.stringify(summary.unexpected.slice(0, 10), null, 2));
  process.exit(1);
}
