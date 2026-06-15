const path = require('node:path');
const {
  SMARTSTORE_SOURCES,
  _test,
  loadLocalEnv,
  testSmartStoreSearch,
} = require('../electron/naverShoppingSearch.cjs');

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

const filloutBulkFixture = _test.normalizeSmartStoreCategoryItems('fillout', [
  {
    id: '6792791322',
    title: '커피 대용량',
    price: 29000,
    productUrl: 'https://smartstore.naver.com/filloutcoffee/products/6792791322',
    imageUrl: 'https://example.com/fillout-bulk.png',
    isSoldOut: false,
  },
]);
if (filloutBulkFixture.length !== 0) {
  throw new Error('용량 없는 스마트스토어 대용량 옵션 상품은 200g으로 단정하지 말고 제외해야 합니다.');
}

const nonBeanCoffeeFixture = _test.normalizeSmartStoreCategoryItems('hitte', [
  {
    id: 'easy-dripbag',
    title: 'EASY COFFEE 드립백 10개입',
    price: 12000,
    productUrl: 'https://smartstore.naver.com/hytteroastery/products/easy-dripbag',
    imageUrl: 'https://example.com/dripbag.png',
    isSoldOut: false,
  },
  {
    id: 'instant-stick',
    title: '히떼 인스턴트커피 스틱 20개입',
    price: 15000,
    productUrl: 'https://smartstore.naver.com/hytteroastery/products/instant-stick',
    imageUrl: 'https://example.com/instant.png',
    isSoldOut: false,
  },
  {
    id: 'bulk-1200',
    title: '리볼브 1.2kg',
    price: 82000,
    productUrl: 'https://smartstore.naver.com/hytteroastery/products/bulk-1200',
    imageUrl: 'https://example.com/bulk.png',
    isSoldOut: false,
  },
  {
    id: 'exact-1000',
    title: '리볼브 1kg',
    price: 68000,
    productUrl: 'https://smartstore.naver.com/hytteroastery/products/exact-1000',
    imageUrl: 'https://example.com/onekg.png',
    isSoldOut: false,
  },
]);
if (nonBeanCoffeeFixture.length !== 1 || nonBeanCoffeeFixture[0].weight !== 1000) {
  throw new Error(`스마트스토어 수집은 원두 외 커피류와 1kg 초과 상품을 제외하고 1kg 원두만 남겨야 합니다: ${nonBeanCoffeeFixture.map((product) => product.productName).join(', ') || '(없음)'}`);
}

const hitteCategoryFixture = _test.normalizeSmartStoreCategoryItems('hitte', [
  {
    id: '10658396965',
    title: '리볼브 200g',
    price: 14000,
    productUrl: 'https://smartstore.naver.com/hytteroastery/products/10658396965',
    categoryUrl: SMARTSTORE_SOURCES.hitte.categoryUrls[0],
    imageUrl: 'https://example.com/hitte.png',
    isSoldOut: false,
  },
]);
if (hitteCategoryFixture[0].storeUrl !== SMARTSTORE_SOURCES.hitte.categoryUrls[0]) {
  throw new Error(`히떼 상품에는 원두 카테고리 링크가 보존되어야 합니다: ${hitteCategoryFixture[0].storeUrl || '(없음)'}`);
}

// 제목 사전 매칭: 맛 단어만 잡고, 산지·가공방식으로 추측하면 안 된다.
const dalgonaNotes = _test.getTasteNotes('달고나 블랜드 500g');
if (!dalgonaNotes.includes('달고나')) {
  throw new Error(`상품명에서 달고나 노트를 찾지 못했습니다: ${dalgonaNotes.join(', ') || '(없음)'}`);
}
const plainTitleNotes = _test.getTasteNotes('에티오피아 하데나 머츄어 에얼룸 모디파이드 워시드');
if (plainTitleNotes.length !== 0) {
  throw new Error(`맛 단어가 없는 상품명에서 노트를 추측하면 안 됩니다: ${plainTitleNotes.join(', ')}`);
}

// 상세 본문 텍스트에서 노트 추출 (이미지 OCR 없이 글자만으로)
_test.extractNotesFromDetail(
  '<div><p>Tasting Note : 자몽, 캐러멜, 다크초콜릿</p><p>원산지: 에티오피아</p></div>',
).then((detailNotes) => {
  if (!detailNotes.includes('자몽') || !detailNotes.includes('캐러멜')) {
    throw new Error(`상세 본문 텍스트에서 노트를 읽지 못했습니다: ${detailNotes.join(', ') || '(없음)'}`);
  }
});

// 검색 API 노트 이식: 제목이 같거나 포함 관계면 옮겨 붙이고, 다르면 붙이면 안 된다.
const mergedNotes = _test.mergeNotesFromSearchResults(
  [
    { productName: '팀 웬들보 온두라스 핀카 엘 푸엔테 게이샤 워시드', tastingNotes: [] },
    { productName: '케냐 카링가 AA 워시드', tastingNotes: [] },
  ],
  [{ productName: 'Tim Wendelboe 팀 웬들보 온두라스 핀카 엘 푸엔테 게이샤 워시드', tastingNotes: ['자스민', '꿀'] }],
);
if (!mergedNotes[0].tastingNotes.includes('자스민')) {
  throw new Error(`검색 API 노트 이식이 동작하지 않습니다: ${mergedNotes[0].tastingNotes.join(', ') || '(없음)'}`);
}
if (mergedNotes[1].tastingNotes.length !== 0) {
  throw new Error(`제목이 다른 상품에 노트가 잘못 이식되었습니다: ${mergedNotes[1].tastingNotes.join(', ')}`);
}

const detailImages = _test.extractSmartStoreDetailImageUrls(
  '<img src="https://shop-phinf.pstatic.net/a.jpg"><img data-src="https://shop-phinf.pstatic.net/b.png"><img src="/blank.gif">',
);
if (detailImages.length !== 2) {
  throw new Error(`상세 본문 이미지 주소 추출이 잘못되었습니다: ${detailImages.join(', ')}`);
}

if (!SMARTSTORE_SOURCES.identity.categoryUrl) {
  throw new Error('아이덴티티커피랩은 할인 정상가 확인을 위해 스마트스토어 카테고리 주소가 필요합니다.');
}

const identityFixture = _test.normalizeSmartStoreCategoryItems('identity', [
  {
    id: '6684189550',
    title: '미드센추리 블렌드(1kg) (분쇄요청불가)',
    price: 48000,
    originalPrice: 66000,
    productUrl: 'https://smartstore.naver.com/identity_coffeelab/products/6684189550',
    imageUrl: 'https://example.com/midcentury.png',
    isSoldOut: false,
  },
]);
if (identityFixture[0].price !== 48000 || identityFixture[0].originalPrice !== 66000) {
  throw new Error('아이덴티티커피랩 할인 정상가 66,000원과 할인가 48,000원이 함께 보존되어야 합니다.');
}

const lubiaOptionPriceFixture = _test.normalizeSmartStoreCategoryItems('lubia', [
  {
    id: '12601437842',
    title: '[그란데] 에티오피아 예가체프 코케 G2 워시드 미디엄 로스트 1kg',
    price: 1000,
    originalPrice: 46000,
    productUrl: 'https://smartstore.naver.com/rubiacoffee/products/12601437842',
    imageUrl: 'https://example.com/lubia.png',
    isSoldOut: false,
  },
]);
if (lubiaOptionPriceFixture[0].price !== 46000 || lubiaOptionPriceFixture[0].originalPrice) {
  throw new Error('루비아 옵션 추가금 1,000원은 판매가로 쓰지 않고 원래가로 보정해야 합니다.');
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
