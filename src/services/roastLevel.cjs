// 로스팅(roast) 레벨 추출 — FIX-3
// extractRoastLevel(text): 텍스트에서 로스팅 표현을 찾아 5단계 enum으로 반환.
//   'Light' | 'Medium-Light' | 'Medium' | 'Medium-Dark' | 'Dark' | ''(없음/모호함)
// getDisplayRoastLevel(product): 앱 표시용. 저장된 roastLevel이 '확인 필요'/빈 값이 아닐 때만
//   그대로 쓰고, 그 외에는 상품명에서 보완. 수집·상세에서 온 값을 절대 덮어쓰지 않는다.
//
// 매핑표 (golden + 사용자 결정 2026-09-25 roast 5단계 enum):
//   약배전→Light, 중약배전→Medium-Light, 중배전→Medium, 중강배전→Medium-Dark, 강배전→Dark
// 매핑하지 않는 것 (corpus 근거 없음 또는 오탐):
//   시나몬/시티/풀시티/프렌치/이탈리안/비엔나 (컵노트·스타일명으로 쓰임),
//   필터/에스프레소 로스트 (출현 0), Well-done/웰던 (enum 매핑 불가, golden 명시)

const ROAST_LEVELS = ['Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark'];

// 오탐 마스크: 매칭 전에 지워버리는 비-로스팅 용법
const FALSE_POSITIVE_MASKS = [
  /다크\s*초콜릿/gi, // 컵노트
  /다크\s*체리/gi, // 컵노트
  /라이트\s*바디/gi, // 컵노트 (바디감)
  /다크\s*우드/gi, // 라인명 (다크우드)
  /dark\s*wood/gi, // 라인명·음악 (Darkwood, Dark Wood)
  /다크\s*브라운/gi, // 색상 표현 (다크 브라운)
  /다크\s*딥/gi, // 블렌드명 (다크딥 블랜딩)
  /(다크|라이트|미디[엄움]|약배전|중배전|강배전|중강배전|중약배전)(\s*(로스팅|로스트|배전))?\s*인가요\??/gi, // 질문형 (다크로스팅인가요?, 약배전인가요?)
  /필디카프(\s*다크)?/gi, // 라인명 ("필디카프 다크" 포함)
  /프렌치\s*프레스/gi, // 추출기구 (프렌치로스트와 무관)
];

// 명시적 표기 (볶음도/배전도/로스팅 + 값) — 가장 우선
// 명시적 표기 — 가장 우선. 한국어 특성상 값이 표기 뒤(로스팅 강배전)와 앞(다크 로스팅)에 모두 올 수 있다.
const EXPLICIT_MARKER_WORD = '(?:볶음도|배전도|로스팅|roasting\\s*point)';
const EXPLICIT_VALUE_SRC = '(?:중강배전|중약배전|강배전|약배전|중배전|미디[엄움]\\s*-?\\s*다크|미디[엄움]\\s*-?\\s*라이트|미디[엄움]|medium\\s*-?\\s*dark|medium\\s*-?\\s*light|medium|다크|dark|라이트|light)';
const EXPLICIT_AFTER_RX = new RegExp(EXPLICIT_MARKER_WORD + '\\s*[:：]?\\s*' + EXPLICIT_VALUE_SRC, 'gi');
const EXPLICIT_BEFORE_RX = new RegExp(EXPLICIT_VALUE_SRC + '\\s*' + EXPLICIT_MARKER_WORD, 'gi');
const EXPLICIT_VALUE_MAP = [
  [/중강배전/, 'Medium-Dark'],
  [/중약배전/, 'Medium-Light'],
  [/강배전/, 'Dark'],
  [/약배전/, 'Light'],
  [/중배전/, 'Medium'],
  [/미디[엄움]\s*-?\s*다크/i, 'Medium-Dark'],
  [/미디[엄움]\s*-?\s*라이트/i, 'Medium-Light'],
  [/미디[엄움]/i, 'Medium'],
  [/medium\s*-?\s*dark/i, 'Medium-Dark'],
  [/medium\s*-?\s*light/i, 'Medium-Light'],
  [/\bmedium\b/i, 'Medium'],
  [/다크/i, 'Dark'],
  [/\bdark\b/i, 'Dark'],
  [/라이트/i, 'Light'],
  [/\blight\b/i, 'Light'],
];

// 일반 표현 (구체적인 것 먼저 — 중강배전이 강배전보다 먼저 오도록)
const ROAST_PATTERNS = [
  [/중강배전/, 'Medium-Dark'],
  [/미디[엄움]\s*다크\s*로스트/i, 'Medium-Dark'],
  [/미디[엄움]\s*-?\s*다크/i, 'Medium-Dark'],
  [/medium\s*-?\s*dark/i, 'Medium-Dark'],
  [/medium\s*dark\s*roast/i, 'Medium-Dark'],
  [/중약배전/, 'Medium-Light'],
  [/미디[엄움]\s*라이트\s*로스트/i, 'Medium-Light'],
  [/미디[엄움]\s*-?\s*라이트/i, 'Medium-Light'],
  [/medium\s*-?\s*light/i, 'Medium-Light'],
  [/medium\s*light\s*roast/i, 'Medium-Light'],
  [/강배전/, 'Dark'],
  [/다크\s*로스트/i, 'Dark'],
  [/\bdark\s*roast\b/i, 'Dark'],
  [/다크(?!\s*초콜릿|\s*체리)/, 'Dark'],
  [/\bdark\b/i, 'Dark'],
  [/약배전/, 'Light'],
  [/라이트\s*로스트/i, 'Light'],
  [/\blight\s*roast\b/i, 'Light'],
  [/라이트(?!\s*바디)/, 'Light'],
  [/\blight\b/i, 'Light'],
  [/중배전/, 'Medium'],
  [/미디[엄움]\s*로스트/i, 'Medium'],
  [/\bmedium\s*roast\b/i, 'Medium'],
  [/미디[엄움]/, 'Medium'],
  [/\bmedium\b/i, 'Medium'],
];

function maskFalsePositives(text) {
  let out = String(text || '');
  for (const rx of FALSE_POSITIVE_MASKS) {
    out = out.replace(rx, ' ');
  }
  return out;
}

function blankMatch(text, index, length) {
  return text.slice(0, index) + ' '.repeat(length) + text.slice(index + length);
}

function mapExplicitValue(text) {
  for (const [rx, level] of EXPLICIT_VALUE_MAP) {
    rx.lastIndex = 0;
    if (rx.test(text)) return level;
  }
  return '';
}

// 명시적 표기(볶음도/배전도/로스팅 + 값)에서 레벨 추출. 없거나 모호하면 ''.
function extractExplicit(text) {
  const found = new Set();
  let m;
  EXPLICIT_AFTER_RX.lastIndex = 0;
  while ((m = EXPLICIT_AFTER_RX.exec(text)) !== null) {
    const level = mapExplicitValue(m[0]);
    if (level) found.add(level);
    if (m[0].length === 0) break;
  }
  EXPLICIT_BEFORE_RX.lastIndex = 0;
  while ((m = EXPLICIT_BEFORE_RX.exec(text)) !== null) {
    const level = mapExplicitValue(m[0]);
    if (level) found.add(level);
    if (m[0].length === 0) break;
  }
  if (found.size === 1) return [...found][0];
  return '';
}

function extractRoastLevel(text) {
  if (!text) return '';
  const work0 = maskFalsePositives(text);
  // 1순위: 명시적 표기
  const explicit = extractExplicit(work0);
  if (explicit) return explicit;
  // Well-done 단독이면 비움 (모호한 추측 금지)
  // 2순위: 일반 표현 — 매칭된 구간을 지워가며 중복 집계 방지
  let work = work0;
  const found = new Set();
  for (const [rx, level] of ROAST_PATTERNS) {
    rx.lastIndex = 0;
    let m;
    // eslint-disable-next-line no-cond-assign
    while ((m = rx.exec(work)) !== null) {
      found.add(level);
      work = blankMatch(work, m.index, m[0].length);
      rx.lastIndex = 0;
      if (m[0].length === 0) break;
    }
  }
  // 서로 다른 레벨이 2개 이상이면 모호함 → 비움 ("라이트/다크 선택" 등)
  if (found.size === 1) return [...found][0];
  return '';
}

function isRoastLevelUnknown(value) {
  return !value || value === '확인 필요';
}

// 앱 표시용: 저장된 값이 있으면 절대 덮어쓰지 않고, '확인 필요'/빈 값일 때만 상품명으로 보완.
// 상품명은 짧아 색상·라인명 오탐이 많으므로(예: '다크브라운', '[에어리커피] 다크 블렌드'),
// 로스트 표기(로스트·배전·볶음·로스팅)가 있을 때만 인정한다.
const NAME_ROAST_MARKER = /로스트|배전|볶음|로스팅/i;

function getDisplayRoastLevel(product) {
  const stored = product ? product.roastLevel : '';
  if (!isRoastLevelUnknown(stored)) return stored;
  const name = product ? product.productName || '' : '';
  if (!NAME_ROAST_MARKER.test(name)) return '';
  return extractRoastLevel(name);
}

module.exports = {
  ROAST_LEVELS,
  extractRoastLevel,
  getDisplayRoastLevel,
  isRoastLevelUnknown,
};
