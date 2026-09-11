// 수집 엔진 교체 5단계: 공식몰 판매처 등록 설정.
// main.cjs 안에 있던 설정을 그대로 옮겨 등록 계층(registry.cjs)과 수집기가 같은 값을 보게 한다.
// 로스터리 이름과 플랫폼은 등록 계층이 쓰라고 덧붙였다. 수집 동작 값은 바꾸지 않았다.
const OFFICIAL_MALL_PAGE_CONFIGS = {
  fritz: {
    roasterName: '프릳츠 커피 컴퍼니',
    platform: 'cafe24',
    sourceUrl: 'https://fritz.co.kr/product/list.html?cate_no=48',
    categoryNo: '48',
    verifyStockFromDetail: true,
    detailOrigin: 'https://fritz.co.kr',
  },
  namusairo: {
    roasterName: '나무사이로',
    platform: 'cafe24',
    sourceUrl: 'https://namusairo.com/category/coffee/91/',
    categoryNo: '91',
    verifyStockFromDetail: true,
    detailOrigin: 'https://namusairo.com',
  },
  coffeelibre: {
    roasterName: '커피리브레',
    platform: 'cafe24',
    sourceUrl: 'https://coffeelibre.kr/product/list.html?cate_no=47',
    categoryNo: '47',
    verifyStockFromDetail: true,
    detailOrigin: 'https://coffeelibre.kr',
  },
  werk: {
    roasterName: '베르크커피',
    platform: 'cafe24',
    sourceUrl: 'https://werk.co.kr/',
    verifyStockFromDetail: true,
    detailOrigin: 'https://werk.co.kr',
  },
  deepbluelake: {
    roasterName: '딥블루레이크',
    platform: 'cafe24',
    sourceUrl: 'https://dblcoffee.com/product/list.html?cate_no=24',
    categoryNo: '24',
    verifyStockFromDetail: true,
    detailOrigin: 'https://dblcoffee.com',
  },
  hellcafe: {
    roasterName: '헬카페',
    platform: 'cafe24',
    sourceUrl: 'https://hellcafe.co.kr/store/store.html',
    categoryNo: '1',
    verifyStockFromDetail: true,
    detailOrigin: 'https://hellcafe.co.kr',
  },
  centercoffee: {
    roasterName: '센터커피',
    platform: 'imweb',
    sourceId: 'centercoffee',
    sourceUrl: 'https://www.centercoffee.co.kr/67',
    maxPages: 2,
    verifyStockFromDetail: true,
    detailOrigin: 'https://www.centercoffee.co.kr',
    pageUrl(pageNumber) {
      if (pageNumber === 1) return this.sourceUrl;
      return `https://www.centercoffee.co.kr/ajax/get_shop_list_view.cm?page=${pageNumber}&pagesize=12&category=s20190728fa16756cae2c6&sort=recent&menu_url=%2F67%2F`;
    },
  },
  coffee502: {
    roasterName: '502커피로스터스',
    platform: 'cafe24',
    sourceUrl: 'https://502coffee.com/category/%EC%9B%90%EB%91%90/24/',
    categoryNo: '24',
    verifyStockFromDetail: true,
    detailOrigin: 'https://502coffee.com',
  },
};

module.exports = { OFFICIAL_MALL_PAGE_CONFIGS };
