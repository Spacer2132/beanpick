const NOTE_GROUPS = {
  fruit: 0,
  floral: 1,
  spice: 2,
  sweet: 3,
  sour: 4,
  roasted: 5,
  green: 6,
  nutty: 7,
  body: 8,
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
  { label: '샴페인', group: 'body', aliases: ['champagne', '샴페인'] },
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
  { label: '샴페인', group: 'body', aliases: ['champagne', '샴페인'] },
];

const NOTE_RULES = [
  { label: '자몽', group: 'fruit', aliases: ['grapefruit', '자몽'] },
  { label: '토마토', group: 'fruit', aliases: ['tomato', '토마토'] },
  { label: '오렌지', group: 'fruit', aliases: ['orange', '오렌지'] },
  { label: '레몬', group: 'fruit', aliases: ['lemon', '레몬', 'sitron'] },
  { label: '라임', group: 'fruit', aliases: ['lime', '라임'] },
  { label: '시트러스', group: 'fruit', aliases: ['citrus', '시트러스', 'sitrus'] },
  { label: '베리', group: 'fruit', aliases: ['berry', 'berries', '베리'] },
  { label: '블랙커런트', group: 'fruit', aliases: ['blackcurrant', 'black currant', '블랙커런트', '블랙 커런트'] },
  { label: '블루베리', group: 'fruit', aliases: ['blueberry', '블루베리'] },
  { label: '딸기', group: 'fruit', aliases: ['strawberry', '딸기', '딸기잼'] },
  { label: '라즈베리', group: 'fruit', aliases: ['raspberry', '라즈베리'] },
  { label: '체리', group: 'fruit', aliases: ['cherry', '체리', 'kirsebær'] },
  { label: '멜론', group: 'fruit', aliases: ['melon', '멜론', '메론'] },
  { label: '구운 사과', group: 'fruit', aliases: ['baked apple', 'baked apples', '구운 사과'] },
  { label: '사과', group: 'fruit', aliases: ['apple', '사과', '적사과', 'red apple', 'redapple', '홍옥'] },
  { label: '청사과', group: 'fruit', aliases: ['green apple', 'greenapple', '청사과'] },
  { label: '배', group: 'fruit', aliases: ['pear', '배'] },
  { label: '복숭아', group: 'fruit', aliases: ['peach', '복숭아', '백도', '황도'] },
  { label: '살구', group: 'fruit', aliases: ['apricot', '살구', '살구 주스', '살구주스', 'dried apricot', '말린살구', '말린 살구', '건살구', '살구잼', 'orejones'] },
  { label: '천도복숭아', group: 'fruit', aliases: ['nectarine', '천도복숭아', '넥타린'] },
  { label: '열대과일', group: 'fruit', aliases: ['tropical fruit', 'tropical fruits', 'tropical', '열대과일', '열대 과일'] },
  { label: '망고', group: 'fruit', aliases: ['mango', '망고'] },
  { label: '파인애플', group: 'fruit', aliases: ['pineapple', '파인애플'] },
  { label: '자두', group: 'fruit', aliases: ['plum', '자두', 'plomme'] },
  { label: '포도', group: 'fruit', aliases: ['grape', '포도'] },
  { label: '청포도', group: 'fruit', aliases: ['green grape', 'greengrape', '청포도'] },
  { label: '적포도', group: 'fruit', aliases: ['red grape', 'redgrape', '적포도'] },
  { label: '샤인머스캣', group: 'fruit', aliases: ['shine muscat', 'shinemuscat', '샤인머스캣', '샤인 머스캣'] },
  { label: '건과일', group: 'fruit', aliases: ['dried fruit', 'dried fruits', '건과일', '말린 과일'] },
  { label: '건포도', group: 'fruit', aliases: ['raisin', 'raisins', '건포도'] },
  { label: '피치', group: 'fruit', aliases: ['피치'] },
  { label: '망고스틴', group: 'fruit', aliases: ['망고스틴', 'mangosteen'] },
  { label: '말린자두', group: 'fruit', aliases: ['prune', 'prunes', 'dried plum', 'dried plums', '푸룬', '말린자두', '말린 자두', '건자두'] },
  { label: '로즈힙', group: 'fruit', aliases: ['rosehip', 'rose hip', '로즈힙', '로즈 힙'] },
  { label: '대추야자', group: 'fruit', aliases: ['date', 'dates', 'jujube', '대추야자', '대추'] },
  { label: '리치', group: 'fruit', aliases: ['lychee', '리치'] },
  { label: '쥬시', group: 'fruit', aliases: ['juicy', '쥬시', '주시'] },
  { label: '달콤한 산미', group: 'fruit', aliases: ['sweet acidity', '달콤한 산미'] },
  { label: '청량감', group: 'fruit', aliases: ['sparkling', 'sparkly', '청량감', '스파클링'] },
  { label: '검은딸기', group: 'fruit', aliases: ['blackberry', '검은딸기', '블랙베리'] },
  { label: '까치밥', group: 'fruit', aliases: ['currant', '까치밥'] },
  { label: '크랜베리', group: 'fruit', aliases: ['cranberry', '크랜베리'] },
  { label: '보이센베리', group: 'fruit', aliases: ['boysenberry', '보이센베리'] },
  { label: '유자', group: 'fruit', aliases: ['yuzu', '유자'] },
  { label: '무화과', group: 'fruit', aliases: ['fig', '무화과'] },
  { label: '파파야', group: 'fruit', aliases: ['papaya', '파파야'] },
  { label: '구아바', group: 'fruit', aliases: ['guava', '구아바'] },
  { label: '바나나', group: 'fruit', aliases: ['banana', '바나나'] },
  { label: '패션프루트', group: 'fruit', aliases: ['passion fruit', 'passionfruit', '패션프루트', '패션프룻'] },

  { label: '감귤', group: 'fruit', aliases: ['감귤', '귤', '만다린', 'mandarin', '탠저린', '탠져린', 'tangerine', 'green tangerine', 'sweet mandarin'] },
  { label: '핵과류', group: 'fruit', aliases: ['stone fruit', 'stone fruits', '핵과류', 'steinfrukt'] },
  { label: '키위', group: 'fruit', aliases: ['kiwi', '키위', '노란 키위'] },
  { label: '스타프룻', group: 'fruit', aliases: ['star fruit', 'starfruit', '스타프룻'] },
  { label: '비파', group: 'fruit', aliases: ['loquat', '비파'] },
  { label: '감', group: 'fruit', aliases: ['persimmon', '감'] },
  { label: '수박', group: 'fruit', aliases: ['watermelon', '수박'] },
  { label: '석류', group: 'fruit', aliases: ['pomegranate', '석류'] },
  { label: '엘더베리', group: 'fruit', aliases: ['elderberry', '엘더베리'] },
  { label: '블랙체리', group: 'fruit', aliases: ['black cherry', 'blackcherry', '블랙체리'] },
  { label: '레모네이드', group: 'fruit', aliases: ['lemonade', '레모네이드'] },
  { label: '레몬그라스', group: 'fruit', aliases: ['lemongrass', '레몬그라스'] },
  { label: '금귤', group: 'fruit', aliases: ['kumquat', '금귤'] },
  { label: '루바브', group: 'fruit', aliases: ['rhubarb', '루바브'] },
  { label: '플로럴', group: 'floral', aliases: ['floral', 'flower', 'flowers', '플로럴', '꽃향기', '꽃 향', '꽃내음', '꽃향', 'white flower', '화이트 플라워', 'elegant florals'] },
  { label: '자스민', group: 'floral', aliases: ['jasmine', '자스민', '재스민'] },
  { label: '베르가못', group: 'floral', aliases: ['bergamot', '베르가못', 'bergamott'] },
  { label: '라벤더', group: 'floral', aliases: ['lavender', '라벤더'] },
  { label: '노란 백합', group: 'floral', aliases: ['yellow lily', '노란 백합'] },
  { label: '홍차', group: 'floral', aliases: ['black tea', 'blacktea', '홍차', 'assam', '아쌈', '아쌈 티', '아삼', '아삼블랙티', 'sort te'] },
  { label: '녹차', group: 'floral', aliases: ['green tea', 'greentea', '녹차'] },
  { label: '백차', group: 'floral', aliases: ['white tea', 'whitetea', '백차'] },
  { label: '차', group: 'floral', aliases: ['tea', 'tea-like', 'tea like', '차'] },
  { label: '다즐링티', group: 'floral', aliases: ['darjeeling', 'darjeeling tea', '다즐링티', '다즐링 티'] },
  { label: '민트', group: 'floral', aliases: ['mint', 'peppermint', '민트', '페퍼민트'] },
  { label: '로즈', group: 'floral', aliases: ['로즈'] },
  { label: '엘더플라워', group: 'floral', aliases: ['엘더플라워'] },
  { label: '장미', group: 'floral', aliases: ['rose', '장미', '장미꽃잎'] },
  { label: '히비스커스', group: 'floral', aliases: ['hibiscus', '히비스커스'] },
  { label: '꿀풀', group: 'floral', aliases: ['honeysuckle', '꿀풀', '허니서클'] },
  { label: '진달래', group: 'floral', aliases: ['azalea', '진달래'] },

  { label: '바이올렛', group: 'floral', aliases: ['violet', '바이올렛'] },
  { label: '벚꽃', group: 'floral', aliases: ['cherry blossom', '벚꽃'] },
  { label: '목련', group: 'floral', aliases: ['magnolia', '목련', '매그놀리아'] },
  { label: '라일락', group: 'floral', aliases: ['lilac', '라일락'] },
  { label: '캐모마일', group: 'floral', aliases: ['chamomile', '캐모마일'] },
  { label: '금목서', group: 'floral', aliases: ['osmanthus', '금목서', '오스만투스'] },
  { label: '아카시아', group: 'floral', aliases: ['acacia', '아카시아'] },
  { label: '커피꽃', group: 'floral', aliases: ['coffee blossom', '커피꽃'] },
  { label: '얼그레이', group: 'floral', aliases: ['earl grey', 'earlgrey', '얼그레이'] },
  { label: '우롱차', group: 'floral', aliases: ['oolong', '우롱', '우롱차', '밀키 우롱', 'milky oolong'] },
  { label: '스파이스', group: 'spice', aliases: ['spice', 'spices', '스파이스', '향신료'] },
  { label: '계피', group: 'spice', aliases: ['cinnamon', '계피', '시나몬'] },
  { label: '정향', group: 'spice', aliases: ['clove', '정향'] },
  { label: '육두구', group: 'spice', aliases: ['nutmeg', '육두구'] },
  { label: '카다몬', group: 'spice', aliases: ['cardamom', '카다몬', '카다멈'] },
  { label: '검은후추', group: 'spice', aliases: ['black pepper', 'blackpepper', '검은후추'] },
  { label: '생강', group: 'spice', aliases: ['ginger', '생강'] },
  { label: '회향', group: 'spice', aliases: ['anise', 'fennel', '회향'] },
  { label: '커민', group: 'spice', aliases: ['cumin', '커민'] },
  { label: '오렌지꽃', group: 'spice', aliases: ['orange flower', 'orange blossom', '오렌지꽃', '오렌지 블로섬'] },

  { label: '타마린드', group: 'spice', aliases: ['tamarind', '타마린드'] },
  { label: '로즈마리', group: 'spice', aliases: ['rosemary', '로즈마리'] },
  { label: '리코리스', group: 'spice', aliases: ['licorice', 'liquorice', '리코리스', '레드 리코리스'] },
  { label: '다크초콜릿', group: 'sweet', aliases: ['dark chocolate', 'darkchocolate', 'dark choco', '다크초콜릿', '다크 초콜릿', '다크쵸콜릿', '다크초콜렛', '초콜렛'] },
  { label: '밀크초콜릿', group: 'sweet', aliases: ['milk chocolate', 'milkchocolate', 'milk choco', '밀크초콜릿', '밀크 초콜릿', '밀크쵸콜릿', '밀크초코'] },
  { label: '화이트 초콜릿', group: 'sweet', aliases: ['white chocolate', 'whitechocolate', '화이트 초콜릿', '화이트초콜릿'] },
  { label: '초코무스', group: 'sweet', aliases: ['choco mousse', 'chocomousse', '초코무스'] },
  { label: '초콜릿', group: 'sweet', aliases: ['chocolate', 'choco', 'cacao', 'cocoa', '초콜릿', '초코', '카카오', '코코아', '초콜', 'fudge', '퍼지', '초코브라우니', 'sjokolade'] },
  { label: '메이플시럽', group: 'sweet', aliases: ['maple syrup', 'maplesyrup', 'maple', '메이플시럽', '메이플 시럽', '메이플'] },
  { label: '캐러멜', group: 'sweet', aliases: ['caramel', '카라멜', '캐러멜', '캬라멜', 'karamell'] },
  { label: '달고나', group: 'sweet', aliases: ['dalgona', '달고나'] },
  { label: '당밀', group: 'sweet', aliases: ['molasses', '당밀'] },
  { label: '둘세데레체', group: 'sweet', aliases: ['dulce de leche', 'dulcedeleche', '둘세데레체'] },
  { label: '브라운슈가', group: 'sweet', aliases: ['brown sugar', 'brownsugar', '브라운슈가', '브라운 슈가', '갈색설탕', '흑설탕', '흑당', '황설탕', '블랙 슈가'] },
  { label: '꿀', group: 'sweet', aliases: ['honey', '꿀'] },
  { label: '바닐라', group: 'sweet', aliases: ['vanilla', '바닐라'] },
  { label: '버터스카치', group: 'sweet', aliases: ['butterscotch', '버터스카치'] },
  { label: '코코넛', group: 'sweet', aliases: ['coconut', '코코넛'] },
  { label: '호박', group: 'sweet', aliases: ['pumpkin', '호박', '단호박'] },
  { label: '조청', group: 'sweet', aliases: ['조청'] },
  { label: '뉘앙스', group: 'sweet', aliases: ['nuance', '뉘앙스'] },

  { label: '토피', group: 'sweet', aliases: ['toffee', '토피'] },
  { label: '사탕수수', group: 'sweet', aliases: ['sugarcane', 'sugar cane', '사탕수수', '슈가케인', '슈거케인', '사탕수수당'] },
  { label: '시럽', group: 'sweet', aliases: ['syrup', '시럽'] },
  { label: '연유', group: 'sweet', aliases: ['condensed milk', 'condensedmilk', '연유', '콘덴스드 밀크'] },
  { label: '크림브륄레', group: 'sweet', aliases: ['creme brulee', '크림브륄레'] },
  { label: '머랭', group: 'sweet', aliases: ['meringue', '머랭'] },
  { label: '태피', group: 'sweet', aliases: ['taffy', '태피'] },
  { label: '솜사탕', group: 'sweet', aliases: ['cotton candy', 'cottoncandy', '솜사탕'] },
  { label: '콜라', group: 'sweet', aliases: ['cola', '콜라'] },
  { label: '발효', group: 'sour', aliases: ['fermented', '발효'] },
  { label: '식초', group: 'sour', aliases: ['vinegar', 'acetic', '식초', '식초향'] },
  { label: '요구르트', group: 'sour', aliases: ['yogurt', 'lactic', '요구르트', '락틱'] },

  { label: '구운향', group: 'roasted', aliases: ['roasted', 'roasting', '구운향'] },
  { label: '태운맛', group: 'roasted', aliases: ['burnt', 'charred', '태운맛'] },
  { label: '재향', group: 'roasted', aliases: ['ashy', 'ash', '재향'] },
  { label: '스모키', group: 'roasted', aliases: ['smoky', 'smoke', '스모키'] },
  { label: '보리', group: 'roasted', aliases: ['barley', 'grain', 'cereal', '보리'] },

  { label: '풀향', group: 'green', aliases: ['grassy', 'grass', '풀향'] },
  { label: '허브', group: 'green', aliases: ['herbal', 'herb', '허브', 'herbs'] },
  { label: '신선', group: 'green', aliases: ['fresh', '신선'] },
  { label: '채소', group: 'green', aliases: ['vegetable', 'vegetative', '채소'] },
  { label: '짚', group: 'green', aliases: ['straw', 'hay', '짚'] },
  { label: '담배', group: 'green', aliases: ['tobacco', '담배'] },
  { label: '나뭇잎', group: 'green', aliases: ['leaf', 'leafy', '나뭇잎'] },
  { label: '향초', group: 'green', aliases: ['herbaceous', '향초'] },
  { label: '올리브', group: 'green', aliases: ['olive', 'olives', '올리브'] },

  { label: '유칼립투스', group: 'green', aliases: ['eucalyptus', '유칼립투스'] },
  { label: '견과류', group: 'nutty', aliases: ['nutty', 'nuts', 'nut', '견과류', '견과'] },
  { label: '참깨', group: 'nutty', aliases: ['sesame', '참깨'] },
  { label: '구운빵', group: 'nutty', aliases: ['toast', 'toasted bread', 'bread', '구운빵', '구운 빵', '빵', '토스트'] },
  { label: '볶은아몬드', group: 'nutty', aliases: ['roasted almond', 'roastedalmond', '볶은아몬드', '볶은 아몬드'] },
  { label: '아몬드', group: 'nutty', aliases: ['almond', '아몬드'] },
  { label: '캐슈넛', group: 'nutty', aliases: ['cashew nut', 'cashew nuts', 'cashew', '캐슈넛', '캐슈 너트'] },
  { label: '마카다미아', group: 'nutty', aliases: ['macadamia', '마카다미아'] },
  { label: '헤이즐넛', group: 'nutty', aliases: ['hazelnut', '헤이즐넛'] },
  { label: '피칸', group: 'nutty', aliases: ['pecan', '피칸'] },
  { label: '몰트', group: 'nutty', aliases: ['malt', 'malted', '몰트'] },
  { label: '땅콩', group: 'nutty', aliases: ['peanut', '땅콩'] },
  { label: '호두', group: 'nutty', aliases: ['walnut', '호두'] },

  { label: '옥수수', group: 'nutty', aliases: ['corn', '옥수수'] },
  { label: '오트', group: 'nutty', aliases: ['oats', 'oatmeal', '오트밀', '오트'] },
  { label: '군밤', group: 'nutty', aliases: ['군밤', '밤', '구운 밤', 'roasted chestnut'] },
  { label: '군고구마', group: 'nutty', aliases: ['군고구마', '구운 고구마', 'roasted sweet potato'] },
  { label: '피스타치오', group: 'nutty', aliases: ['pistachio', '피스타치오'] },
  { label: '부드러움', group: 'body', aliases: ['soft', 'smooth', 'silky', '부드러움', '부드러운 질감'] },
  { label: '크리미', group: 'body', aliases: ['creamy', '크리미', 'cream', '크림', 'sweet cream'] },
  { label: '시러피', group: 'body', aliases: ['syrupy', '시러피'] },
  { label: '묵직', group: 'body', aliases: ['heavy', '묵직', '묵직한'] },
  { label: '와이니', group: 'body', aliases: ['winey', 'winy', 'wine', '와이니'] },
  { label: '긴 여운', group: 'body', aliases: ['long aftertaste', 'longaftertaste', '긴 여운', '긴여운'] },
  { label: '미네랄리티', group: 'body', aliases: ['minerality', '미네랄리티'] },
  { label: '샴페인', group: 'body', aliases: ['champagne', '샴페인'] },
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

const SHORT_ALIAS_BLOCK_PATTERNS = {
  '배': /배전|배송|택배|재배|배합|배추/i,
  '차': /차이|차량|차단|차례|차별|차점|차창|차판/i,
  '짚': /짚고|짚어|짚는|짚다|짚세/i,
};

function aliasAppearsInText(alias, textKey, compactTextKey) {
  const aliasKey = toKey(alias);
  const compactAlias = toCompactKey(alias);

  if (!aliasKey) return false;
  if (textKey === aliasKey || compactTextKey === compactAlias) return true;
  if (/^[a-z0-9 ]+$/.test(aliasKey)) {
    const escaped = aliasKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(textKey);
  }

  // 한글(비영문) 별칭의 오매칭 방지 및 조사 접미사 허용 필터링
  if (aliasKey.length <= 2) {
    const blockPattern = SHORT_ALIAS_BLOCK_PATTERNS[aliasKey];
    if (blockPattern && blockPattern.test(textKey)) {
      return false;
    }
    const escaped = aliasKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const regex = new RegExp(`(?<=^|[^가-힣a-zA-Z0-9])${escaped}(?:향|맛|의|와|과|가|이|를|을|류|처럼|한|톤|뉘앙스|아로마)*(?=[^가-힣a-zA-Z0-9]|$)`, 'i');
    return regex.test(textKey);
  }

  return compactTextKey.includes(compactAlias);
}

function findCanonicalNotes(value, options = {}) {
  if (isBlockedToken(value) || (!options.explicitEvidence && isInvalidFreeText(value))) return [];

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
  if (set.has('청포도') || set.has('적포도') || set.has('건포도')) {
    set.delete('포도');
  }
  if (['블랙커런트', '블루베리', '딸기', '라즈베리', '검은딸기', '크랜베리', '보이센베리'].some((note) => set.has(note))) {
    set.delete('베리');
  }
  if (set.has('블랙커런트')) {
    set.delete('까치밥');
  }
  if (set.has('로즈힙')) {
    set.delete('장미');
  }
  if (set.has('홍차') || set.has('녹차') || set.has('백차') || set.has('다즐링티')) {
    set.delete('차');
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
    findCanonicalNotes(note, options).forEach((canonicalNote) => {
      if (!found.includes(canonicalNote)) found.push(canonicalNote);
    });
  });

  const normalized = sortTastingNotes(removeOverlappingNotes(found));
  return Number.isFinite(limit) ? normalized.slice(0, limit) : normalized;
}

function isTastingNote(note) {
  return normalizeTastingNotes([note], { limit: Infinity }).length > 0;
}

// 원문은 검색용 사전과 분리한다. 사전에 없는 표현도 검수 근거로 남긴다.
function createTastingNoteEvidence(notes, sourceUrl, method = 'detail-text') {
  if (!/^https?:\/\//i.test(String(sourceUrl || ''))) return [];
  if (!['detail-text', 'image-model', 'image-ocr'].includes(method)) return [];
  const entries = new Map();
  const clean = (value) => typeof value === 'string' && value.trim().length <= 80 && !/[<>\x00-\x1f]/.test(value) ? value.trim() : '';
  for (const note of Array.isArray(notes) ? notes : [notes]) {
    const value = typeof note === 'string' ? note : note?.text;
    if (typeof value !== 'string') continue;
    for (const part of value.split(/[\n,;/|·ㆍ•]+/)) {
      const text = clean(part);
      if (!text) continue;
      const entry = { text, sourceUrl, method };
      for (const field of ['group', 'process']) {
        if (clean(note?.[field])) entry[field] = clean(note[field]);
      }
      if (['process-conflict', 'blend-component'].includes(note?.reviewReason)) entry.reviewReason = note.reviewReason;
      entries.set(JSON.stringify(entry), entry);
    }
  }
  return [...entries.values()];
}

function mergeTastingNoteEvidence(...lists) {
  const entries = new Map();
  for (const entry of lists.flat().filter(Boolean)) {
    for (const clean of createTastingNoteEvidence(entry, entry.sourceUrl, entry.method)) {
      entries.set(JSON.stringify(clean), clean);
    }
  }
  return [...entries.values()];
}

function extractTastingNoteEvidence(text, sourceUrl, method = 'detail-text') {
  const plain = String(text || '')
    .replace(/<br\s*\/?>|<\/(?:p|div|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ');
  const label = /(?:tasting\s*notes?|cupping\s*notes?|cup\s*notes?|flavo[u]?r\s*&\s*aroma|테이스팅\s*노트|커핑\s*노트|컵\s*노트)\s*[:：–—-]?\s*([^\n]{1,420})/gi;
  const notes = [...plain.matchAll(label)].flatMap((match) => {
    const groups = [...plain.slice(0, match.index).matchAll(/(?:^|\n)\s*(Split\s+[A-Z0-9]+)\s*:?\s*(?=\n|$)/gi)];
    const group = groups.at(-1)?.[1];
    return match[1].split(/\b(?:origin|country|process|variety|altitude|roasting|details?)\b|원산지|가공|품종|고도|로스팅|배송|상품설명/i)[0]
      .split(/[,;/|·ㆍ•]+/).map((text) => group ? { text, group } : text);
  });
  return createTastingNoteEvidence(notes, sourceUrl, method);
}

function getDisplayTastingNotes(product) {
  const evidence = mergeTastingNoteEvidence(product?.tastingNoteEvidence || []);
  const recognized = evidence.filter((entry) => !entry.reviewReason && normalizeTastingNotes([entry.text], { limit: Infinity })
    .some((tag) => (product?.tastingNotes || []).includes(tag)));
  const currentNotes = normalizeTastingNotes(product?.tastingNotes || [], { limit: Infinity });
  const covered = new Set();
  const displayNotes = [];
  recognized.forEach((entry) => {
    normalizeTastingNotes([entry.text], { limit: Infinity }).forEach((tag) => {
      if (covered.has(tag)) return;
      covered.add(tag);
      displayNotes.push(tag);
    });
  });
  currentNotes.forEach((note) => {
    if (covered.has(note)) return;
    covered.add(note);
    displayNotes.push(note);
  });
  return displayNotes;
}

function getPendingTastingNotes(product) {
  return mergeTastingNoteEvidence(product?.tastingNoteEvidence || [])
    .filter((entry) => entry.reviewReason || !normalizeTastingNotes([entry.text], { limit: Infinity })
      .some((tag) => (product?.tastingNotes || []).includes(tag)));
}

const ACIDITY_WEIGHTS = {
  fruit: 1.0,
  floral: 0.8,
  sour: 0.6,
  green: 0.2,
  spice: -0.1,
  sweet: -0.6,
  roasted: -0.7,
  nutty: -1.0,
  body: -0.5,
};

function getAcidityScore(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return null;

  let sum = 0;
  let count = 0;

  notes.forEach((note) => {
    const group = LABEL_GROUP.get(note);
    if (group !== undefined && ACIDITY_WEIGHTS[group] !== undefined) {
      sum += ACIDITY_WEIGHTS[group];
      count++;
    }
  });

  if (count === 0) return null;

  const average = sum / count;
  return Math.max(-1, Math.min(1, average));
}

module.exports = {
  COUNTRY_ALIASES,
  NON_TASTE_ALIASES,
  normalizeTastingNotes,
  sortTastingNotes,
  isTastingNote,
  getAcidityScore,
  createTastingNoteEvidence,
  mergeTastingNoteEvidence,
  extractTastingNoteEvidence,
  getDisplayTastingNotes,
  getPendingTastingNotes,
};
