const fs = require('node:fs');
const esbuild = require('esbuild');

function loadJsModule(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const output = esbuild.transformSync(code, { loader: 'js', format: 'cjs', target: 'es2020' }).code;
  const module = { exports: {} };

  new Function('exports', 'module', 'require', output)(module.exports, module, () => ({}));
  return module.exports;
}

const history = loadJsModule('src/services/productHistory.js');
const failures = [];

function expect(condition, message, details = '') {
  if (!condition) failures.push(`${message}${details ? `: ${details}` : ''}`);
}

const productA = { id: 'momos-panama-geisha', price: 64000, isSoldOut: false };
const productB = { id: 'libre-colombia-sidra', price: 32000, isSoldOut: false };

// 1) 첫 기록: 상품마다 점이 하나씩 생긴다.
let stored = history.appendHistoryPoints({}, [productA, productB], 1000);
expect(stored[productA.id].length === 1, '첫 기록 후 productA 점 개수는 1이어야 함', String(stored[productA.id].length));
expect(stored[productB.id].length === 1, '첫 기록 후 productB 점 개수는 1이어야 함', String(stored[productB.id].length));
expect(stored[productA.id][0].price === 64000, '기록된 가격이 일치해야 함');

// 2) 변화 없는 재기록: 점이 늘어나지 않는다.
stored = history.appendHistoryPoints(stored, [productA, productB], 2000);
expect(stored[productA.id].length === 1, '같은 가격 재기록 시 점이 늘어나면 안 됨', String(stored[productA.id].length));

// 3) 가격 변경: 점이 추가되고 delta가 계산된다.
stored = history.appendHistoryPoints(stored, [{ ...productA, price: 58000 }], 3000);
expect(stored[productA.id].length === 2, '가격 변경 시 점이 추가되어야 함', String(stored[productA.id].length));
expect(history.getPriceDelta(stored, productA.id) === -6000, '가격 인하 delta는 -6000이어야 함', String(history.getPriceDelta(stored, productA.id)));
expect(history.getPriceDelta(stored, productB.id) === 0, '변화 없는 상품 delta는 0이어야 함');

// 4) 품절 전환도 변화로 기록된다.
stored = history.appendHistoryPoints(stored, [{ ...productB, isSoldOut: true }], 4000);
expect(stored[productB.id].length === 2, '품절 전환 시 점이 추가되어야 함', String(stored[productB.id].length));
expect(stored[productB.id][1].soldOut === true, '품절 상태가 기록되어야 함');

// 5) 상품당 점 개수 상한(60)이 지켜진다.
let capped = {};
for (let i = 0; i < 70; i += 1) {
  capped = history.appendHistoryPoints(capped, [{ id: 'cap-test', price: 1000 + i, isSoldOut: false }], i);
}
expect(capped['cap-test'].length === 60, '상품당 점 개수는 60을 넘으면 안 됨', String(capped['cap-test'].length));
expect(capped['cap-test'][59].price === 1069, '가장 최근 점이 유지되어야 함', String(capped['cap-test'][59].price));

// 6) id 없는 상품은 무시한다.
stored = history.appendHistoryPoints(stored, [{ price: 9999, isSoldOut: false }], 5000);
expect(!stored.undefined, 'id 없는 상품은 기록되면 안 됨');

// 7) getProductHistory: 모르는 id는 빈 배열을 돌려준다.
expect(Array.isArray(history.getProductHistory(stored, 'unknown-id')) && history.getProductHistory(stored, 'unknown-id').length === 0, '모르는 id는 빈 배열이어야 함');

if (failures.length > 0) {
  console.error('[history:test] 실패');
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log('[history:test] 통과: 이력 기록/중복 방지/상한/delta 계산 확인 완료');
