const fs = require('node:fs');
const esbuild = require('esbuild');
const { _test } = require('../electron/naverShoppingSearch.cjs');
const tastingNoteTools = require('../src/services/tastingNotes.cjs');
require('./test-tasting-note-evidence.cjs');

function loadTsModule(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const output = esbuild.transformSync(code, { loader: 'ts', format: 'cjs', target: 'es2020' }).code;
  const module = { exports: {} };

  new Function('exports', 'module', 'require', output)(module.exports, module, (request) => {
    if (String(request).includes('tastingNotes')) return tastingNoteTools;
    if (String(request).includes('roastLevel')) return require('../src/services/roastLevel.cjs');
    return {};
  });
  return module.exports;
}

const terarosaTest = loadTsModule('src/services/adapters/terarosaOfficialAdapter.ts');

const fixtures = [
  {
    name: '다크초콜릿 보존',
    kind: 'ocr',
    input: 'CUPPING NOTE 레몬 부드러운 질감 다크초콜릿 원산지 에티오피아',
    expected: ['레몬', '다크초콜릿'],
    forbidden: ['초콜릿', '견과류', '단맛'],
  },
  {
    name: '참깨 구운빵 다크초콜릿',
    kind: 'ocr',
    input: 'PROCESS 내추럴 CUPPING NOTE 참께 구운빵 다크초콜릿 원산지 브라질',
    expected: ['참깨', '구운빵', '다크초콜릿'],
    forbidden: ['초콜릿', '견과류', '단맛'],
  },
  {
    name: '볶은아몬드와 캐러멜',
    kind: 'ocr',
    input: 'CUPPING NOTE 캐러멜 볶은아몬드 부드러운 원산지 콜롬비아 다크 초콜릿의 쌉싸름',
    expected: ['캐러멜', '볶은아몬드'],
    forbidden: ['견과류', '단맛'],
  },
  {
    name: '해시태그 컵노트',
    kind: 'ocr',
    input: 'Taste Scale 단맛 신맛 바디감 Taste Note #디카페인#견과류#초콜릿#달콤한',
    expected: ['견과류', '초콜릿'],
    forbidden: ['디카페인', '단맛'],
  },
  {
    name: '해시태그 뒤 설명문 무시',
    kind: 'ocr',
    input: 'Taste Note #디카페인#견과류#초콜릿#달콤한 고소한 아몬드와 밀크 초콜릿의 단맛이 느껴집니다',
    expected: ['견과류', '초콜릿'],
    forbidden: ['디카페인', '단맛', '아몬드', '밀크초콜릿'],
  },
  {
    name: '루비아 갤러리 카드 달콤함',
    kind: 'anywhere',
    input: 'notes 헤이즐넛 견과류 초콜릿 달콤함',
    expected: ['헤이즐넛', '견과류', '초콜릿'],
    forbidden: ['단맛'],
  },
  {
    name: '축 라벨(단맛·신맛)은 향미 노트 금지',
    kind: 'normalize',
    input: ['단맛', '신맛', '초콜릿'],
    expected: ['초콜릿'],
    forbidden: ['단맛', '신맛'],
  },
  {
    name: '달콤한 설명문 단맛 오인 금지',
    kind: 'anywhere',
    input: '달콤한 초콜릿 케이크처럼 부드러운 플레이버드 블렌드',
    expected: ['초콜릿'],
    forbidden: ['단맛'],
  },
  {
    name: '상품명 추측 금지',
    kind: 'title',
    input: '고소하고 진한 루비아 다크 브라운 홀빈, 1kg, 1개',
    expected: [],
    forbidden: ['견과류', '단맛', '초콜릿'],
  },
  {
    name: '테라로사 상세 이미지 Tasting Note',
    kind: 'terarosa',
    input: 'Tasting Note\nDried Fruits,\nSoft,\nSweet Acidity,\nLong Aftertaste\n테라로사 커피 250g',
    expected: ['건과일', '달콤한 산미', '부드러움', '긴 여운'],
    forbidden: ['Sweet'],
  },
  {
    name: '테라로사 KING콩 Tasting Note',
    kind: 'terarosa',
    input: 'Tasting Note\nPecan, Baked Apple, Butterscotch',
    expected: ['피칸', '구운 사과', '버터스카치'],
    forbidden: ['사과', '단맛'],
  },
  {
    name: '테라로사 Flavor & Aroma',
    kind: 'terarosa',
    input: 'Flavor & Aroma\n오렌지, 말린자두, 캐슈넛, 화이트 초콜릿\nOrange, Prune, Cashew Nut, White Chocolate\n산미 Acidity',
    expected: ['오렌지', '말린자두', '캐슈넛', '화이트 초콜릿'],
    forbidden: ['초콜릿', '견과류'],
  },
  {
    name: '테라로사 요약문 추측 금지',
    kind: 'terarosa-detail',
    input: '<input id="ItemName" value="테라로사 테스트 원두"><input id="ItemPrice" value="10000"><div class="product_view_text_wrap"><div class="cont_title_info">버터스카치의 부드러운 단맛과 사과의 산뜻한 산미가 어우러진 커피</div></div>',
    expected: [],
    forbidden: ['단맛', '사과', '버터스카치'],
  },
  {
    name: '나라명 제거',
    kind: 'normalize',
    input: ['Brazil', 'Ethiopia', 'Kenya'],
    expected: [],
    forbidden: ['Brazil', 'Ethiopia', 'Kenya', '브라질', '에티오피아', '케냐'],
  },
  {
    name: '영문 노트 한글 통일',
    kind: 'normalize',
    input: ['Brazil', 'Chocolate', 'Orange'],
    expected: ['초콜릿', '오렌지'],
    forbidden: ['Brazil', 'Chocolate', 'Orange'],
  },
  {
    name: '베르크 향미 한글 통일',
    kind: 'normalize',
    input: ['Grapefruit, Tomato, Maple Syrup'],
    expected: ['자몽', '토마토', '메이플시럽'],
    forbidden: ['Grapefruit', 'Tomato', 'Maple Syrup'],
  },
  {
    name: '센터커피 향미 한글 통일',
    kind: 'normalize',
    input: ['Shine Muscat · Melon · Green Apple'],
    expected: ['샤인머스캣', '멜론', '청사과'],
    forbidden: ['Shine Muscat', 'Melon', 'Green Apple', '사과'],
  },
  {
    name: '테라로사 노트 한글 통일',
    kind: 'normalize',
    input: ['Dried Fruits', 'Sweet Acidity', 'Soft', 'Long Aftertaste'],
    expected: ['건과일', '달콤한 산미', '부드러움', '긴 여운'],
    forbidden: ['Dried Fruits', 'Sweet Acidity', 'Soft', 'Long Aftertaste', 'Sweet'],
  },
  {
    name: '짧은 한글 별칭 오매칭 차단 - 배전 오염',
    kind: 'normalize',
    input: ['중강배전으로 볶은 깊은 단맛'],
    expected: [],
    forbidden: ['배', '단맛'],
  },
  {
    name: '짧은 한글 별칭 오매칭 차단 - 차이 오염',
    kind: 'normalize',
    input: ['두 맛의 차이가 확연합니다'],
    expected: [],
    forbidden: ['차'],
  },
  {
    name: '짧은 한글 별칭 오매칭 차단 - 짚고 오염',
    kind: 'normalize',
    input: ['짚고 넘어가야 할 특징'],
    expected: [],
    forbidden: ['짚'],
  },
  {
    name: '짧은 한글 별칭 정상 매칭 - 배향 보존',
    kind: 'normalize',
    input: ['배향이 은은하게 퍼지는'],
    expected: ['배'],
    forbidden: [],
  },
  {
    name: '짧은 한글 별칭 정상 매칭 - 녹차 보존',
    kind: 'normalize',
    input: ['녹차의 쌉싸름함'],
    expected: ['녹차'],
    forbidden: [],
  },
  {
    name: '짧은 한글 별칭 정상 매칭 - 꿀 보존',
    kind: 'normalize',
    input: ['꿀처럼 달콤한'],
    expected: ['꿀'],
    forbidden: [],
  },
  {
    name: '짧은 한글 별칭 정상 매칭 - 류 접미사 보존(베리류)',
    kind: 'normalize',
    input: ['베리류의 상큼한 산미'],
    expected: ['베리'],
    forbidden: [],
  },
  {
    name: '적사과 매칭 검증',
    kind: 'normalize',
    input: ['적사과, 오렌지, 캐러멜, 밀크초콜릿'],
    expected: ['사과', '오렌지', '캐러멜', '밀크초콜릿'],
    forbidden: [],
  },
  {
    name: '영문 red apple 매칭 검증',
    kind: 'normalize',
    input: ['red apple, orange, caramel, milk chocolate'],
    expected: ['사과', '오렌지', '캐러멜', '밀크초콜릿'],
    forbidden: [],
  },
  {
    name: '영문 redapple 매칭 검증',
    kind: 'normalize',
    input: ['redapple, orange, caramel, milk chocolate'],
    expected: ['사과', '오렌지', '캐러멜', '밀크초콜릿'],
    forbidden: [],
  },
  {
    name: '건포도 겹침 제거 - 포도 중복 방지',
    kind: 'normalize',
    input: ['다크코코아, 건포도, 실키바디'],
    expected: ['건포도', '초콜릿'],
    forbidden: ['포도'],
  },
  {
    name: '블랙커런트 겹침 제거 - 커런트 중복 방지',
    kind: 'normalize',
    input: ['Tasting Note: Black Currant, Peach'],
    expected: ['블랙커런트', '복숭아'],
    forbidden: ['까치밥'],
  },
  {
    name: '로즈힙 겹침 제거 - 장미 중복 방지',
    kind: 'normalize',
    input: ['Tasting Note: Rose Hip'],
    expected: ['로즈힙'],
    forbidden: ['장미'],
  },
  {
    name: '백차 겹침 제거 - 차 중복 방지',
    kind: 'normalize',
    input: ['Tasting Note: White Tea'],
    expected: ['백차'],
    forbidden: ['차'],
  },
  {
    name: '라벤더 올리브 정규화 검증',
    kind: 'normalize',
    input: ['체리, 라벤더, 올리브, 바닐라'],
    expected: ['체리', '라벤더', '올리브', '바닐라'],
    forbidden: [],
  },
  {
    name: '라벤더 올리브 OCR 후보 사전 검증',
    kind: 'anywhere',
    input: 'TASTING CARD cherry lavender olive vanilla',
    expected: ['체리', '라벤더', '올리브', '바닐라'],
    forbidden: [],
  },
  {
    name: '502 7월 커피 명시 노트 정규화',
    kind: 'normalize',
    input: ['로즈', '엘더플라워', '피치', '망고스틴'],
    expected: ['로즈', '엘더플라워', '피치', '망고스틴'],
    forbidden: [],
  },
  {
    name: '필브라운 공식 명시 노트 정규화',
    kind: 'normalize',
    input: ['견과류', '카라멜', '갈색설탕'],
    expected: ['브라운슈가', '캐러멜', '견과류'],
    forbidden: [],
  },
  {
    name: '테라로사 슬리피 캣 상세 이미지 노트',
    kind: 'terarosa',
    input: 'Tasting Note Sweet Pumpkin, Walnut, Brown Sugar, Nutty',
    expected: ['브라운슈가', '호박', '견과류', '호두'],
    forbidden: ['단맛'],
  },
  {
    name: '테라로사 하우스 드립 상세 이미지 노트',
    kind: 'terarosa',
    input: 'Tasting Note Roasted Nuts, Sweet Fruits, Well Balanced',
    expected: ['구운향', '견과류'],
    forbidden: ['단맛'],
  },
  {
    name: '테라로사 상세 HTML이 OCR 마지막 노트를 삼키지 않음',
    kind: 'terarosa-detail',
    input: `
      <input id="ItemName" value="브라질 슬리피 캣 디카페인">
      <div class="product_view_text_wrap">
        <div class="cont_title_info">Brazil Sleepy Cat 상세 상품 설명</div>
      </div>
    `,
    ocrText: 'Tasting Note: 브라운슈가, 호박, 호두',
    expected: ['브라운슈가', '호박', '호두'],
    forbidden: [],
  },
  {
    name: '테라로사 단일 OCR 노트를 상세 HTML과 분리',
    kind: 'terarosa-detail',
    input: `
      <input id="ItemName" value="하우스 드립 블렌드">
      <div class="product_view_text_wrap">
        <div class="cont_title_info">Blend 상세 상품 설명</div>
      </div>
    `,
    ocrText: 'Tasting Note: 견과류',
    expected: ['견과류'],
    forbidden: [],
  },
];

let falsePositiveCount = 0;
let displayedNoteCount = 0;
const failures = [];

fixtures.forEach((fixture) => {
  const notes = fixture.kind === 'title'
    ? _test.getTasteNotes(fixture.input)
    : fixture.kind === 'terarosa'
      ? terarosaTest.parseExplicitTastingNotes(fixture.input)
      : fixture.kind === 'terarosa-detail'
        ? terarosaTest.parseTerarosaDetailProduct(fixture.input, 'https://example.com', fixture.ocrText || '').tastingNotes
        : fixture.kind === 'normalize'
          ? tastingNoteTools.normalizeTastingNotes(fixture.input, { limit: Infinity })
          : fixture.kind === 'anywhere'
            ? _test.extractFlavorNotesAnywhere(fixture.input)
            : _test.extractOcrTasteNotes(fixture.input);
  const missing = fixture.expected.filter((note) => !notes.includes(note));
  const forbidden = fixture.forbidden.filter((note) => notes.includes(note));
  const allowed = new Set(fixture.expected);
  const falsePositives = notes.filter((note) => !allowed.has(note));

  displayedNoteCount += notes.length;
  falsePositiveCount += falsePositives.length;

  if (missing.length > 0 || forbidden.length > 0) {
    failures.push({
      name: fixture.name,
      notes,
      missing,
      forbidden,
    });
  }
});

const precision = displayedNoteCount === 0
  ? 1
  : (displayedNoteCount - falsePositiveCount) / displayedNoteCount;

console.log(`컵노트 표시 정확도: ${(precision * 100).toFixed(1)}%`);

if (failures.length > 0 || precision < 0.95) {
  failures.forEach((failure) => {
    console.error(`실패: ${failure.name}`);
    console.error(`  결과: ${failure.notes.join(', ') || '(없음)'}`);
    if (failure.missing.length > 0) console.error(`  빠짐: ${failure.missing.join(', ')}`);
    if (failure.forbidden.length > 0) console.error(`  금지 노트 표시됨: ${failure.forbidden.join(', ')}`);
  });
  process.exitCode = 1;
}

// 표시용 컵노트는 원문 증거의 영어 표기를 그대로 노출하지 않고 한글 정규 라벨을 사용한다.
const displayLanguageFixture = {
  tastingNotes: ['초콜릿', '건포도', '부드러움'],
  tastingNoteEvidence: [
    { text: 'Dark Cacao', sourceUrl: 'https://example.com/source', method: 'detail-text' },
    { text: 'Raisin', sourceUrl: 'https://example.com/source', method: 'detail-text' },
    { text: 'Silky Body', sourceUrl: 'https://example.com/source', method: 'detail-text' },
  ],
};
const displayLanguageNotes = tastingNoteTools.getDisplayTastingNotes(displayLanguageFixture);
const missingDisplayLanguageNotes = ['초콜릿', '건포도', '부드러움'].filter((note) => !displayLanguageNotes.includes(note));
if (missingDisplayLanguageNotes.length > 0 || displayLanguageNotes.some((note) => /[A-Za-z]/.test(note))) {
  console.error(`표시용 컵노트 한글화 실패: ${displayLanguageNotes.join(', ') || '(없음)'}`);
  process.exitCode = 1;
} else {
  console.log(`표시용 컵노트 한글화 통과: ${displayLanguageNotes.join(', ')}`);
}

// === getAcidityScore 단위 테스트 ===
console.log('getAcidityScore 계약 검증 시작...');
const scoreTests = [
  { notes: ['블루베리', '자스민'], expectedSign: 1 },
  { notes: ['견과류', '초콜릿'], expectedSign: -1 },
  { notes: ['청사과', '캐러멜'], expectedNearZero: true },
  { notes: [], expectedNull: true },
  { notes: ['확인 필요'], expectedNull: true }
];

let scoreFailures = 0;
scoreTests.forEach((t, i) => {
  const score = tastingNoteTools.getAcidityScore(t.notes);
  if (t.expectedNull) {
    if (score !== null) {
      console.error(`getAcidityScore 실패 [${i}]: null 기대하였으나 ${score} 반환됨`);
      scoreFailures++;
    }
  } else if (t.expectedSign === 1) {
    if (score === null || score <= 0) {
      console.error(`getAcidityScore 실패 [${i}]: 양수(산미형) 기대하였으나 ${score} 반환됨 (입력: ${t.notes.join(', ')})`);
      scoreFailures++;
    }
  } else if (t.expectedSign === -1) {
    if (score === null || score >= 0) {
      console.error(`getAcidityScore 실패 [${i}]: 음수(고소형) 기대하였으나 ${score} 반환됨 (입력: ${t.notes.join(', ')})`);
      scoreFailures++;
    }
  } else if (t.expectedNearZero) {
    if (score === null || Math.abs(score) > 0.5) {
      console.error(`getAcidityScore 실패 [${i}]: 0 근처(밸런스) 기대하였으나 ${score} 반환됨 (입력: ${t.notes.join(', ')})`);
      scoreFailures++;
    }
  }
});

if (scoreFailures > 0) {
  console.error(`getAcidityScore 검증 실패: 총 ${scoreFailures}건 오류`);
  process.exitCode = 1;
} else {
  console.log('getAcidityScore 검증 통과');
}

const acidityRedesignChecks = [];
const closeAcidity = (actual, expected) => actual !== null && Math.abs(actual - expected) < 1e-12;
function checkAcidityRedesign(rule, condition) {
  acidityRedesignChecks.push({ rule, passed: Boolean(condition) });
}

const acidityCore = loadTsModule('src/services/coreFeatures.js');
checkAcidityRedesign('공식 막대는 산미만 선형 변환', [5, 10].every((max) =>
  [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1].every((ratio) =>
    [0, 1, 4, 5, undefined].every((sweetness) => closeAcidity(
      tastingNoteTools.getTasteScaleAcidityScore({ acidity: ratio * max, sweetness, max }),
      2 * ratio - 1,
    )))));
checkAcidityRedesign('산미 없는 단맛 막대는 점수 근거 아님', [undefined, null, '', ' ', true, NaN, Infinity].every((acidity) =>
  tastingNoteTools.getTasteScaleAcidityScore({ acidity, sweetness: 4, max: 5 }) === null));
checkAcidityRedesign('공식 막대 경계와 숫자 문자열',
  closeAcidity(tastingNoteTools.getTasteScaleAcidityScore({ acidity: '0', max: '5' }), -1)
  && closeAcidity(tastingNoteTools.getTasteScaleAcidityScore({ acidity: 6, max: 5 }), 1)
  && closeAcidity(tastingNoteTools.getTasteScaleAcidityScore({ acidity: -1, max: 5 }), -1)
  && [0, -1, 'bad', Infinity].every((max) => tastingNoteTools.getTasteScaleAcidityScore({ acidity: 4, max }) === null));

for (const [note, weight] of [
  ['블루베리', 1], ['자스민', 0.8], ['요구르트', 0.8], ['허브', 0], ['계피', 0],
  ['꿀', -0.6], ['구운향', -0.7], ['견과류', -1], ['묵직', 0],
]) {
  checkAcidityRedesign(`그룹 가중치: ${note}`, closeAcidity(tastingNoteTools.getAcidityScore([note]), weight / 1.5));
}
checkAcidityRedesign('시트러스와 청사과는 강한 산미 단서',
  ['자몽', '오렌지', '레몬', '라임', '시트러스', '감귤', '유자', '청사과'].every((note) =>
    closeAcidity(tastingNoteTools.getAcidityScore([note]), 0.9 / 1.5)));
checkAcidityRedesign('말린 과일과 구운 사과는 약한 산미 단서',
  ['건과일', '건포도', '말린자두', '대추야자', '무화과', '구운 사과'].every((note) =>
    closeAcidity(tastingNoteTools.getAcidityScore([note]), 0.2 / 1.5)));
const sparseAcidity = [
  ['레몬'], ['레몬', '라임'], ['레몬', '라임', '자몽'],
].map((notes) => tastingNoteTools.getAcidityScore(notes));
checkAcidityRedesign('노트가 적으면 중립 쪽으로 축소',
  closeAcidity(sparseAcidity[0], 0.6) && closeAcidity(sparseAcidity[1], 1.8 / 2.5)
  && closeAcidity(sparseAcidity[2], 2.7 / 3.5));
checkAcidityRedesign('중복과 미인식 노트는 근거 수를 늘리지 않음',
  closeAcidity(tastingNoteTools.getAcidityScore(['레몬', '레몬', '확인 필요']), sparseAcidity[0]));

const roastOffsets = { Light: 0.08, 'Medium-Light': 0.04, Medium: 0, 'Medium-Dark': -0.1, Dark: -0.15 };
for (const [roastLevel, offset] of Object.entries(roastOffsets)) {
  checkAcidityRedesign(`로스팅 보정: ${roastLevel}`,
    closeAcidity(tastingNoteTools.getAcidityScore(['레몬'], roastLevel), (0.9 + offset) / 1.5)
    && tastingNoteTools.getAcidityScore([], roastLevel) === null);
}
checkAcidityRedesign('모르는 로스팅은 보정 없음',
  closeAcidity(tastingNoteTools.getAcidityScore(['레몬'], '확인 필요'), sparseAcidity[0])
  && closeAcidity(tastingNoteTools.getAcidityScore(['레몬'], '__proto__'), sparseAcidity[0]));
const redesignedProducts = acidityCore.normalizeProducts([
  { id: 'redesign-notes', tastingNotes: ['레몬'], roastLevel: 'Dark', acidityScore: -0.9 },
  { id: 'redesign-scale', tastingNotes: ['견과류'], roastLevel: 'Dark', tasteScale: { acidity: 4, sweetness: 4, max: 5 } },
  { id: 'redesign-none', tastingNotes: [], roastLevel: 'Light' },
  { id: 'redesign-sweet-only', tastingNotes: ['레몬'], roastLevel: 'Dark', tasteScale: { sweetness: 4 } },
]);
checkAcidityRedesign('상품은 현재 노트와 로스팅으로 다시 계산', closeAcidity(redesignedProducts[0].acidityScore, 0.5));
checkAcidityRedesign('공식 막대 우선이며 노트와 로스팅 보정 없음',
  closeAcidity(redesignedProducts[1].acidityScore, 0.6) && redesignedProducts[1].acidityScoreSource === 'tasteScale');
checkAcidityRedesign('로스팅만 있으면 점수 없음', redesignedProducts[2].acidityScore === null);
checkAcidityRedesign('단맛만 있으면 노트로 계산하고 출처 유지',
  closeAcidity(redesignedProducts[3].acidityScore, 0.5) && redesignedProducts[3].acidityScoreSource === 'tastingNotes');
const roastGroupInput = [
  { id: 'redesign-200', roasterName: '산미 검사', productName: '검사 원두 200g', price: 16000, weight: 200, roastLevel: 'Dark', tastingNotes: ['레몬'] },
  { id: 'redesign-500', roasterName: '산미 검사', productName: '검사 원두 500g', price: 36000, weight: 500, roastLevel: 'Dark', tastingNotes: ['라임'] },
];
const roastGroupBefore = JSON.stringify(roastGroupInput);
const [redesignedGroup] = acidityCore.groupProductsByNameAndWeight(roastGroupInput);
checkAcidityRedesign('묶인 상품도 합친 노트와 로스팅으로 계산', closeAcidity(redesignedGroup.acidityScore, 0.6));
checkAcidityRedesign('계산은 원본 상품을 변경하지 않음', JSON.stringify(roastGroupInput) === roastGroupBefore);
const renamedProducts = acidityCore.normalizeProducts([
  { id: 'neutral-name', productName: '검사 원두', tastingNotes: ['레몬'], roastLevel: 'Dark' },
  { id: 'different-id', productName: '고소 다크 산미 검사', tastingNotes: ['레몬'], roastLevel: 'Dark' },
]);
checkAcidityRedesign('상품명과 id에 따른 산미 예외 없음', renamedProducts[0].acidityScore === renamedProducts[1].acidityScore);
checkAcidityRedesign('가중치가 상쇄되면 부동소수점 오차도 0으로 처리',
  tastingNoteTools.getAcidityScore(['블루베리', '견과류']) === 0);
const inferredRoastProducts = acidityCore.normalizeProducts([
  { tastingNotes: ['레몬'], roastLevel: '확인 필요', productName: '검사 원두 다크 로스트' },
  { tastingNotes: ['레몬'], roastLevel: '확인 필요', productName: '검사 원두 다크 블렌드' },
]);
checkAcidityRedesign('명시된 로스트 표기는 기존 로스팅 판정 재사용', closeAcidity(inferredRoastProducts[0].acidityScore, 0.5));
checkAcidityRedesign('다크라는 이름만으로 로스팅을 추측하지 않음', closeAcidity(inferredRoastProducts[1].acidityScore, 0.6));

const acidityRedesignFailed = acidityRedesignChecks.filter((check) => !check.passed);
console.log(`[acidity-redesign] ${JSON.stringify({ total: acidityRedesignChecks.length, passed: acidityRedesignChecks.length - acidityRedesignFailed.length, failed: acidityRedesignFailed.length, checks: acidityRedesignChecks })}`);
if (acidityRedesignFailed.length) process.exitCode = 1;

