const path = require('node:path');
const {
  SMARTSTORE_SOURCES,
  _test,
  loadLocalEnv,
  testSmartStoreSearch,
} = require('../electron/naverShoppingSearch.cjs');
const unspecialtyNotes = require('../electron/noteSources/unspecialty.cjs');

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

const smartStoreGoodsFixture = _test.normalizeSmartStoreCategoryItems('malik', [
  {
    id: 'goods-socks',
    title: '말릭커피 로고 양말',
    price: 12000,
    productUrl: 'https://smartstore.naver.com/undercrema/products/goods-socks',
    imageUrl: 'https://example.com/socks.png',
    isSoldOut: false,
  },
  {
    id: 'goods-glass',
    title: '말릭커피 언더락 글라스',
    price: 18000,
    productUrl: 'https://smartstore.naver.com/undercrema/products/goods-glass',
    imageUrl: 'https://example.com/glass.png',
    isSoldOut: false,
  },
  {
    id: 'goods-postcard',
    title: '말릭커피 엽서 세트',
    price: 5000,
    productUrl: 'https://smartstore.naver.com/undercrema/products/goods-postcard',
    imageUrl: 'https://example.com/postcard.png',
    isSoldOut: false,
  },
  {
    id: 'goods-hat',
    title: '말릭커피 로고 모자',
    price: 18000,
    productUrl: 'https://smartstore.naver.com/undercrema/products/goods-hat',
    imageUrl: 'https://example.com/hat.png',
    isSoldOut: false,
  },
  {
    id: 'bean-cupnote',
    title: '에티오피아 첼베사 컵노트 자스민 200g',
    price: 19000,
    productUrl: 'https://smartstore.naver.com/undercrema/products/bean-cupnote',
    imageUrl: 'https://example.com/bean-cupnote.png',
    isSoldOut: false,
  },
  {
    id: 'bean-gift',
    title: '선물하기 좋은 블렌드 원두 200g',
    price: 16000,
    productUrl: 'https://smartstore.naver.com/undercrema/products/bean-gift',
    imageUrl: 'https://example.com/bean-gift.png',
    isSoldOut: false,
  },
  {
    id: 'bean-mosaic',
    title: '모자이크 블렌드 원두 200g',
    price: 17000,
    productUrl: 'https://smartstore.naver.com/undercrema/products/bean-mosaic',
    imageUrl: 'https://example.com/bean-mosaic.png',
    isSoldOut: false,
  },
]);
if (smartStoreGoodsFixture.length !== 3) {
  throw new Error(`스마트스토어 굿즈 필터는 굿즈만 제외하고 정상 원두는 남겨야 합니다: ${smartStoreGoodsFixture.map((product) => product.productName).join(', ') || '(없음)'}`);
}
const goodsRemainingIds = smartStoreGoodsFixture.map((product) => product.id);
if (!goodsRemainingIds.includes('malik-bean-cupnote') || !goodsRemainingIds.includes('malik-bean-gift') || !goodsRemainingIds.includes('malik-bean-mosaic')) {
  throw new Error(`컵노트/선물/모자이크 문구가 들어간 정상 원두가 잘못 제외되었습니다: ${goodsRemainingIds.join(', ')}`);
}
if (_test.isCollectableSmartStoreProductTitle('말릭커피 로고 양말') || _test.isCollectableSmartStoreProductTitle('말릭커피 로고 모자')) {
  throw new Error('검색 API 공통 필터가 스마트스토어 굿즈를 제외하지 못했습니다.');
}
if (!_test.isCollectableSmartStoreProductTitle('가방산 블렌드 원두 200g')) {
  throw new Error('검색 API 공통 필터가 가방 같은 경계 제외어를 포함한 정상 원두를 잘못 제외했습니다.');
}
if (_test.isCollectableSmartStoreProductTitle('말릭커피 로고 가방')) {
  throw new Error('검색 API 공통 필터가 단독 가방 굿즈를 제외하지 못했습니다.');
}
if (!_test.isCollectableSmartStoreProductTitle('원두 선물세트 200g') || !_test.isCollectableSmartStoreProductTitle('싱글오리진 원두 기프트 세트')) {
  throw new Error('검색 API 공통 필터가 정상 원두 선물세트를 잘못 제외했습니다.');
}
if (_test.isCollectableSmartStoreProductTitle('말릭커피 기프트 세트')) {
  throw new Error('검색 API 공통 필터가 원두 신호 없는 기프트 세트를 제외하지 못했습니다.');
}
if (!_test.isCollectableSmartStoreProductTitle('모자이크 블렌드 원두 200g')) {
  throw new Error('검색 API 공통 필터가 모자이크 같은 정상 원두를 잘못 제외했습니다.');
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

// Gemini 응답은 설명이 섞여도 JSON 배열만 안전하게 읽어야 한다.
const geminiNotes = _test.parseGeminiNoteList('결과입니다.\n["초콜릿", "자몽", ""]');
if (geminiNotes.join(',') !== '초콜릿,자몽') {
  throw new Error(`Gemini 응답 JSON 배열을 읽지 못했습니다: ${geminiNotes.join(', ') || '(없음)'}`);
}
const invalidGeminiNotes = _test.parseGeminiNoteList('노트가 없습니다.');
if (invalidGeminiNotes.length !== 0) {
  throw new Error(`JSON 배열이 없는 Gemini 응답은 빈 배열이어야 합니다: ${invalidGeminiNotes.join(', ')}`);
}
_test.readOfficialMallImageText('https://example.com/official.jpg', { lang: 'eng+kor' }, {
  env: { GEMINI_API_KEY: 'test-key' },
  readGeminiText: async () => '["샤인머스캣", "멜론"]',
  readOcrText: async () => {
    throw new Error('Gemini가 공식몰 노트를 찾으면 기존 OCR은 호출하지 않아야 합니다.');
  },
}).then((officialGeminiText) => {
  if (officialGeminiText !== 'Tasting Note: 멜론, 샤인머스캣') {
    throw new Error(`공식몰 Gemini 노트 텍스트 형식이 잘못되었습니다: ${officialGeminiText}`);
  }
});
_test.readOfficialMallImageText('https://example.com/official-empty.jpg', { lang: 'eng+kor' }, {
  env: { GEMINI_API_KEY: 'test-key' },
  readGeminiText: async () => '[]',
  readOcrText: async () => 'Flavor & Aroma: Green Apple, Melon',
}).then((officialFallbackText) => {
  if (officialFallbackText !== 'Flavor & Aroma: Green Apple, Melon') {
    throw new Error(`공식몰 Gemini 빈 결과는 기존 OCR로 내려가야 합니다: ${officialFallbackText}`);
  }
});
const persistentGeminiCacheDir = _test.getOcrCacheDir(
  { LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' },
  'C:\\Users\\tester\\AppData\\Local\\Temp',
);
if (persistentGeminiCacheDir !== path.join('C:\\Users\\tester\\AppData\\Local', 'BeanPick', 'ocr-cache')) {
  throw new Error(`Gemini OCR 캐시는 임시 폴더가 아니라 오래 남는 로컬 앱 데이터 폴더를 써야 합니다: ${persistentGeminiCacheDir}`);
}

if (!_test.shouldRunThumbnailOcr({ tastingNotes: ['초콜릿'], imageUrl: 'https://example.com/bean.jpg' }, { force: true })) {
  throw new Error('정밀 수집 모드에서는 기존 노트가 있어도 스마트스토어 썸네일을 다시 읽어야 합니다.');
}
if (_test.shouldRunThumbnailOcr({ tastingNotes: ['초콜릿'], imageUrl: 'https://example.com/bean.jpg' }, { force: false })) {
  throw new Error('일반 수집 모드에서는 기존 노트가 있으면 썸네일 OCR을 건너뛰어야 합니다.');
}
const mergedGeminiNotes = _test.mergeTastingNotes(['초콜릿', '자몽'], ['자몽', '자스민', '꿀', '복숭아', '베르가못']);
if (mergedGeminiNotes.join(',') !== '자몽,복숭아,자스민,베르가못,초콜릿') {
  throw new Error(`Gemini 노트는 기존 노트와 중복 없이 최대 5개까지 합쳐야 합니다: ${mergedGeminiNotes.join(', ')}`);
}
const rubiaGalleryNotes = _test.extractFlavorNotesAnywhere('헤이즐넛 견과류 초콜릿 달콤함');
for (const note of ['헤이즐넛', '견과류', '초콜릿', '단맛']) {
  if (!rubiaGalleryNotes.includes(note)) {
    throw new Error(`루비아 갤러리 카드 노트를 읽지 못했습니다: ${rubiaGalleryNotes.join(', ') || '(없음)'}`);
  }
}
const rubiaTitleOnlyNotes = _test.getTasteNotes('헤이즐넛 브라운 다크 로스트 플레이버드 블렌드 커피');
if (rubiaTitleOnlyNotes.join(',') !== '헤이즐넛') {
  throw new Error(`루비아 상품명 단독 경로는 헤이즐넛만 유지해야 합니다: ${rubiaTitleOnlyNotes.join(', ') || '(없음)'}`);
}
const marketingSweetNotes = _test.extractNotesFromPreloadedDetailText(
  '달콤한 초콜릿 케이크처럼 부드럽고 고소한 여운이 느껴지는 블렌드입니다.',
);
if (marketingSweetNotes.includes('단맛')) {
  throw new Error(`달콤한 설명문을 단맛 컵노트로 오인하면 안 됩니다: ${marketingSweetNotes.join(', ')}`);
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

const unspecialtyFixtureHtml = `
  <li id="anchorBoxId_773">
    <div class="description">
      <div class="name"><a href="/product/detail.html?product_no=773"><span>상품명</span> :
        <span>[말릭커피] 콜롬비아 톨리마 카페 그란데 엘 비노 마운틴워터 디카페인</span></a></div>
      <span>U:{"cupNotes":"만다린, 사과, 건자두, 체리, 사탕수수","options":"200g/19,500원","roastery":"말릭커피"}:U</span>
    </div>
  </li>
`;
const unspecialtyParsed = unspecialtyNotes._test.extractUnspecialtyProductsFromHtml(
  unspecialtyFixtureHtml,
  'https://unspecialty.com/product/list.html?cate_no=90',
);
if (unspecialtyParsed.length !== 1 || !unspecialtyParsed[0].tastingNotes.includes('체리')) {
  throw new Error(`언스페셜티 목록 컵노트 파싱이 동작하지 않습니다: ${JSON.stringify(unspecialtyParsed)}`);
}
const unspecialtyMerged = _test.mergeNotesFromMatchedProducts(
  [
    { productName: '콜롬비아 톨리마 카페 그란데 엘 비노 마운틴워터 디카페인', tastingNotes: [], price: 18500 },
    { productName: '마일드 블렌드', tastingNotes: ['초콜릿'], price: 14500 },
  ],
  [
    ...unspecialtyParsed,
    { productName: '마일드 블렌드', tastingNotes: ['오렌지'] },
  ],
);
if (!unspecialtyMerged[0].tastingNotes.includes('사과') || unspecialtyMerged[0].price !== 18500) {
  throw new Error(`언스페셜티 노트는 빈 노트 상품에만 가격 변경 없이 이식되어야 합니다: ${JSON.stringify(unspecialtyMerged[0])}`);
}
if (unspecialtyMerged[1].tastingNotes.join(',') !== '초콜릿') {
  throw new Error(`이미 노트가 있는 상품은 언스페셜티 노트로 덮어쓰면 안 됩니다: ${JSON.stringify(unspecialtyMerged[1])}`);
}

const unspecialtyEdnMerged = _test.mergeNotesFromMatchedProducts(
  [
    { productName: '에티오피아 EDN 반코 타라투 더블퍼먼테이션 워시드', tastingNotes: [] },
  ],
  [
    { productName: '에티오피아 반코 타라투 더블 퍼먼테이션 워시드', tastingNotes: ['레몬', '망고', '자스민'] },
  ],
);
if (!unspecialtyEdnMerged[0].tastingNotes.includes('망고')) {
  throw new Error(`EDN 같은 짧은 영문 토큰이 끼어도 언스페셜티 노트가 이식되어야 합니다: ${JSON.stringify(unspecialtyEdnMerged[0])}`);
}

const unspecialtyDuplicateSourceMerged = _test.mergeNotesFromMatchedProducts(
  [
    { productName: '에티오피아 EDN 반코 타라투 더블퍼먼테이션 워시드', tastingNotes: [] },
  ],
  [
    { productName: '에티오피아 반코 타라투 더블 퍼먼테이션 워시드', tastingNotes: ['레몬', '망고', '자스민'] },
    { productName: '에티오피아 반코 타라투 더블 퍼먼테이션 워시드', tastingNotes: ['레몬', '망고', '자스민'] },
  ],
);
if (!unspecialtyDuplicateSourceMerged[0].tastingNotes.includes('망고')) {
  throw new Error(`언스페셜티 중복 상품 카드가 있어도 같은 후보는 하나로 보고 노트를 이식해야 합니다: ${JSON.stringify(unspecialtyDuplicateSourceMerged[0])}`);
}

const unspecialtyDuplicateTargetMerged = _test.mergeNotesFromMatchedProducts(
  [
    { productName: '에티오피아 EDN 반코 타라투 더블퍼먼테이션 워시드', tastingNotes: [] },
    { productName: '에티오피아 EDN 반코 타라투 더블퍼먼테이션 워시드', tastingNotes: [] },
  ],
  [
    { productName: '에티오피아 반코 타라투 더블 퍼먼테이션 워시드', tastingNotes: ['레몬', '망고', '자스민'] },
  ],
);
if (unspecialtyDuplicateTargetMerged.some((product) => !product.tastingNotes.includes('망고'))) {
  throw new Error(`같은 스마트스토어 상품 카드가 중복되어도 EDN 보조 매칭은 동작해야 합니다: ${JSON.stringify(unspecialtyDuplicateTargetMerged)}`);
}

const unspecialtyGradeGuard = _test.mergeNotesFromMatchedProducts(
  [
    { productName: '케냐 니에리힐 AA 워시드', tastingNotes: [] },
    { productName: '케냐 니에리힐 AB 워시드', tastingNotes: [] },
  ],
  [
    { productName: '케냐 니에리힐 워시드', tastingNotes: ['시트러스', '살구'] },
  ],
);
if (unspecialtyGradeGuard.some((product) => product.tastingNotes.length > 0)) {
  throw new Error(`AA/AB처럼 등급만 다른 상품은 약어 제거 보조키로 잘못 붙이면 안 됩니다: ${JSON.stringify(unspecialtyGradeGuard)}`);
}

const detailImages = _test.extractSmartStoreDetailImageUrls(
  '<img src="https://shop-phinf.pstatic.net/a.jpg"><img data-src="https://shop-phinf.pstatic.net/b.png"><img src="/blank.gif">',
);
if (detailImages.length !== 2) {
  throw new Error(`상세 본문 이미지 주소 추출이 잘못되었습니다: ${detailImages.join(', ')}`);
}

const preloadedLabeledNotes = _test.extractNotesFromPreloadedDetailText(
  '에티오피아 반코 타라투 더블 퍼먼테이션 워시드 200g\n컵노트: 자스민, 백도, 망고, 파인애플, 베르가못, 꿀, 슈가케인, 블랙티, 레몬\n고도 1,900-2,300m',
);
if (!preloadedLabeledNotes.includes('자스민') || !preloadedLabeledNotes.includes('망고')) {
  throw new Error(`PRELOADED_STATE 설명 텍스트의 라벨 컵노트를 읽지 못했습니다: ${preloadedLabeledNotes.join(', ') || '(없음)'}`);
}

const preloadedUnlabeledNotes = _test.extractNotesFromPreloadedDetailText(
  '자스민, 망고, 파인애플, 베르가못, 꿀',
);
if (!preloadedUnlabeledNotes.includes('자스민') || !preloadedUnlabeledNotes.includes('파인애플')) {
  throw new Error(`PRELOADED_STATE 설명 텍스트의 안전한 무라벨 노트 줄을 읽지 못했습니다: ${preloadedUnlabeledNotes.join(', ') || '(없음)'}`);
}

const preloadedMarketingNotes = _test.extractNotesFromPreloadedDetailText(
  '아몬드 초콜릿을 떠올리게 합니다. 절제된 산미로 부드럽게 시작해 구운 견과류의 자연스러운 단맛이 퍼집니다.',
);
if (preloadedMarketingNotes.length !== 0) {
  throw new Error(`PRELOADED_STATE 설명 문장 전체에서 노트를 추측하면 안 됩니다: ${preloadedMarketingNotes.join(', ')}`);
}
const preloadedReviewTextNotes = _test.extractNotesFromPreloadedDetailText(
  '복잡한 구성은 아니지만 가진 노트와 뉘앙스들의 구조감이 매우 뛰어납니다.',
);
if (preloadedReviewTextNotes.length !== 0) {
  throw new Error(`PRELOADED_STATE 리뷰성 문장의 "노트와"를 라벨로 오인하면 안 됩니다: ${preloadedReviewTextNotes.join(', ')}`);
}
const preloadedSpaceOnlyNotes = _test.extractNotesFromPreloadedDetailText(
  '복숭아 자두 꿀 같은 달콤함',
);
if (preloadedSpaceOnlyNotes.length !== 0) {
  throw new Error(`PRELOADED_STATE 공백 구분 설명문을 무라벨 노트 목록으로 보면 안 됩니다: ${preloadedSpaceOnlyNotes.join(', ')}`);
}

if (!SMARTSTORE_SOURCES.identity.categoryUrl) {
  throw new Error('아이덴티티커피랩은 할인 정상가 확인을 위해 스마트스토어 카테고리 주소가 필요합니다.');
}

const coffeejgDirectUrl = _test.normalizeSmartStoreProductUrl(
  'https://smartstore.naver.com/main/products/13181681419',
  SMARTSTORE_SOURCES.coffeejg,
);
if (coffeejgDirectUrl !== 'https://smartstore.naver.com/coffeejg/products/13181681419') {
  throw new Error(`커피정경 검색 API 상품 링크가 직접 스마트스토어 링크로 바뀌어야 합니다: ${coffeejgDirectUrl}`);
}

const identityDirectUrl = _test.normalizeSmartStoreProductUrl(
  'https://smartstore.naver.com/main/products/6684189550',
  SMARTSTORE_SOURCES.identity,
);
if (identityDirectUrl !== 'https://smartstore.naver.com/identity_coffeelab/products/6684189550') {
  throw new Error(`아이덴티티 검색 API 상품 링크가 직접 스마트스토어 링크로 바뀌어야 합니다: ${identityDirectUrl}`);
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

const coffeejgOptionFixture = _test.buildSmartStorePriceOptionsFromDetail(
  {
    optionCombinations: [
      { optionName1: '20g', price: -18000, stockQuantity: 5, usable: true },
      { optionName1: '200g', price: 0, stockQuantity: 5, usable: true },
      { optionName1: '500g', price: 18000, stockQuantity: 3, usable: true },
      { optionName1: '분쇄안함', price: 0, stockQuantity: 3, usable: true },
    ],
  },
  {
    productName: '콜롬비아 모모스 셀렉션 라 플라타 게이샤 워시드',
    price: 21000,
    originalPrice: 24000,
    weight: 200,
    productUrl: 'https://smartstore.naver.com/coffeejg/products/13583727290',
  },
);
if (coffeejgOptionFixture.length !== 2) {
  throw new Error(`스마트스토어 상세 옵션에서 용량 2개를 읽어야 합니다: ${JSON.stringify(coffeejgOptionFixture)}`);
}
if (coffeejgOptionFixture[0].weight !== 200 || coffeejgOptionFixture[0].price !== 21000 || coffeejgOptionFixture[0].originalPrice !== 24000) {
  throw new Error(`기본 용량 옵션 가격/정상가가 잘못되었습니다: ${JSON.stringify(coffeejgOptionFixture[0])}`);
}
if (coffeejgOptionFixture[1].weight !== 500 || coffeejgOptionFixture[1].price !== 39000 || coffeejgOptionFixture[1].originalPrice) {
  throw new Error(`추가금 옵션은 기본가+추가금으로 계산하고 다른 용량 정상가를 붙이면 안 됩니다: ${JSON.stringify(coffeejgOptionFixture[1])}`);
}
if (coffeejgOptionFixture.map((option) => option.weightLabel).join(' / ') !== '200g / 500g') {
  throw new Error(`스마트스토어 용량 옵션 라벨이 잘못되었습니다: ${coffeejgOptionFixture.map((option) => option.weightLabel).join(' / ')}`);
}

const coffeejgGroupedProductFixture = _test.buildSmartStorePriceOptionsFromDetail(
  {
    optionCombinations: [
      { optionName: '콜롬비아 모모스 셀렉션 라 플라타 게이샤 워시드 20g, 1개', absolutePrice: 3000, usable: true },
      { optionName: '콜롬비아 모모스 셀렉션 라 플라타 게이샤 워시드 100g, 1개', absolutePrice: 11000, usable: true },
      { optionName: '콜롬비아 모모스 셀렉션 라 플라타 게이샤 워시드 200g, 1개', absolutePrice: 21000, usable: true },
    ],
  },
  {
    productName: '콜롬비아 모모스 셀렉션 라 플라타 게이샤 워시드',
    price: 3000,
    weight: 20,
    productUrl: 'https://smartstore.naver.com/coffeejg/products/13583715798',
  },
);
if (coffeejgGroupedProductFixture.map((option) => option.weightLabel).join(' / ') !== '100g / 200g') {
  throw new Error(`스마트스토어 그룹 상품 옵션은 20g을 제외하고 절대 가격을 유지해야 합니다: ${JSON.stringify(coffeejgGroupedProductFixture)}`);
}
if (coffeejgGroupedProductFixture[1].price !== 21000) {
  throw new Error(`스마트스토어 그룹 상품의 200g 절대 가격이 보존되어야 합니다: ${JSON.stringify(coffeejgGroupedProductFixture[1])}`);
}

const wholeBeanFilterTest = _test.normalizeSmartStoreCategoryItems('identity', [
  {
    id: 'test-wb-1',
    title: '미드센추리 블렌드(1kg) (분쇄요청불가)',
    price: 48000,
    originalPrice: 66000,
    productUrl: 'https://smartstore.naver.com/identity_coffeelab/products/test-wb-1',
    imageUrl: 'https://example.com/midcentury.png',
    isSoldOut: false,
  },
  {
    id: 'test-wb-2',
    title: '미드센추리 블렌드 200g 핸드드립 분쇄',
    price: 15000,
    productUrl: 'https://smartstore.naver.com/identity_coffeelab/products/test-wb-2',
    imageUrl: 'https://example.com/midcentury.png',
    isSoldOut: false,
  },
  {
    id: 'test-wb-3',
    title: '테스트 원두 200g 홀빈',
    price: 15000,
    productUrl: 'https://smartstore.naver.com/identity_coffeelab/products/test-wb-3',
    imageUrl: 'https://example.com/midcentury.png',
    isSoldOut: false,
  },
  {
    id: 'test-wb-4',
    title: '테스트 원두 200g 분쇄안함',
    price: 15000,
    productUrl: 'https://smartstore.naver.com/identity_coffeelab/products/test-wb-4',
    imageUrl: 'https://example.com/midcentury.png',
    isSoldOut: false,
  },
  {
    id: 'test-wb-5',
    title: '테스트 원두 200g ground coffee',
    price: 15000,
    productUrl: 'https://smartstore.naver.com/identity_coffeelab/products/test-wb-5',
    imageUrl: 'https://example.com/midcentury.png',
    isSoldOut: false,
  },
]);

if (wholeBeanFilterTest.length !== 3) {
  throw new Error(`스마트스토어 홀빈 필터 테스트에서 3개의 상품이 남아있어야 하지만, ${wholeBeanFilterTest.length}개가 남았습니다.`);
}
const remainingIds = wholeBeanFilterTest.map(p => p.id);
if (!remainingIds.includes('identity-test-wb-1') || !remainingIds.includes('identity-test-wb-3') || !remainingIds.includes('identity-test-wb-4')) {
  throw new Error(`스마트스토어 홀빈 필터 테스트에서 올바른 홀빈 상품들이 포함되지 않았습니다: ${remainingIds.join(', ')}`);
}
if (remainingIds.includes('identity-test-wb-2') || remainingIds.includes('identity-test-wb-5')) {
  throw new Error(`스마트스토어 홀빈 필터 테스트에서 분쇄 전용 상품이 제외되지 않았습니다: ${remainingIds.join(', ')}`);
}

// OCR/배 컵노트 오염 방지 테스트
const testText1 = '중강배전으로 볶은 깊은 단맛';
const ocrNotes1 = _test.extractFlavorNotesAnywhere(testText1);
if (ocrNotes1.includes('배')) {
  throw new Error(`배전 문구 오염: "${testText1}" 결과에 "배"가 검출되었습니다: ${JSON.stringify(ocrNotes1)}`);
}

const testText2 = '배합커피#1 소로';
const ocrNotes2 = _test.extractFlavorNotesAnywhere(testText2);
if (ocrNotes2.includes('배')) {
  throw new Error(`배합 문구 오염: "${testText2}" 결과에 "배"가 검출되었습니다: ${JSON.stringify(ocrNotes2)}`);
}

const testText3 = '약배전 온두라스 허니';
const ocrNotes3 = _test.extractFlavorNotesAnywhere(testText3);
if (ocrNotes3.includes('배')) {
  throw new Error(`배전 문구 오염: "${testText3}" 결과에 "배"가 검출되었습니다: ${JSON.stringify(ocrNotes3)}`);
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
