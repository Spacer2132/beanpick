// FIX-3 roastLevel 단위 테스트
// 실행: npm run roast:test
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { join, dirname } = require('node:path');
const { extractRoastLevel, extractRoastLevelFromDetail, getDisplayRoastLevel, isRoastLevelUnknown, ROAST_LEVELS } = require('../src/services/roastLevel.cjs');

let pass = 0;
function check(name, actual, expected) {
  try {
    assert.strictEqual(actual, expected);
    pass++;
  } catch {
    console.error(`FAIL ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    process.exitCode = 1;
  }
}

// ---- 매핑 표 ----
const MAPPINGS = [
  // 한국어 배전도
  ['약배전', 'Light'],
  ['중약배전', 'Medium-Light'],
  ['중배전', 'Medium'],
  ['중강배전', 'Medium-Dark'],
  ['강배전', 'Dark'],
  // 한국어 로스트
  ['라이트 로스트', 'Light'],
  ['미디엄 로스트', 'Medium'],
  ['미디엄 다크 로스트', 'Medium-Dark'],
  ['다크 로스트', 'Dark'],
  ['라이트로스트', 'Light'],
  ['미디엄로스트', 'Medium'],
  ['미디움 다크 로스트', 'Medium-Dark'],
  ['배전도: 미디움 다크 로스트', 'Medium-Dark'],
  ['다크로스트', 'Dark'],
  // 영어
  ['Light Roast', 'Light'],
  ['Medium Roast', 'Medium'],
  ['Medium-Dark Roast', 'Medium-Dark'],
  ['Dark Roast', 'Dark'],
  ['light', 'Light'],
  ['medium', 'Medium'],
  ['dark', 'Dark'],
  // 명시적 표기
  ['볶음도 Medium', 'Medium'],
  ['볶음도 Dark', 'Dark'],
  ['배전도: Light', 'Light'],
  ['로스팅 강배전', 'Dark'],
  ['로스팅 중강배전', 'Medium-Dark'],
  ['로스팅 중약배전', 'Medium-Light'],
  ['Roasting Point 중약배전', 'Medium-Light'],
  // 상품명 실제 사례
  ['과테말라 엘 소코로 파카마라 워시드 라이트 로스트', 'Light'],
  ['과테말라 세이바 풀리 워시드 다크 로스트', 'Dark'],
  ['에티오피아 구지 벤티 넨카 내추럴 스위스 워터 디카페인 라이트 로스트', 'Light'],
];
for (const [input, expected] of MAPPINGS) check(`map:${input}`, extractRoastLevel(input), expected);

// ---- §3 오탐 방지 ----
// 컵노트 단어
check('fp:다크초콜릿', extractRoastLevel('다크 초콜릿의 짙은 단맛과 기분 좋은 쓴맛'), '');
check('fp:다크초콜릿2', extractRoastLevel('컵노트: 다크초콜릿, 카카오'), '');
check('fp:다크체리', extractRoastLevel('다크체리, 베리'), '');
check('fp:라이트바디', extractRoastLevel('라이트 바디의 깔끔한 커피'), '');
// 라인·상품명 단어
check('fp:필디카프다크', extractRoastLevel('필디카프 다크 고소한 디카페인 블렌드 원두'), '');
check('fp:다크우드', extractRoastLevel('다크우드 블렌드 200g'), '');
check('fp:darkwood', extractRoastLevel('데이빗 달링의 Dark Wood를 들으며'), '');
check('fp:다크브라운', extractRoastLevel('베스트 셀러 다크 브라운을 만나보세요'), '');
check('fp:다크딥', extractRoastLevel('다크딥 블랜딩'), '');
check('fp:다크딥2', extractRoastLevel('[] 다크딥 블랜딩 (해외배송 가능상품) 상품명 다크딥 블랜딩'), '');
check('fp:question', extractRoastLevel('다크로스팅인가요?'), '');
check('fp:question2', extractRoastLevel('이 원두는 다크로스팅인가요? 네, 다크 로스팅입니다.'), 'Dark');
check('fp:question3', extractRoastLevel('약배전인가요?'), '');
check('fp:question4', extractRoastLevel('중강배전인가요?'), '');
check('fp:question5', extractRoastLevel('미디움인가요?'), '');
// 날짜·기간
check('fp:로스팅날짜', extractRoastLevel('로스팅 날짜를 확인하세요'), '');
check('fp:로스팅후', extractRoastLevel('로스팅 후 3일 이내 발송'), '');
check('fp:로스팅일', extractRoastLevel('로스팅일: 2026-09-20'), '');
// 복수 선택 옵션 → 비움
check('fp:라이트다크선택', extractRoastLevel('라이트/다크 선택'), '');
check('fp:라이트다크선택2', extractRoastLevel('라이트·다크 중 선택하세요'), '');
check('fp:약배전강배전', extractRoastLevel('약배전 또는 강배전'), '');
// 매핑 불확실 라벨 → 비움
check('fp:welldone', extractRoastLevel('볶음도 Well-done'), '');
check('fp:welldone2', extractRoastLevel('Well-done'), '');
check('fp:웰던', extractRoastLevel('웰던'), '');
// 프렌치프레스 (추출기구)
check('fp:프렌치프레스', extractRoastLevel('프렌치프레스 (굵은분쇄)'), '');
// 시나몬/이탈리안 (컵노트·스타일명)
check('fp:시나몬', extractRoastLevel('시나몬 게이트 원두'), '');
check('fp:이탈리안', extractRoastLevel('클래식 이탈리안 스타일 피렌체'), '');
// 배전도 단독 (값 없음) → 비움
check('fp:배전도단독', extractRoastLevel('배전도에 따라 온수 온도를 선택하세요'), '');
// 빈 입력
check('empty', extractRoastLevel(''), '');
check('empty2', extractRoastLevel('일반 원두 200g'), '');

// ---- getDisplayRoastLevel: 저장값 절대 덮어쓰기 금지 ----
check('display:keep-Dark', getDisplayRoastLevel({ roastLevel: 'Dark', productName: '라이트 로스트' }), 'Dark');
check('display:keep-Medium', getDisplayRoastLevel({ roastLevel: 'Medium', productName: '다크 로스트' }), 'Medium');
check('display:fill-unknown', getDisplayRoastLevel({ roastLevel: '확인 필요', productName: '라이트 로스트' }), 'Light');
check('display:fill-empty', getDisplayRoastLevel({ roastLevel: '', productName: '다크 로스트' }), 'Dark');
check('display:fill-baejun', getDisplayRoastLevel({ roastLevel: '확인 필요', productName: '에티오피아 중강배전 원두' }), 'Medium-Dark');
check('display:bare-dark-name', getDisplayRoastLevel({ roastLevel: '확인 필요', productName: '다크브라운' }), '');
check('display:line-dark-name', getDisplayRoastLevel({ roastLevel: '확인 필요', productName: '[에어리커피] 다크 블렌드' }), '');
check('display:still-unknown', getDisplayRoastLevel({ roastLevel: '확인 필요', productName: '일반 원두' }), '');
check('isUnknown', isRoastLevelUnknown('확인 필요'), true);
check('isUnknown2', isRoastLevelUnknown(''), true);
check('isUnknown3', isRoastLevelUnknown('Light'), false);
check('levels', ROAST_LEVELS.join(','), 'Light,Medium-Light,Medium,Medium-Dark,Dark');

// ---- 상세 텍스트용 엄격 추출: 컵노트·바디감·산미 표현은 로스팅이 아니다 ----
const DETAIL_NOT_ROAST = [
  'CUP NOTE: Dark Chocolate, Caramel, Nuts',
  'Dark chocolate, black cherry',
  '다크 초콜렛, 캐러멜',
  'Body: Medium / Acidity: High',
  '미디엄 바디의 부드러운 커피',
  'Light body, floral',
  '라이트한 산미와 단맛',
  'medium acidity, juicy',
  'Medium Dark Chocolate',
  '로스팅 날짜: 매주 화요일',
  '라이트 로스트 / 다크 로스트 선택',
];
for (const text of DETAIL_NOT_ROAST) check(`detail-not-roast:${text}`, extractRoastLevelFromDetail(text), '');
const DETAIL_ROAST = [
  ['원두 로스팅 포인트: 미디엄', 'Medium'],
  ['Roast level: Medium-Dark', 'Medium-Dark'],
  ['로스팅 단계 : 라이트 / 바디: 미디엄', 'Light'],
  ['배전도 : 중강배전', 'Medium-Dark'],
  ['Dark Roast', 'Dark'],
  ['미디엄 로스트로 볶았습니다. 컵노트: 다크초콜릿', 'Medium'],
  ['라이트 로스트 / 노트: Dark chocolate', 'Light'],
];
for (const [text, level] of DETAIL_ROAST) check(`detail-roast:${text}`, extractRoastLevelFromDetail(text), level);

// ---- .js/.cjs 동일성 (export 구문 외) ----
const ROOT = join(dirname(__filename), '..');
const js = readFileSync(join(ROOT, 'src/services/roastLevel.js'), 'utf8')
  .split('\n').filter((l) => l !== 'export {' && l !== '};').join('\n');
const cjs = readFileSync(join(ROOT, 'src/services/roastLevel.cjs'), 'utf8')
  .split('\n').filter((l) => l !== 'module.exports = {' && l !== '};').join('\n');
check('js-cjs-identical', js === cjs, true);

// ---- .js ESM 로드 확인 ----
import('../src/services/roastLevel.js').then((m) => {
  check('esm:extract', m.extractRoastLevel('로스팅 강배전'), 'Dark');
  check('esm:display', m.getDisplayRoastLevel({ roastLevel: '확인 필요', productName: '미디엄 로스트' }), 'Medium');
  console.log(`roast-level:test — ${pass} checks passed`);
}).catch((e) => { console.error('ESM load FAIL', e); process.exitCode = 1; });
