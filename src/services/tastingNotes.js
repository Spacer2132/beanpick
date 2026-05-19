const NOTE_GROUPS = {
  fruit: 0,
  floral: 1,
  sweet: 2,
  nutty: 3,
  body: 4,
};

const COUNTRY_ALIASES = [
  'brazil',
  'brasil',
  '브라질',
  'ethiopia',
  '에티오피아',
  'kenya',
  '케냐',
  'colombia',
  '콜롬비아',
  'guatemala',
  '과테말라',
  'india',
  '인도',
  'mexico',
  '멕시코',
  'nicaragua',
  '니카라과',
  'rwanda',
  '르완다',
  'honduras',
  '온두라스',
  'costa rica',
  '코스타리카',
  'el salvador',
  '엘살바도르',
  'peru',
  '페루',
  'panama',
  '파나마',
  'bolivia',
  '볼리비아',
  'indonesia',
  '인도네시아',
  'papua new guinea',
  '파푸아뉴기니',
  'yemen',
  '예멘',
  'thailand',
  '태국',
];

const NON_TASTE_ALIASES = [
  'co',
  'gt',
  '확인 필요',
  '확인필요',
  '디카페인',
  'decaf',
  'decaffeinated',
  '블렌드',
  'blend',
  'season blend',
  'single origin',
  '싱글오리진',
  'natural',
  'washed',
  'anaerobic',
  'pulped natural',
  'honey process',
  'black honey',
  '커피',
  '원두',
  'coffee',
  'bean',
  'beans',
  'espresso',
  '스페셜티',
  'specialty',
  '강배전',
  '중강배전',
  '중배전',
  '약배전',
  '도매전용',
  '도매',
  '메모',
  'mwp',
  'automatic',
  '자동',
  'black',
  '블랙',
];

const NOTE_RULES = [
  { label: '자몽', group: 'fruit', aliases: ['grapefruit', '자몽'] },
  { label: '토마토', group: 'fruit', aliases: ['tomato', '토마토'] },
  { label: '오렌지', group: 'fruit', aliases: ['orange', '오렌지'] },
  { label: '레몬', group: 'fruit', aliases: ['lemon', '레몬'] },
  { label: '라임', group: 'fruit', aliases: ['lime', '라임'] },
  { label: '시트러스', group: 'fruit', aliases: ['citrus', '시트러스'] },
  { label: '베리', group: 'fruit', aliases: ['berry', 'berries', '베리'] },
  { label: '블루베리', group: 'fruit', aliases: ['blueberry', '블루베리'] },
  { label: '딸기', group: 'fruit', aliases: ['strawberry', '딸기'] },
  { label: '라즈베리', group: 'fruit', aliases: ['raspberry', '라즈베리'] },
  { label: '체리', group: 'fruit', aliases: ['cherry', '체리'] },
  { label: '멜론', group: 'fruit', aliases: ['melon', '멜론'] },
  { label: '구운 사과', group: 'fruit', aliases: ['baked apple', 'baked apples', '구운 사과'] },
  { label: '사과', group: 'fruit', aliases: ['apple', '사과'] },
  { label: '청사과', group: 'fruit', aliases: ['green apple', 'greenapple', '청사과'] },
  { label: '배', group: 'fruit', aliases: ['pear', '배'] },
  { label: '복숭아', group: 'fruit', aliases: ['peach', '복숭아', '백도'] },
  { label: '살구', group: 'fruit', aliases: ['apricot', '살구', '살구 주스', '살구주스'] },
  { label: '천도복숭아', group: 'fruit', aliases: ['nectarine', '천도복숭아'] },
  { label: '열대과일', group: 'fruit', aliases: ['tropical fruit', 'tropical fruits', 'tropical', '열대과일', '열대 과일'] },
  { label: '망고', group: 'fruit', aliases: ['mango', '망고'] },
  { label: '파인애플', group: 'fruit', aliases: ['pineapple', '파인애플'] },
  { label: '자두', group: 'fruit', aliases: ['plum', '자두'] },
  { label: '포도', group: 'fruit', aliases: ['grape', '포도'] },
  { label: '청포도', group: 'fruit', aliases: ['green grape', 'greengrape', '청포도'] },
  { label: '적포도', group: 'fruit', aliases: ['red grape', 'redgrape', '적포도'] },
  { label: '샤인머스캣', group: 'fruit', aliases: ['shine muscat', 'shinemuscat', '샤인머스캣', '샤인 머스캣'] },
  { label: '건과일', group: 'fruit', aliases: ['dried fruit', 'dried fruits', '건과일', '말린 과일'] },
  { label: '말린자두', group: 'fruit', aliases: ['prune', 'prunes', 'dried plum', 'dried plums', '말린자두', '말린 자두'] },
  { label: '대추야자', group: 'fruit', aliases: ['date', 'dates', '대추야자'] },
  { label: '리치', group: 'fruit', aliases: ['lychee', '리치'] },
  { label: '쥬시', group: 'fruit', aliases: ['juicy', '쥬시', '주시'] },
  { label: '달콤한 산미', group: 'fruit', aliases: ['sweet acidity', '달콤한 산미'] },
  { label: '청량감', group: 'fruit', aliases: ['sparkling', 'sparkly', '청량감', '스파클링'] },

  { label: '플로럴', group: 'floral', aliases: ['floral', 'flower', 'flowers', '플로럴'] },
  { label: '자스민', group: 'floral', aliases: ['jasmine', '자스민'] },
  { label: '베르가못', group: 'floral', aliases: ['bergamot', '베르가못'] },
  { label: '노란 백합', group: 'floral', aliases: ['yellow lily', '노란 백합'] },
  { label: '홍차', group: 'floral', aliases: ['black tea', 'blacktea', '홍차'] },
  { label: '녹차', group: 'floral', aliases: ['green tea', 'greentea', '녹차'] },
  { label: '차', group: 'floral', aliases: ['tea', 'tea-like', 'tea like', '차'] },
  { label: '다즐링티', group: 'floral', aliases: ['darjeeling', 'darjeeling tea', '다즐링티', '다즐링 티'] },

  { label: '다크초콜릿', group: 'sweet', aliases: ['dark chocolate', 'darkchocolate', 'dark choco', '다크초콜릿', '다크 초콜릿', '다크쵸콜릿'] },
  { label: '밀크초콜릿', group: 'sweet', aliases: ['milk chocolate', 'milkchocolate', 'milk choco', '밀크초콜릿', '밀크 초콜릿', '밀크쵸콜릿'] },
  { label: '화이트 초콜릿', group: 'sweet', aliases: ['white chocolate', 'whitechocolate', '화이트 초콜릿', '화이트초콜릿'] },
  { label: '초코무스', group: 'sweet', aliases: ['choco mousse', 'chocomousse', '초코무스'] },
  { label: '초콜릿', group: 'sweet', aliases: ['chocolate', 'choco', 'cacao', 'cocoa', '초콜릿', '초코', '카카오', '코코아'] },
  { label: '메이플시럽', group: 'sweet', aliases: ['maple syrup', 'maplesyrup', '메이플시럽', '메이플 시럽'] },
  { label: '캐러멜', group: 'sweet', aliases: ['caramel', '카라멜', '캐러멜', '캬라멜'] },
  { label: '달고나', group: 'sweet', aliases: ['dalgona', '달고나'] },
  { label: '당밀', group: 'sweet', aliases: ['molasses', '당밀'] },
  { label: '둘세데레체', group: 'sweet', aliases: ['dulce de leche', 'dulcedeleche', '둘세데레체'] },
  { label: '브라운슈가', group: 'sweet', aliases: ['brown sugar', 'brownsugar', '브라운슈가', '브라운 슈가'] },
  { label: '꿀', group: 'sweet', aliases: ['honey', '꿀'] },
  { label: '바닐라', group: 'sweet', aliases: ['vanilla', '바닐라'] },
  { label: '버터스카치', group: 'sweet', aliases: ['butterscotch', '버터스카치'] },
  { label: '코코넛', group: 'sweet', aliases: ['coconut', '코코넛'] },
  { label: '호박', group: 'sweet', aliases: ['pumpkin', '호박'] },
  { label: '단맛', group: 'sweet', aliases: ['sweet', 'sweetness', '단맛'] },

  { label: '견과류', group: 'nutty', aliases: ['nutty', 'nuts', 'nut', '견과류', '견과'] },
  { label: '참깨', group: 'nutty', aliases: ['sesame', '참깨'] },
  { label: '구운빵', group: 'nutty', aliases: ['toast', 'toasted bread', '구운빵', '구운 빵'] },
  { label: '볶은아몬드', group: 'nutty', aliases: ['roasted almond', 'roastedalmond', '볶은아몬드', '볶은 아몬드'] },
  { label: '아몬드', group: 'nutty', aliases: ['almond', '아몬드'] },
  { label: '캐슈넛', group: 'nutty', aliases: ['cashew nut', 'cashew nuts', 'cashew', '캐슈넛', '캐슈 너트'] },
  { label: '마카다미아', group: 'nutty', aliases: ['macadamia', '마카다미아'] },
  { label: '헤이즐넛', group: 'nutty', aliases: ['hazelnut', '헤이즐넛'] },
  { label: '피칸', group: 'nutty', aliases: ['pecan', '피칸'] },
  { label: '몰트', group: 'nutty', aliases: ['malt', 'malted', '몰트'] },

  { label: '부드러움', group: 'body', aliases: ['soft', 'smooth', 'silky', '부드러움', '부드러운 질감'] },
  { label: '크리미', group: 'body', aliases: ['creamy', '크리미'] },
  { label: '시러피', group: 'body', aliases: ['syrupy', '시러피'] },
  { label: '묵직', group: 'body', aliases: ['heavy', '묵직', '묵직한'] },
  { label: '와이니', group: 'body', aliases: ['winey', 'winy', 'wine', '와이니'] },
  { label: '긴 여운', group: 'body', aliases: ['long aftertaste', 'longaftertaste', '긴 여운', '긴여운'] },
];

const ALIAS_LOOKUP = new Map();
const LABEL_ORDER = new Map();
const LABEL_GROUP = new Map();

NOTE_RULES.forEach((rule, index) => {
  LABEL_ORDER.set(rule.label, index);
  LABEL_GROUP.set(rule.label, rule.group);
  rule.aliases.forEach((alias) => {
    ALIAS_LOOKUP.set(toKey(alias), rule.label);
  });
});

const BLOCKED_KEYS = new Set([...COUNTRY_ALIASES, ...NON_TASTE_ALIASES].map(toKey));

function toKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[#()[\]{}'"“”‘’]/g, '')
    .replace(/[·ㆍ•|/_,:;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCompactKey(value) {
  return toKey(value).replace(/[\s.-]+/g, '');
}

function isBlockedToken(value) {
  const key = toKey(value);
  const compactKey = toCompactKey(value);

  return BLOCKED_KEYS.has(key) || BLOCKED_KEYS.has(compactKey);
}

function isInvalidFreeText(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  if (/^메모\s*[:：]/i.test(text)) return true;
  if (/\d{2,4}\s*g\b|[0-9,]+\s*원|\$|₩/i.test(text)) return true;
  if (/상품|판매|가격|원두|커피|로스터리|공식몰|도매|displaynone|xans|href|img/i.test(text)) return true;
  if (/느껴|느껴지는|어우러|풍미|향미와|입안을|마무리|에스프레소|필터커피|제철|한정|세트/i.test(text) && text.length > 14) return true;
  return false;
}

function splitNoteText(value) {
  return String(value || '')
    .replace(/#/g, ',')
    .split(/[\n,;/|·ㆍ•]+/)
    .map((note) => note.replace(/\([^)]*\)/g, '').trim())
    .filter(Boolean);
}

function aliasAppearsInText(alias, textKey, compactTextKey) {
  const aliasKey = toKey(alias);
  const compactAlias = toCompactKey(alias);

  if (!aliasKey) return false;
  if (textKey === aliasKey || compactTextKey === compactAlias) return true;
  if (/^[a-z0-9 ]+$/.test(aliasKey)) {
    const escaped = aliasKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(textKey);
  }
  return compactTextKey.includes(compactAlias);
}

function findCanonicalNotes(value) {
  if (isBlockedToken(value) || isInvalidFreeText(value)) return [];

  const exact = ALIAS_LOOKUP.get(toKey(value)) || ALIAS_LOOKUP.get(toCompactKey(value));
  if (exact) return [exact];

  const textKey = toKey(value);
  const compactTextKey = toCompactKey(value);
  const matches = [];

  NOTE_RULES.forEach((rule) => {
    if (rule.aliases.some((alias) => aliasAppearsInText(alias, textKey, compactTextKey))) {
      matches.push(rule.label);
    }
  });

  return matches;
}

function removeOverlappingNotes(notes) {
  const set = new Set(notes);

  if (set.has('다크초콜릿') || set.has('밀크초콜릿') || set.has('화이트 초콜릿') || set.has('초코무스')) {
    set.delete('초콜릿');
  }
  if (set.has('캐슈넛')) {
    set.delete('견과류');
  }
  if (set.has('볶은아몬드')) {
    set.delete('아몬드');
  }
  if (set.has('구운 사과') || set.has('청사과')) {
    set.delete('사과');
  }
  if (set.has('청포도') || set.has('적포도')) {
    set.delete('포도');
  }
  if (set.has('달콤한 산미')) {
    set.delete('단맛');
  }

  return [...set];
}

function sortTastingNotes(notes) {
  return [...new Set(notes.filter(Boolean))]
    .filter((note) => LABEL_GROUP.has(note))
    .sort((a, b) => {
      const groupDiff = NOTE_GROUPS[LABEL_GROUP.get(a)] - NOTE_GROUPS[LABEL_GROUP.get(b)];
      if (groupDiff !== 0) return groupDiff;
      return LABEL_ORDER.get(a) - LABEL_ORDER.get(b);
    });
}

function normalizeTastingNotes(notes, options = {}) {
  const limit = options.limit ?? 5;
  const sourceNotes = Array.isArray(notes) ? notes : [notes];
  const found = [];

  sourceNotes.flatMap(splitNoteText).forEach((note) => {
    findCanonicalNotes(note).forEach((canonicalNote) => {
      if (!found.includes(canonicalNote)) found.push(canonicalNote);
    });
  });

  const normalized = sortTastingNotes(removeOverlappingNotes(found));
  return Number.isFinite(limit) ? normalized.slice(0, limit) : normalized;
}

function isTastingNote(note) {
  return normalizeTastingNotes([note], { limit: Infinity }).length > 0;
}

export {
  COUNTRY_ALIASES,
  NON_TASTE_ALIASES,
  normalizeTastingNotes,
  sortTastingNotes,
  isTastingNote,
};
