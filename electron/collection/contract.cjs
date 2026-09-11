// 수집 엔진 교체 2단계: 공통 식별자·근거·완전성·실행 상태의 데이터 계약.
// 설계: .wiki/wiki/topics/roastery-collection-engine-replacement-2026-09-10.md
// 이 모듈은 순수 함수만 담는다. 네트워크·파일 접근은 하지 않는다.
const crypto = require('node:crypto');

// ── 완전성 상태 ────────────────────────────────────────────────
// 실제 0개(empty)·수집 실패(failed)·부분 응답(partial)·접근 차단(blocked)을 서로 다른 상태로 남긴다.
const COMPLETENESS = {
  COMPLETE: 'complete',
  PARTIAL: 'partial',
  EMPTY: 'empty',
  FAILED: 'failed',
  BLOCKED: 'blocked',
};

// ── 추출 방법과 기본 신뢰도 ────────────────────────────────────
// 앞쪽일수록 근거가 강하다. 같은 신뢰도면 이 순서로 이긴다.
const EXTRACTION_METHODS = [
  'structuredData',
  'internalApi',
  'domTable',
  'renderedDom',
  'domText',
  'imageOcr',
  'vision',
  'previousSnapshot',
];

const METHOD_RANK = Object.fromEntries(EXTRACTION_METHODS.map((method, index) => [method, index]));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function requireText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label}이(가) 필요합니다`);
  return text;
}

// ── 공통 식별자 ────────────────────────────────────────────────
// 로스터리 / 판매채널 / 판매채널 상품 / 옵션을 분리한다.
// 판매처가 주는 고유 상품 번호가 없으면 확정 ID를 만들지 않는다. 이름만으로 병합하지 않기 위해서다.
function createChannelId(roasteryId, channelType) {
  return `${requireText(roasteryId, '로스터리 ID')}:${requireText(channelType, '판매 경로')}`;
}

function createChannelProductId(channelId, externalProductId) {
  const external = String(externalProductId ?? '').trim();
  if (!external) return null;
  return `${requireText(channelId, '판매채널 ID')}::${external}`;
}

function createOptionId(channelProductId, { weightGram, grind = '' } = {}) {
  const weight = Number(weightGram || 0);
  if (!channelProductId || !(weight > 0)) return null;
  const grindPart = String(grind || '').trim();
  return `${channelProductId}::${weight}g${grindPart ? `:${grindPart}` : ''}`;
}

function parseChannelProductId(channelProductId) {
  const text = String(channelProductId || '');
  const separator = text.indexOf('::');
  if (separator < 0) return null;
  const channelId = text.slice(0, separator);
  const [roasteryId, channelType] = channelId.split(':');
  return { channelId, roasteryId, channelType, externalProductId: text.slice(separator + 2) };
}

// ── RawObservation: 해석하기 전의 원문 ─────────────────────────
function createRawObservation({ channelId, url, body, contentType = 'text/html', fetchedAt = new Date().toISOString() }) {
  requireText(channelId, '판매채널 ID');
  requireText(url, '원문 URL');
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''), 'utf8');
  const digest = sha256(buffer);
  // 서로 다른 판매처가 같은 내용(예: 빈 목록)을 돌려줘도 한 관측으로 합쳐지면 채널 귀속이 뒤섞인다.
  return {
    observationId: `obs:${sha256([channelId, digest].join('|')).slice(0, 16)}`,
    channelId,
    url,
    contentType,
    fetchedAt,
    bytes: buffer.length,
    sha256: digest,
  };
}

// ── FieldClaim: 근거를 가진 값 하나 ────────────────────────────
function createFieldClaim({
  field,
  value,
  subjectId,
  observationId,
  locator,
  method,
  confidence = 0.5,
  extractorVersion,
  observedAt,
  interpretedAt = new Date().toISOString(),
}) {
  requireText(field, '필드명');
  requireText(subjectId, '대상 ID');
  requireText(observationId, '근거 관측 ID');
  requireText(locator, '근거 위치');
  requireText(extractorVersion, '추출기 버전');
  requireText(observedAt, '관측 시각');
  if (!METHOD_RANK[method] && METHOD_RANK[method] !== 0) {
    throw new Error(`알 수 없는 추출 방법입니다: ${method}`);
  }
  if (value === undefined || value === null || value === '') {
    throw new Error(`${field}의 값이 비어 있습니다`);
  }
  const score = Number(confidence);
  if (!(score >= 0 && score <= 1)) throw new Error(`${field}의 신뢰도가 0~1을 벗어났습니다: ${confidence}`);
  return { field, value, subjectId, observationId, locator, method, confidence: score, extractorVersion, observedAt, interpretedAt };
}

function compareClaims(left, right) {
  if (left.confidence !== right.confidence) return right.confidence - left.confidence;
  if (METHOD_RANK[left.method] !== METHOD_RANK[right.method]) return METHOD_RANK[left.method] - METHOD_RANK[right.method];
  return String(right.observedAt).localeCompare(String(left.observedAt));
}

// 필드별로 가장 근거가 강한 주장 하나만 확정값으로 승격한다.
function resolveClaims(claims) {
  const byField = new Map();
  for (const claim of claims) {
    const current = byField.get(claim.field);
    if (!current || compareClaims(claim, current) < 0) byField.set(claim.field, claim);
  }
  const values = {};
  const evidence = {};
  for (const [field, claim] of byField) {
    values[field] = claim.value;
    evidence[field] = claim;
  }
  return { values, evidence };
}

// ── 목록·옵션 완전성 ───────────────────────────────────────────
function evaluateListCompleteness({ blocked = false, pagesFetched = 0, pagesFailed = 0, endConfirmed = false, itemsFound = 0 } = {}) {
  if (blocked) return COMPLETENESS.BLOCKED;
  if (pagesFetched <= 0) return COMPLETENESS.FAILED;
  if (pagesFailed > 0 || !endConfirmed) return COMPLETENESS.PARTIAL;
  if (itemsFound <= 0) return COMPLETENESS.EMPTY;
  return COMPLETENESS.COMPLETE;
}

// 한 판매처가 카테고리·페이지 여러 개로 나뉠 때, 부분이 하나라도 불완전하면 전체도 완전이 아니다.
const COMPLETENESS_SEVERITY = [COMPLETENESS.COMPLETE, COMPLETENESS.EMPTY, COMPLETENESS.PARTIAL, COMPLETENESS.BLOCKED, COMPLETENESS.FAILED];

function combineListCompleteness(states) {
  const list = [...states];
  if (list.length === 0) return COMPLETENESS.FAILED;
  // 어느 부분에서도 받은 게 없으면 부분 수집이 아니라 실패·차단이다.
  const gotSomething = list.some((state) => state !== COMPLETENESS.FAILED && state !== COMPLETENESS.BLOCKED);
  if (!gotSomething) return list.includes(COMPLETENESS.FAILED) ? COMPLETENESS.FAILED : COMPLETENESS.BLOCKED;
  if (list.every((state) => state === COMPLETENESS.EMPTY)) return COMPLETENESS.EMPTY;
  const worst = list.reduce((acc, state) => (COMPLETENESS_SEVERITY.indexOf(state) > COMPLETENESS_SEVERITY.indexOf(acc) ? state : acc), COMPLETENESS.COMPLETE);
  // 일부만 실패·차단이면 나머지는 받았으므로 전체는 부분 수집이다.
  return worst === COMPLETENESS.COMPLETE || worst === COMPLETENESS.EMPTY ? COMPLETENESS.COMPLETE : COMPLETENESS.PARTIAL;
}

function evaluateOptionCompleteness({ blocked = false, enumerationConfirmed = false, observedCount = 0, expectedCount = null } = {}) {
  if (blocked) return COMPLETENESS.BLOCKED;
  if (!enumerationConfirmed) return observedCount > 0 ? COMPLETENESS.PARTIAL : COMPLETENESS.FAILED;
  if (observedCount <= 0) return COMPLETENESS.EMPTY;
  if (Number(expectedCount) > 0 && observedCount < Number(expectedCount)) return COMPLETENESS.PARTIAL;
  return COMPLETENESS.COMPLETE;
}

// ── 수집 실행 상태 ─────────────────────────────────────────────
// 판매처별 소요시간과 실패를 실행 단위로 남긴다. 한 소스가 실패해도 다른 소스 결과는 유지한다.
function createCollectionRun({ runId = `run:${Date.now()}`, startedAt = new Date().toISOString(), now = () => Date.now() } = {}) {
  const sources = new Map();
  const startedMs = now();

  return {
    runId,
    startedAt,
    beginSource(channelId) {
      requireText(channelId, '판매채널 ID');
      sources.set(channelId, { channelId, startedMs: now(), status: COMPLETENESS.FAILED, itemCount: 0, error: null, usedFallback: false });
    },
    endSource(channelId, { status, itemCount = 0, error = null, usedFallback = false } = {}) {
      const entry = sources.get(channelId);
      if (!entry) throw new Error(`시작하지 않은 판매채널입니다: ${channelId}`);
      if (!Object.values(COMPLETENESS).includes(status)) throw new Error(`알 수 없는 수집 상태입니다: ${status}`);
      entry.status = status;
      entry.itemCount = itemCount;
      entry.error = error ? String(error) : null;
      entry.usedFallback = Boolean(usedFallback);
      entry.elapsedMs = now() - entry.startedMs;
    },
    finish() {
      const list = [...sources.values()].map(({ startedMs: _drop, ...rest }) => ({ ...rest, elapsedMs: rest.elapsedMs ?? null }));
      return {
        runId,
        startedAt,
        elapsedMs: now() - startedMs,
        sources: list,
        succeededSources: list.filter((entry) => entry.status === COMPLETENESS.COMPLETE).length,
        // 이전 스냅샷으로 메운 판매처는 최신 수집 성공으로 세지 않는다.
        fallbackSources: list.filter((entry) => entry.usedFallback).length,
      };
    },
  };
}

// ── 기존 출력 호환층 ───────────────────────────────────────────
const LEGACY_OPTION_STATUS = {
  [COMPLETENESS.COMPLETE]: 'complete',
  [COMPLETENESS.PARTIAL]: 'partial',
  [COMPLETENESS.EMPTY]: 'partial',
  [COMPLETENESS.FAILED]: 'failed',
  [COMPLETENESS.BLOCKED]: 'failed',
};

// 계약 레코드를 기존 화면·게시 가드가 읽는 상품 모양으로 되돌린다.
function toLegacyProduct(record) {
  const options = Array.isArray(record.options) ? record.options : [];
  const rawStatus = LEGACY_OPTION_STATUS[record.optionCompleteness] || 'failed';
  // 근거가 되는 옵션이 하나도 없으면 완전 수집으로 표시하지 않는다.
  const status = rawStatus === 'complete' && options.length === 0 ? 'partial' : rawStatus;
  const cheapest = [...options].filter((option) => Number(option.price) > 0).sort((a, b) => a.price - b.price)[0] || null;
  // 대표 가격·중량은 레코드 값이 우선이다. 옵션 최저가로 덮으면 가격 이력과 게시 가드 비교 대상이 달라진다.
  const price = Number(record.price) > 0 ? Number(record.price) : Number(cheapest?.price || 0);
  const weight = Number(record.weight) > 0 ? Number(record.weight) : Number(cheapest?.weight || 0);
  return {
    id: record.legacyId || record.channelProductId,
    roasterName: record.roasterName,
    productName: record.productName,
    productUrl: record.productUrl || '',
    price,
    weight,
    priceOptions: options.map((option) => ({ ...option })),
    priceOptionsStatus: status,
    priceOptionsComplete: status === 'complete' && options.length > 0,
    isSoldOut: Boolean(record.isSoldOut),
    tastingNotes: Array.isArray(record.tastingNotes) ? [...record.tastingNotes] : [],
    lastObservedAt: record.lastObservedAt || null,
    // 폴백으로 메운 값은 화면과 가드가 구분할 수 있게 표시를 남긴다.
    isStale: Boolean(record.usedFallback),
    // 최신성 표시는 계약을 지나도 그대로 유지한다. 여기서 잃으면 오래된 값이 최신으로 둔갑한다.
    ...(record.lastCheckedAt === undefined ? {} : { lastCheckedAt: record.lastCheckedAt }),
    ...(record.checkedMinutesAgo === undefined ? {} : { checkedMinutesAgo: record.checkedMinutesAgo }),
    ...(record.roasterPreservedReason ? { roasterPreservedReason: record.roasterPreservedReason } : {}),
  };
}

// 수집에 실패해 이전 데이터를 그대로 쓰는 상품을 표시한다.
// 가격·할인 값은 건드리지 않는다. 값을 지우면 게시 가드가 "정상가 정보만 사라짐"으로 오해한다.
function markStaleProduct(product, { observedAtMs, nowMs = Date.now(), reason = '수집 실패로 이전 데이터 유지' } = {}) {
  const observedAt = Number(observedAtMs) > 0 ? Number(observedAtMs) : null;
  const staleMinutes = observedAt ? Math.max(0, Math.round((nowMs - observedAt) / 60000)) : null;
  return {
    ...product,
    roasterPreservedReason: reason,
    isStale: true,
    lastObservedAt: observedAt ? new Date(observedAt).toISOString() : (product.lastObservedAt || null),
    // 이번 실행에서 확인한 값이 아니므로 "방금 전"으로 표시하지 않는다.
    lastCheckedAt: staleMinutes === null ? '갱신 실패 · 이전 정보' : `갱신 실패 · ${formatAgo(staleMinutes)} 정보`,
    checkedMinutesAgo: staleMinutes === null ? (Number(product.checkedMinutesAgo) || 0) : staleMinutes,
  };
}

function formatAgo(minutes) {
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / (60 * 24))}일 전`;
}

// 판매처가 주는 고유 상품 번호를 URL에서 찾는다. 못 찾으면 확정 ID를 만들지 않는다.
function extractExternalProductId(productUrl) {
  const url = String(productUrl || '');
  return url.match(/smartstore\.naver\.com\/[^/]+\/products\/(\d+)/i)?.[1]
    || url.match(/[?&]product_no=(\d+)/i)?.[1]
    || url.match(/[?&]ItemCode=(\d+)/i)?.[1]
    || url.match(/\/product\/detail\/(\d+)/i)?.[1]
    // cafe24 예쁜 주소: /product/<상품명>/<상품번호>/category/...
    || url.match(/\/product\/[^/]+\/(\d+)(?:\/|$)/i)?.[1]
    // imweb 계열 상세: /shop_view/<상품번호>
    || url.match(/\/shop_view\/(\d+)/i)?.[1]
    || '';
}

// 기존 엔진 출력을 계약 레코드로 올린다. 값을 새로 만들지 않고 상태만 정확히 붙인다.
function fromLegacyProduct(product, { channelId, observedAt = new Date().toISOString() } = {}) {
  requireText(channelId, '판매채널 ID');
  const options = Array.isArray(product.priceOptions) ? product.priceOptions : [];
  const externalProductId = extractExternalProductId(product.productUrl);
  const channelProductId = createChannelProductId(channelId, externalProductId);
  const optionCompleteness = evaluateOptionCompleteness({
    enumerationConfirmed: product.priceOptionsComplete === true,
    observedCount: options.length,
  });
  return {
    channelId,
    channelProductId,
    legacyId: product.id,
    identified: Boolean(channelProductId),
    roasterName: product.roasterName,
    productName: product.productName,
    productUrl: product.productUrl || '',
    price: Number(product.price || 0),
    weight: Number(product.weight || 0),
    options: options.map((option) => ({ ...option, optionId: createOptionId(channelProductId, { weightGram: option.weight }) })),
    optionCompleteness,
    isSoldOut: Boolean(product.isSoldOut),
    tastingNotes: Array.isArray(product.tastingNotes) ? [...product.tastingNotes] : [],
    // 이전 데이터로 메운 상품은 그 사실과 마지막 관측 시각을 그대로 가지고 들어온다.
    usedFallback: Boolean(product.isStale || product.roasterPreservedReason),
    lastObservedAt: product.lastObservedAt || observedAt,
    lastCheckedAt: product.lastCheckedAt,
    checkedMinutesAgo: product.checkedMinutesAgo,
    roasterPreservedReason: product.roasterPreservedReason || '',
  };
}

module.exports = {
  COMPLETENESS,
  EXTRACTION_METHODS,
  createChannelId,
  createChannelProductId,
  createOptionId,
  parseChannelProductId,
  createRawObservation,
  createFieldClaim,
  resolveClaims,
  evaluateListCompleteness,
  combineListCompleteness,
  evaluateOptionCompleteness,
  createCollectionRun,
  markStaleProduct,
  toLegacyProduct,
  fromLegacyProduct,
  extractExternalProductId,
};
