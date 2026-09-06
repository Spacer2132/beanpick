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
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 4.57,
    lng: -74.3,
    x: 294,
    y: 237,
    aliases: ['colombia', '콜롬비아'],
  },
  {
    code: 'BRA',
    label: '브라질',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: -14.23,
    lng: -51.93,
    x: 356,
    y: 290,
    aliases: ['brazil', '브라질'],
  },
  {
    code: 'GTM',
    label: '과테말라',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 15.78,
    lng: -90.23,
    x: 249,
    y: 206,
    aliases: ['guatemala', '과테말라'],
  },
  {
    code: 'CRI',
    label: '코스타리카',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 9.75,
    lng: -83.75,
    x: 267,
    y: 223,
    aliases: ['costa rica', 'costarica', '코스타리카'],
  },
  {
    code: 'PAN',
    label: '파나마',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 8.54,
    lng: -80.78,
    x: 276,
    y: 226,
    aliases: ['panama', '파나마'],
  },
  {
    code: 'HND',
    label: '온두라스',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 15.2,
    lng: -86.24,
    x: 260,
    y: 208,
    aliases: ['honduras', '온두라스', '온드라스'],
  },
  {
    code: 'PER',
    label: '페루',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: -9.19,
    lng: -75.02,
    x: 292,
    y: 276,
    aliases: ['peru', '페루'],
  },
  {
    code: 'SLV',
    label: '엘살바도르',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 13.79,
    lng: -88.9,
    x: 253,
    y: 212,
    aliases: ['el salvador', '엘살바도르'],
  },
  {
    code: 'NIC',
    label: '니카라과',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 12.87,
    lng: -85.21,
    x: 263,
    y: 214,
    aliases: ['nicaragua', '니카라과'],
  },
  {
    code: 'MEX',
    label: '멕시코',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: 19.43,
    lng: -99.13,
    x: 225,
    y: 196,
    aliases: ['mexico', '멕시코'],
  },
  {
    code: 'ECU',
    label: '에콰도르',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: -1.83,
    lng: -78.18,
    x: 283,
    y: 255,
    aliases: ['ecuador', '에콰도르'],
  },
  {
    code: 'BOL',
    label: '볼리비아',
    region: COFFEE_REGIONS.LATIN_AMERICA,
    lat: -16.29,
    lng: -63.59,
    x: 323,
    y: 295,
    aliases: ['bolivia', '볼리비아'],
  },

  // 아프리카 & 중동 (Africa & Middle East)
  {
    code: 'ETH',
    label: '에티오피아',
    region: COFFEE_REGIONS.AFRICA,
    lat: 9.15,
    lng: 40.49,
    x: 612,
    y: 225,
    aliases: ['ethiopia', 'ehiopia', '에티오피아', '에티오파이', '에팅오피아'],
  },
  {
    code: 'KEN',
    label: '케냐',
    region: COFFEE_REGIONS.AFRICA,
    lat: -0.02,
    lng: 37.91,
    x: 605,
    y: 250,
    aliases: ['kenya', '케냐'],
  },
  {
    code: 'RWA',
    label: '르완다',
    region: COFFEE_REGIONS.AFRICA,
    lat: -1.94,
    lng: 29.87,
    x: 583,
    y: 255,
    aliases: ['rwanda', '르완다'],
  },
  {
    code: 'BDI',
    label: '부룬디',
    region: COFFEE_REGIONS.AFRICA,
    lat: -3.37,
    lng: 29.92,
    x: 583,
    y: 260,
    aliases: ['burundi', '부룬디'],
  },
  {
    code: 'TZA',
    label: '탄자니아',
    region: COFFEE_REGIONS.AFRICA,
    lat: -6.37,
    lng: 34.89,
    x: 597,
    y: 268,
    aliases: ['tanzania', '탄자니아'],
  },
  {
    code: 'UGA',
    label: '우간다',
    region: COFFEE_REGIONS.AFRICA,
    lat: 1.37,
    lng: 32.29,
    x: 590,
    y: 246,
    aliases: ['uganda', '우간다'],
  },
  {
    code: 'YEM',
    label: '예멘',
    region: COFFEE_REGIONS.AFRICA,
    lat: 15.55,
    lng: 48.52,
    x: 635,
    y: 207,
    aliases: ['yemen', '예멘'],
  },

  // 아시아·태평양 (Asia-Pacific)
  {
    code: 'IDN',
    label: '인도네시아',
    region: COFFEE_REGIONS.ASIA_PACIFIC,
    lat: -0.79,
    lng: 113.92,
    x: 816,
    y: 252,
    aliases: ['indonesia', '인도네시아', '만델링', 'mandheling'],
  },
  {
    code: 'IND',
    label: '인도',
    region: COFFEE_REGIONS.ASIA_PACIFIC,
    lat: 14.5,
    lng: 76.5,
    x: 712,
    y: 210,
    aliases: ['india', '인도', '몬순'],
  },
  {
    code: 'PNG',
    label: '파푸아뉴기니',
    region: COFFEE_REGIONS.ASIA_PACIFIC,
    lat: -6.31,
    lng: 143.96,
    x: 900,
    y: 268,
    aliases: ['papua new guinea', '파푸아뉴기니', 'png'],
  },
  {
    code: 'MMR',
    label: '미얀마',
    region: COFFEE_REGIONS.ASIA_PACIFIC,
    lat: 21.92,
    lng: 95.96,
    x: 766,
    y: 189,
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
