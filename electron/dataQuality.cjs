// 게시 직전에 가격/용량이 비정상인 상품을 걸러내는 공통 검사 모듈.
// excluded: 명백히 잘못된 값(게시 데이터에서 제외)
// flagged: 값은 범위 안이지만 100g당 가격이 너무 낮거나 높아 확인이 필요한 항목(게시는 되지만 따로 기록)
const WEIGHT_MIN_G = 30;
const WEIGHT_MAX_G = 2000;
const PRICE_MIN_KRW = 1000;
const PRICE_MAX_KRW = 500000;
const PRICE_PER_100G_MIN = 500;
const PRICE_PER_100G_MAX = 150000;
// "대용량"인데 저장 용량이 이보다 작으면 200g 추측 오류로 본다
const BULK_MIN_WEIGHT_G = 400;
const BULK_KEYWORDS = /대용량|벌크|업소용/;

// 제목에 명시된 용량(g) 토큰을 모두 뽑는다. kg는 g으로 환산.
// "100g당" 같은 단가 표기와 "Guji/grade"처럼 g이 단어에 붙은 경우는 제외.
function extractTitleWeights(title) {
  const text = String(title || '');
  const grams = [];
  let match;

  const kgRegex = /(\d+(?:\.\d+)?)\s*kg/gi;
  while ((match = kgRegex.exec(text)) !== null) {
    grams.push(Math.round(parseFloat(match[1]) * 1000));
  }

  const gRegex = /(\d+(?:\.\d+)?)\s*g(?![a-zA-Z당])/gi;
  while ((match = gRegex.exec(text)) !== null) {
    grams.push(Math.round(parseFloat(match[1])));
  }

  return grams;
}

function validateProduct(product) {
  const price = Number(product?.price || 0);
  const weight = Number(product?.weight || 0);
  const title = product?.productName;
  const reasons = [];

  if (!(weight >= WEIGHT_MIN_G && weight <= WEIGHT_MAX_G)) {
    reasons.push(`용량 ${weight}g이 정상 범위(${WEIGHT_MIN_G}~${WEIGHT_MAX_G}g)를 벗어남`);
  }
  if (!(price >= PRICE_MIN_KRW && price <= PRICE_MAX_KRW)) {
    reasons.push(`가격 ${price}원이 정상 범위(${PRICE_MIN_KRW}~${PRICE_MAX_KRW}원)를 벗어남`);
  }

  // 제목에 적힌 용량과 저장 용량이 어긋나면(예: 제목 "1kg"인데 저장 200g) 거른다
  const titleWeights = extractTitleWeights(title);
  if (titleWeights.length > 0 && !titleWeights.includes(weight)) {
    reasons.push(`제목 용량(${titleWeights.join('/')}g)과 저장 용량(${weight}g)이 다름`);
  } else if (titleWeights.length === 0 && BULK_KEYWORDS.test(String(title || '')) && weight < BULK_MIN_WEIGHT_G) {
    reasons.push(`제목이 대용량인데 저장 용량(${weight}g)이 너무 작음`);
  }

  const excluded = reasons.length > 0;
  let per100 = null;
  let flagged = false;

  if (!excluded) {
    per100 = Math.round((price / weight) * 100);
    if (per100 < PRICE_PER_100G_MIN || per100 > PRICE_PER_100G_MAX) {
      flagged = true;
      reasons.push(`100g당 가격 ${per100}원이 일반적인 범위(${PRICE_PER_100G_MIN}~${PRICE_PER_100G_MAX}원)를 벗어나 확인 필요`);
    }
  }

  return { excluded, flagged, per100, reasons };
}

function summarizeProduct(product, result) {
  return {
    id: product?.id,
    roasterName: product?.roasterName,
    productName: product?.productName,
    price: product?.price,
    weight: product?.weight,
    per100: result.per100,
    reasons: result.reasons,
  };
}

function validateProducts(products) {
  const list = Array.isArray(products) ? products : [];
  const clean = [];
  const excluded = [];
  const flagged = [];

  for (const product of list) {
    const result = validateProduct(product);
    if (result.excluded) {
      excluded.push(summarizeProduct(product, result));
      continue;
    }
    clean.push(product);
    if (result.flagged) {
      flagged.push(summarizeProduct(product, result));
    }
  }

  return {
    clean,
    excluded,
    flagged,
    report: {
      total: list.length,
      cleanCount: clean.length,
      excludedCount: excluded.length,
      flaggedCount: flagged.length,
    },
  };
}

module.exports = {
  WEIGHT_MIN_G,
  WEIGHT_MAX_G,
  PRICE_MIN_KRW,
  PRICE_MAX_KRW,
  PRICE_PER_100G_MIN,
  PRICE_PER_100G_MAX,
  BULK_MIN_WEIGHT_G,
  extractTitleWeights,
  validateProduct,
  validateProducts,
};
