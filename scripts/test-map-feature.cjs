const assert = require('assert');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

function loadJsModule(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const output = esbuild.transformSync(code, { loader: 'js', format: 'cjs', target: 'es2020' }).code;
  const module = { exports: {} };
  new Function('exports', 'module', 'require', output)(module.exports, module, require);
  return module.exports;
}

function runMapFeatureTests() {
  console.log('지도 기능 및 생산국 추출 단위 테스트 시작...');

  const {
    COFFEE_COUNTRIES,
    COFFEE_BELT_BOUNDS,
    getCountryInfo,
    extractProductCountries,
  } = loadJsModule(path.resolve(__dirname, '../src/services/mapCoordinates.js'));

  // 1. 커피 생산국 좌표 유효성 검증
  assert(COFFEE_COUNTRIES.length >= 20, '커피 생산국은 최소 20개 이상이어야 합니다.');
  for (const country of COFFEE_COUNTRIES) {
    assert(country.x >= 0 && country.x <= 1000, `${country.label} x좌표(${country.x})가 0~1000 범위를 벗어남`);
    assert(country.y >= 0 && country.y <= 500, `${country.label} y좌표(${country.y})가 0~500 범위를 벗어남`);
    assert(country.lat >= -90 && country.lat <= 90, `${country.label} 위도 범위 오류`);
    assert(country.lng >= -180 && country.lng <= 180, `${country.label} 경도 범위 오류`);
  }
  console.log(`[PASS] ${COFFEE_COUNTRIES.length}개 커피 생산국 좌표 및 범위 검증 완료`);

  // 2. 싱글오리진 원두 국가 추출 검증
  const ethiopiaSample = { productName: '에티오피아 예가체프 첼베사 워시드 200g', origin: 'Ethiopia' };
  const ethiopiaResult = extractProductCountries(ethiopiaSample);
  assert.deepStrictEqual(ethiopiaResult, ['에티오피아'], '에티오피아 싱글오리진 추출 실패');

  const colombiaSample = { productName: '콜롬비아 엘 파라이소 리치', origin: 'Colombia' };
  const colombiaResult = extractProductCountries(colombiaSample);
  assert.deepStrictEqual(colombiaResult, ['콜롬비아'], '콜롬비아 싱글오리진 추출 실패');

  // 3. 인도 vs 인도네시아 오매칭 가드 검증
  const indonesiaSample = { productName: '인도네시아 만델링 G1 200g', origin: 'Indonesia · Aceh Ribang' };
  const indonesiaResult = extractProductCountries(indonesiaSample);
  assert(indonesiaResult.includes('인도네시아'), '인도네시아가 포함되어야 함');
  assert(!indonesiaResult.includes('인도'), '인도네시아 상품에 인도가 오매칭되면 안 됨');

  const indiaSample = { productName: '인도 아라쿠 몬순 말라바', origin: 'India' };
  const indiaResult = extractProductCountries(indiaSample);
  assert.deepStrictEqual(indiaResult, ['인도'], '인도 상품 추출 실패');

  // 4. 다중 국가 블렌드 원두 추출 검증
  const blendMultiSample = {
    productName: '시그니처 하우스 블렌드',
    origin: 'Guatemala · India · Nicaragua · Ethiopia',
  };
  const blendMultiResult = extractProductCountries(blendMultiSample);
  assert.strictEqual(blendMultiResult.length, 4, '4개국 블렌드에서 4개국이 모두 추출되어야 함');
  assert(blendMultiResult.includes('과테말라'));
  assert(blendMultiResult.includes('인도'));
  assert(blendMultiResult.includes('니카라과'));
  assert(blendMultiResult.includes('에티오피아'));

  // 5. 국가 미기재/불명확 원두 안전성 검증
  assert.deepStrictEqual(extractProductCountries(null), [], 'null 입력 시 빈 배열 반환');
  assert.deepStrictEqual(extractProductCountries({}), [], '빈 객체 입력 시 빈 배열 반환');
  assert.deepStrictEqual(
    extractProductCountries({ productName: '에스프레소 블렌드', origin: 'Blend' }),
    [],
    '국가 미기재 블렌드는 빈 배열 반환',
  );

  // 6. 실데이터(docs/products.json) 339개 전수 검증
  const productsPath = path.resolve(__dirname, '../docs/products.json');
  if (fs.existsSync(productsPath)) {
    const rawData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    const products = Array.isArray(rawData) ? rawData : rawData.products || [];

    let mappedCount = 0;
    let blendMultiCount = 0;
    for (const p of products) {
      const countries = extractProductCountries(p);
      if (countries.length === 1) mappedCount++;
      if (countries.length > 1) blendMultiCount++;
    }

    assert(mappedCount >= 180, `실데이터 매핑 건수(${mappedCount})가 기준(180건)에 미달함`);
    assert(blendMultiCount >= 5, `실데이터 다중 블렌드 건수(${blendMultiCount})가 기준(5건)에 미달함`);
    console.log(`[PASS] 실데이터 ${products.length}개 전수 검증 통과 (단일 매핑: ${mappedCount}, 다중 블렌드: ${blendMultiCount})`);
  }

  console.log('\n지도 기능 단위 테스트 전체 통과 성공!');
}

try {
  runMapFeatureTests();
} catch (err) {
  console.error('\n지도 기능 단위 테스트 실패:', err);
  process.exit(1);
}
