const path = require('node:path');
const { _test, loadLocalEnv, testSmartStoreSearch } = require('../electron/naverShoppingSearch.cjs');

loadLocalEnv(path.resolve(__dirname, '..'));

const roasterickRawTitle = '달고나 블랜드 500g';
if (_test.parseWeight(roasterickRawTitle) !== 500) {
  throw new Error('로스터릭 스마트스토어 상품명에서 500g 용량을 읽지 못했습니다.');
}
if (_test.parseWeight('콜롬비아 E.A 디카페인 220g') !== 220) {
  throw new Error('로스터릭 스마트스토어 상품명에서 220g 용량을 읽지 못했습니다.');
}
if (_test.cleanShoppingTitle(roasterickRawTitle, '로스터릭').includes('500g')) {
  throw new Error('스마트스토어 카드명 정리에서는 용량 문구가 제거되어야 합니다.');
}

const cafedoanFixture = _test.normalizeSmartStoreCategoryItems('cafedoan', [
  {
    id: '13472038970',
    title: 'PRODIGAL 프로디갈 콜롬비아 핀카 라스 팔마스 버번 아히, 워시드 250g',
    price: 52000,
    productUrl: 'https://smartstore.naver.com/doanselectshop/products/13472038970',
    imageUrl: 'https://example.com/prodigal.png',
    isSoldOut: false,
  },
  {
    id: '13472036356',
    title: 'PRODIGAL 프로디갈 콜롬비아 핀카 라스 델리시아스 게이샤, 워시드 150g',
    price: 59000,
    productUrl: 'https://smartstore.naver.com/doanselectshop/products/13472036356',
    imageUrl: 'https://example.com/soldout.png',
    isSoldOut: true,
  },
]);
if (cafedoanFixture[0].weight !== 250 || cafedoanFixture[1].weight !== 150) {
  throw new Error('카페도안 카테고리 상품명에서 용량을 읽지 못했습니다.');
}
if (cafedoanFixture[0].isSoldOut || !cafedoanFixture[1].isSoldOut) {
  throw new Error('카페도안 카테고리의 판매 중/품절 상태가 보존되어야 합니다.');
}

testSmartStoreSearch()
  .then((result) => {
    console.log(result.message);
    result.sources.forEach((source) => {
      console.log(`${source.sourceId}: 검색어 "${source.query}", 전체 ${source.total}개, 연결 상품 ${source.productCount}개`);
      (source.products || []).forEach((product) => {
        console.log(`  - ${product.productName} => ${product.tastingNotes.join(', ')}`);
      });
      if (source.warning) console.log(`안내: ${source.warning}`);
    });
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
