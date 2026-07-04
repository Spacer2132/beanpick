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
  {
    name: '짧은 한글 별칭 오매칭 차단 - 배전 오염',
    kind: 'normalize',
    input: ['중강배전으로 볶은 깊은 단맛'],
    expected: ['단맛'],
    forbidden: ['배'],
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

