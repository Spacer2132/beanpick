const fs = require('node:fs');
const esbuild = require('esbuild');
const { _test } = require('../electron/naverShoppingSearch.cjs');
const tastingNoteTools = require('../src/services/tastingNotes.cjs');

function loadTsModule(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const output = esbuild.transformSync(code, { loader: 'ts', format: 'cjs', target: 'es2020' }).code;
  const module = { exports: {} };

  new Function('exports', 'module', 'require', output)(module.exports, module, (request) => {
    if (String(request).includes('tastingNotes')) return tastingNoteTools;
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
        ? terarosaTest.parseTerarosaDetailProduct(fixture.input, 'https://example.com').tastingNotes
        : fixture.kind === 'normalize'
          ? tastingNoteTools.normalizeTastingNotes(fixture.input, { limit: Infinity })
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
