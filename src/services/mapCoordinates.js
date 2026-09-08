// 전 세계 주요 커피 생산국 좌표 및 메타데이터 정의
// SVG 뷰박스 기준: 1000 x 500 (Equirectangular Projection)
// x = ((lng + 180) / 360) * 1000
// y = ((90 - lat) / 180) * 500

export const COFFEE_BELT_BOUNDS = {
  topY: 180, // 북위 ~25°
  bottomY: 320, // 남위 ~25°
  height: 140,
};

export const COFFEE_REGIONS = {
  LATIN_AMERICA: '중남미',
  AFRICA: '아프리카',
  ASIA_PACIFIC: '아시아·태평양',
};

export const COFFEE_COUNTRIES = [
  // 중남미 (Latin America)
  {
    code: 'COL',
    label: '콜롬비아',
    enName: 'Colombia',
    flag: '🇨🇴',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 4.57,
    lng: -74.3,
    x: 294,
    y: 237,
    famousRegions: '후일라 · 나리뇨 · 카우카 · 톨리마',
    flavorNote: '산뜻한 감귤류 산미와 캐러멜의 달콤함, 뛰어난 밸런스',
    aliases: ['colombia', '콜롬비아'],
  },
  {
    code: 'BRA',
    label: '브라질',
    enName: 'Brazil',
    flag: '🇧🇷',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: -14.23,
    lng: -51.93,
    x: 356,
    y: 290,
    famousRegions: '미나스제라이스 · 세하도 · 모지아나',
    flavorNote: '구운 견과류의 고소함과 묵직한 초콜릿 바디감',
    aliases: ['brazil', '브라질'],
  },
  {
    code: 'GTM',
    label: '과테말라',
    enName: 'Guatemala',
    flag: '🇬🇹',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 15.78,
    lng: -90.23,
    x: 249,
    y: 206,
    famousRegions: '안티구아 · 우에우에테낭고 · 코반',
    flavorNote: '화사한 꽃향기와 스모키한 다크초콜릿, 알맞은 산미',
    aliases: ['guatemala', '과테말라'],
  },
  {
    code: 'CRI',
    label: '코스타리카',
    enName: 'Costa Rica',
    flag: '🇨🇷',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 9.75,
    lng: -83.75,
    x: 267,
    y: 223,
    famousRegions: '따라주 · 센트럴밸리 · 브룬카',
    flavorNote: '밝고 맑은 시트러스 산미, 꿀과 사탕수수의 깔끔한 단맛',
    aliases: ['costa rica', 'costarica', '코스타리카'],
  },
  {
    code: 'PAN',
    label: '파나마',
    enName: 'Panama',
    flag: '🇵🇦',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 8.54,
    lng: -80.78,
    x: 276,
    y: 226,
    famousRegions: '보케테 · 볼칸 (게이샤 품종의 본고장)',
    flavorNote: '자스민 꽃향기, 베르가못과 복숭아의 압도적인 아로마',
    aliases: ['panama', '파나마'],
  },
  {
    code: 'HND',
    label: '온두라스',
    enName: 'Honduras',
    flag: '🇭🇳',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 15.2,
    lng: -86.24,
    x: 260,
    y: 208,
    famousRegions: '산타바바라 · 코판 · 마르칼라',
    flavorNote: '부드러운 열대과일 단맛과 밀크초콜릿의 조화',
    aliases: ['honduras', '온두라스', '온드라스'],
  },
  {
    code: 'PER',
    label: '페루',
    enName: 'Peru',
    flag: '🇵🇪',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: -9.19,
    lng: -75.02,
    x: 292,
    y: 276,
    famousRegions: '카하마르카 · 쿠스코 · 후닌',
    flavorNote: '바닐라의 부드러움과 은은하고 편안한 과일 향미',
    aliases: ['peru', '페루'],
  },
  {
    code: 'SLV',
    label: '엘살바도르',
    enName: 'El Salvador',
    flag: '🇸🇻',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 13.79,
    lng: -88.9,
    x: 253,
    y: 212,
    famousRegions: '아파네카 · 찰라테낭고 (파카마라 품종)',
    flavorNote: '크리미한 질감, 사과 같은 산뜻함과 짙은 단맛',
    aliases: ['el salvador', '엘살바도르'],
  },
  {
    code: 'NIC',
    label: '니카라과',
    enName: 'Nicaragua',
    flag: '🇳🇮',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 12.87,
    lng: -85.21,
    x: 263,
    y: 214,
    famousRegions: '히노테가 · 마타갈파 · 누에바세고비아',
    flavorNote: '깔끔한 초콜릿 풍미와 부드러운 산미, 기분 좋은 피니시',
    aliases: ['nicaragua', '니카라과'],
  },
  {
    code: 'MEX',
    label: '멕시코',
    enName: 'Mexico',
    flag: '🇲🇽',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 19.43,
    lng: -99.13,
    x: 225,
    y: 196,
    famousRegions: '치아파스 · 오아하카 · 베라크루스',
    flavorNote: '헤이즐넛의 고소함과 가볍고 산뜻한 마일드 바디',
    aliases: ['mexico', '멕시코'],
  },
  {
    code: 'ECU',
    label: '에콰도르',
    enName: 'Ecuador',
    flag: '🇪🇨',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: -1.83,
    lng: -78.18,
    x: 283,
    y: 255,
    famousRegions: '피친차 · 로하 · 갈라파고스',
    flavorNote: '복합적인 꽃향기와 열대과일 뉘앙스, 밝고 깨끗한 산미',
    aliases: ['ecuador', '에콰도르'],
  },
  {
    code: 'BOL',
    label: '볼리비아',
    enName: 'Bolivia',
    flag: '🇧🇴',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: -16.29,
    lng: -63.59,
    x: 323,
    y: 295,
    famousRegions: '카라나비 · 라파스',
    flavorNote: '매우 투명한 컵노트, 과일잼과 캐러멜의 달콤함',
    aliases: ['bolivia', '볼리비아'],
  },

  // 아프리카 & 중동 (Africa & Middle East)
  {
    code: 'ETH',
    label: '에티오피아',
    enName: 'Ethiopia',
    flag: '🇪🇹',
    region: COFFEE_REGIONS.AFRICA,
    lat: 9.15,
    lng: 40.49,
    x: 612,
    y: 225,
    famousRegions: '예가체프 · 시다모 · 구지 · 하라',
    flavorNote: '커피의 고향. 화사한 꽃향기와 베리류의 다채롭고 밝은 산미',
    aliases: ['ethiopia', 'ehiopia', '에티오피아', '에티오파이', '에팅오피아'],
  },
  {
    code: 'KEN',
    label: '케냐',
    enName: 'Kenya',
    flag: '🇰🇪',
    region: COFFEE_REGIONS.AFRICA,
    lat: -0.02,
    lng: 37.91,
    x: 605,
    y: 250,
    famousRegions: '니에리 · 키린야가 · 엠부',
    flavorNote: '강렬한 블랙커런트와 자몽, 와이니하고 입체적인 산미',
    aliases: ['kenya', '케냐'],
  },
  {
    code: 'RWA',
    label: '르완다',
    enName: 'Rwanda',
    flag: '🇷🇼',
    region: COFFEE_REGIONS.AFRICA,
    lat: -1.94,
    lng: 29.87,
    x: 583,
    y: 255,
    famousRegions: '후예 · 기센이 · 냐마셰케',
    flavorNote: '홍차 같은 부드러움과 싱그러운 오렌지·사과 뉘앙스',
    aliases: ['rwanda', '르완다'],
  },
  {
    code: 'BDI',
    label: '부룬디',
    enName: 'Burundi',
    flag: '🇧🇮',
    region: COFFEE_REGIONS.AFRICA,
    lat: -3.37,
    lng: 29.92,
    x: 583,
    y: 260,
    famousRegions: '카얀자 · 은고지 · 기테가',
    flavorNote: '흑설탕의 진한 단맛, 레몬과 살구의 화사한 밸런스',
    aliases: ['burundi', '부룬디'],
  },
  {
    code: 'TZA',
    label: '탄자니아',
    enName: 'Tanzania',
    flag: '🇹🇿',
    region: COFFEE_REGIONS.AFRICA,
    lat: -6.37,
    lng: 34.89,
    x: 597,
    y: 268,
    famousRegions: '킬리만자로 · 아루샤 · 음베야',
    flavorNote: '와인 같은 산미와 묵직한 바디, 농후한 건과일 풍미',
    aliases: ['tanzania', '탄자니아'],
  },
  {
    code: 'UGA',
    label: '우간다',
    enName: 'Uganda',
    flag: '🇺🇬',
    region: COFFEE_REGIONS.AFRICA,
    lat: 1.37,
    lng: 32.29,
    x: 590,
    y: 246,
    famousRegions: '엘곤산 · 르웬조리',
    flavorNote: '두터운 바디감, 다크초콜릿과 말린 자두의 깊은 단맛',
    aliases: ['uganda', '우간다'],
  },
  {
    code: 'YEM',
    label: '예멘',
    enName: 'Yemen',
    flag: '🇾🇪',
    region: COFFEE_REGIONS.AFRICA,
    lat: 15.55,
    lng: 48.52,
    x: 635,
    y: 207,
    famousRegions: '베니마타르 · 하라즈 (모카의 발원지)',
    flavorNote: '야생적인 스파이스와 진한 와인, 초콜릿의 고전적 매력',
    aliases: ['yemen', '예멘'],
  },

  // 아시아·태평양 (Asia-Pacific)
  {
    code: 'IDN',
    label: '인도네시아',
    enName: 'Indonesia',
    flag: '🇮🇩',
    region: COFFEE_REGIONS.ASIA_PACIFIC,
    lat: -0.79,
    lng: 113.92,
    x: 816,
    y: 252,
    famousRegions: '수마트라(만델링) · 자바 · 발리 · 술라웨시',
    flavorNote: '묵직한 풀바디, 삼나무와 흙내음, 쌉싸름한 다크초콜릿',
    aliases: ['indonesia', '인도네시아', '만델링', 'mandheling'],
  },
  {
    code: 'IND',
    label: '인도',
    enName: 'India',
    flag: '🇮🇳',
    region: COFFEE_REGIONS.ASIA_PACIFIC,
    lat: 14.5,
    lng: 76.5,
    x: 712,
    y: 210,
    famousRegions: '카르나타카 · 케랄라 (몬순 말라바)',
    flavorNote: '낮은 산미, 매혹적인 향신료와 구운 견과류, 풍성한 크레마',
    aliases: ['india', '인도', '몬순'],
  },
  {
    code: 'PNG',
    label: '파푸아뉴기니',
    enName: 'Papua New Guinea',
    flag: '🇵🇬',
    region: COFFEE_REGIONS.ASIA_PACIFIC,
    lat: -6.31,
    lng: 143.96,
    x: 900,
    y: 268,
    famousRegions: '와기밸리 · 이스턴하일랜드',
    flavorNote: '자메이카 블루마운틴 혈통, 부드러운 산미와 허브의 은은함',
    aliases: ['papua new guinea', '파푸아뉴기니', 'png'],
  },
  {
    code: 'MMR',
    label: '미얀마',
    enName: 'Myanmar',
    flag: '🇲🇲',
    region: COFFEE_REGIONS.ASIA_PACIFIC,
    lat: 21.92,
    lng: 95.96,
    x: 766,
    y: 189,
    famousRegions: '샨주 (유와간) · 만달레이',
    flavorNote: '부드러운 시트러스 단맛과 자두, 깨끗하고 마일드한 여운',
    aliases: ['myanmar', '미얀마'],
  },
];

const COUNTRY_LOOKUP = new Map(COFFEE_COUNTRIES.map((item) => [item.label, item]));

export function getCountryInfo(label) {
  return COUNTRY_LOOKUP.get(label) || null;
}

/**
 * 원두 상품 객체에서 생산국 목록을 추출 (싱글오리진은 1개, 블렌드는 복수 개)
 * @param {object} product - 원두 상품 객체
 * @returns {string[]} 추출된 국가명 배열 (예: ['콜롬비아', '에티오피아'])
 */
export function extractProductCountries(product) {
  if (!product) return [];
  const text = [product.productName, product.origin].filter(Boolean).join(' ').toLowerCase();
  if (!text) return [];

  const matched = [];
  const matchedCodes = new Set();

  // '인도네시아'와 '인도'처럼 단어 포함 관계가 있는 경우 긴 단어를 우선 매칭하기 위해 정렬
  const sortedRules = [...COFFEE_COUNTRIES].sort((a, b) => {
    const maxLenA = Math.max(...a.aliases.map((al) => al.length));
    const maxLenB = Math.max(...b.aliases.map((al) => al.length));
    return maxLenB - maxLenA;
  });

  for (const country of sortedRules) {
    // 특수 단어 경계 처리: '인도'의 경우 '인도네시아'에 부분 매칭되지 않도록 방지
    const hasMatch = country.aliases.some((alias) => {
      const lowerAlias = alias.toLowerCase();
      if (!text.includes(lowerAlias)) return false;

      // '인도' 별칭에 대한 오매칭 가드
      if (country.code === 'IND' && lowerAlias === '인도') {
        const withoutIndonesia = text.replace(/인도네시아/g, '');
        return withoutIndonesia.includes('인도');
      }
      if (country.code === 'IND' && lowerAlias === 'india') {
        const withoutIndonesiaEn = text.replace(/indonesia/g, '');
        return withoutIndonesiaEn.includes('india');
      }

      return true;
    });

    if (hasMatch && !matchedCodes.has(country.code)) {
      matched.push(country.label);
      matchedCodes.add(country.code);
    }
  }

  return matched;
}
