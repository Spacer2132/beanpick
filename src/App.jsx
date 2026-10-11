import React from 'react';
import { mockBeans } from './data/mockBeans.ts';
import { CHANNEL_LABEL, SOURCE_STATUS_LABEL, roasterySources } from './data/roasterySources.ts';
import { normalizeCafe24Pages } from './services/adapters/cafe24OfficialAdapter.ts';
import { normalizeMomosPages } from './services/adapters/momosOfficialAdapter.ts';
import { OFFICIAL_MALL_CONFIGS } from './services/adapters/officialMallConfigs.ts';
import { enrichTerarosaProducts, normalizeTerarosaApiRows, parseTerarosaHtmlProducts } from './services/adapters/terarosaOfficialAdapter.ts';
import { getDisplayRoastLevel } from './services/roastLevel.js';
import {
  createPriceOptions,
  filterDiscountProducts,
  formatPrice,
  formatProductDisplayInfo,
  getNoteOptions,
  getPricePer100g,
  getProductCountryLabel,
  getProductOriginLabel,
  getProductProcessLabel,
  getRepresentativePriceOption,
  groupProductsByNameAndWeight,
  isDecafProduct,
  isGroundCoffeeProduct,
  isOnePlusOneProduct,
  isRealProductUrl,
  matchesCapacityFilter,
  matchesNoteQuery,
  matchesSmartSearch,
  normalizeProducts,
  normalizeWholeBeanProductName,
  resolveProductOpenUrl,
  sortProducts,
} from './services/coreFeatures.js';
import { createMonitorSummary, loadFavoriteProductIds, saveFavoriteProductIds, saveProductSnapshot } from './services/monitoring.ts';
import { getPublishButtonLabel, loadPublishedSnapshot } from './services/publishedSnapshot.js';
import { loadProductCache, saveProductCache } from './services/productHistory.js';
import { getDisplayTastingNotes, getPendingTastingNotes, normalizeTastingNotes } from './services/tastingNotes.js';
import WorldCoffeeMap from './components/WorldCoffeeMap.jsx';
import { extractProductCountries } from './services/mapCoordinates.js';
import { STORY_SECTIONS, VARIETY_TIERS, matchSingleVarietyIds } from './data/varietyGuide.js';

const NAV = [
  { id: 'explore', label: '탐색', group: '둘러보기' },
  { id: 'products', label: '원두', group: '둘러보기', badge: mockBeans.length },
  { id: 'map', label: '지도', group: '둘러보기' },
  { id: 'sources', label: '로스터리', group: '데이터', badge: roasterySources.length },
  { id: 'alerts', label: '관심', group: '둘러보기', badge: 0 },
  { id: 'server', label: '앱 상태', group: '데이터' },
];

function productSearchText(product) {
  const displayInfo = formatProductDisplayInfo(product);
  const cleanProductName = normalizeWholeBeanProductName(product.productName);
  const optionText = (product.priceOptions || [])
    .flatMap((option) => [option.weightLabel, option.priceLabel, option.unitPriceLabel])
    .filter(Boolean);

  return [
    product.roasterName,
    cleanProductName,
    product.origin,
    product.process,
    product.roastLevel,
    product.variety,
    product.farm,
    displayInfo.primary,
    displayInfo.variety,
    displayInfo.process,
    displayInfo.farm,
    product.weight ? `${product.weight}g` : '',
    product.price ? String(product.price) : '',
    product.price ? formatPrice(product.price) : '',
    product.weightLabel,
    product.priceLabel,
    ...optionText,
    ...product.tastingNotes,
    ...getDisplayTastingNotes(product),
  ].filter(Boolean).join(' ').toLowerCase();
}

function matchesDetailQuery(product, query) {
  return matchesSmartSearch(productSearchText(product), query);
}

function matchesBudgetFilter(product, budget) {
  if (budget === 'all') return true;
  const prices = [
    product.price,
    ...(product.priceOptions || []).map((option) => option.price),
  ].map((price) => Number(price || 0)).filter((price) => price > 0);
  const lowestPrice = prices.length ? Math.min(...prices) : 0;

  if (budget === 'under30000') return lowestPrice > 0 && lowestPrice <= 30000;
  if (budget === 'under50000') return lowestPrice > 0 && lowestPrice <= 50000;
  return true;
}

function countLabelOptions(products, getLabel) {
  const counts = new Map();

  products.forEach((product) => {
    const label = getLabel(product);
    if (label) counts.set(label, (counts.get(label) || 0) + 1);
  });

  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
}

function formatDateTime(value) {
  if (!value) return '아직 불러오지 않음';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function canLoadLiveProducts() {
  return Boolean(
    window.beanpick?.listCollectionSources
    && window.beanpick?.fetchCollectionSource
    && window.beanpick?.promoteCollectionProducts
  );
}

const LIVE_SOURCE_LOAD_CONCURRENCY = 3;

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function promoteCollectionProducts(sourceId, products) {
  const promoted = await window.beanpick.promoteCollectionProducts(sourceId, products);
  if (!promoted?.ok) throw new Error(promoted?.error || `${sourceId} 수집 계약을 적용하지 못했습니다.`);
  return promoted.products || [];
}

function dataModeLabel(dataMode) {
  if (dataMode === 'live') return '실제';
  if (dataMode === 'cached') return '저장됨';
  if (dataMode === 'published') return '게시됨';
  return '샘플';
}

function dataModeDescription(dataMode) {
  if (dataMode === 'live') return '실제 상품 표시 중';
  if (dataMode === 'cached') return '저장된 상품 표시 중';
  if (dataMode === 'published') return '아이폰용 게시 데이터 표시 중';
  return '샘플 상품 표시 중';
}

function dataModeSourceLabel(dataMode) {
  if (dataMode === 'live') return '실시간';
  if (dataMode === 'cached') return '저장된 데이터';
  if (dataMode === 'published') return '게시된 데이터';
  return '샘플 데이터';
}

function Stat({ label, value, delta }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{delta}</em>
    </div>
  );
}

// 관심 원두가 재입고되면 시스템 알림을 보낸다.
function notifyFavoriteChanges(changes, favoriteIds) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  changes.filter((change) => favoriteIds.includes(change.id)).forEach((change) => {
    try {
      if (change.type === 'restocked') {
        new Notification('BeanPick · 재입고', { body: change.detail });
      }
    } catch {
      // 알림을 못 보내도 앱 동작은 계속한다.
    }
  });
}

// 카드를 누르면 열리는 원두 상세 보기 창
function ProductDetailModal({ isFavorite, product, onClose, onToggleFavorite, onSelectVariety }) {
  React.useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const displayInfo = formatProductDisplayInfo(product);
  const productLink = isRealProductUrl(product.productUrl) ? product.productUrl : '';
  const storeLink = isRealProductUrl(product.storeUrl) && product.storeUrl !== productLink ? product.storeUrl : '';
  const priceOptions = product.priceOptions?.length ? product.priceOptions : createPriceOptions([product]);
  const titleUnitPriceLabel = getBestUnitPriceLabel(product, priceOptions);
  const infoRows = [
    ['로스터리', product.roasterName],
    ['원산지', getProductOriginLabel(product)],
    ['가공방식', displayInfo.process || product.process],
    ['품종', displayInfo.variety],
    ['농장', displayInfo.farm],
    ['로스팅', getDisplayRoastLevel(product) || product.roastLevel],
  ].filter(([, value]) => Boolean(value) && value !== '확인 필요'); // 수집 단계의 '확인 필요'는 손님에게 보이지 않게 줄째 숨긴다.

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={`${product.productName} 상세 정보`} onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}><Icon name="close" size={22} /></button>

        <div className="modal-top">
          <div className="modal-image">
            {product.imageUrl
              ? <img src={product.imageUrl} alt="" />
              : <span className="bean-image-placeholder">{product.roasterName.slice(0, 2)}</span>}
            {product.isSoldOut && <span className="soldout-ribbon">품절</span>}
          </div>
          <div className="modal-info">
            <span className="modal-roaster">{product.roasterName}</span>
            <h2>
              {displayInfo.primary}
              {titleUnitPriceLabel && <span className="bean-title-unit-price">({titleUnitPriceLabel})</span>}
            </h2>
            <p className="modal-original-name">{product.productName}</p>
            <dl className="modal-spec">
              {infoRows.map(([label, value]) => {
                const varietyId = label === '품종' ? matchSingleVarietyIds(product.variety || value)[0] : null;
                return (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {varietyId ? (
                        <button className="detail-variety-link" type="button" onClick={() => onSelectVariety(varietyId)}>
                          {value} <span aria-hidden="true">›</span>
                        </button>
                      ) : value}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {product.blendComposition && product.blendComposition.length > 0 && (
              <div className="bean-blend-info">
                <span className="bean-blend-label">블렌딩</span>
                {product.blendComposition.map((c) => (
                  <span key={c.country} className="bean-blend-chip">{c.country} {c.percent}%</span>
                ))}
              </div>
            )}
            {getDisplayTastingNotes(product).length > 0 && (
              <div className="notes">
                {getDisplayTastingNotes(product).map((note) => <span className="note-tag is-static" key={note}>{note}</span>)}
              </div>
            )}
            {/* 검수용 원문 링크는 PC 운영 앱에서만 보여준다. */}
            {canLoadLiveProducts() && getPendingTastingNotes(product).length > 0 && (
              <p className="modal-original-name">
                확인할 원문: {getPendingTastingNotes(product).map((entry, index) => (
                  <React.Fragment key={`${entry.sourceUrl}-${entry.group || ''}-${entry.text}`}>
                    {index > 0 && ' · '}
                    <a href={entry.sourceUrl} target="_blank" rel="noreferrer">{entry.group ? `${entry.group}: ` : ''}{entry.text}{entry.reviewReason === 'process-conflict' ? ' (가공 방식 확인 필요)' : ''}</a>
                  </React.Fragment>
                ))}
              </p>
            )}
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-head">
            <h3>가격</h3>
          </div>
          <div className="bean-price-options">
            {priceOptions.map((option) => (
              // 가격 옵션은 쇼핑몰로 바로 나가지 않는다. 쇼핑몰 이동은 아래 '상품 페이지 열기' 버튼에서만 한다.
              <div className="bean-price-option" key={option.id}>
                {option.originalPriceLabel && <del>{option.originalPriceLabel}</del>}
                <strong>{option.priceLabel}</strong>
                {option.discountLabel && <small>{option.discountLabel}</small>}
                <span>{option.weightLabel}</span>
                {option.unitPriceLabel && option.unitPriceLabel.split('/')[0]?.trim() !== option.priceLabel?.trim() && <em>{option.unitPriceLabel}</em>}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className={`btn btn-favorite ${isFavorite ? 'active' : ''}`} type="button" onClick={() => onToggleFavorite(product.id)}>
            <Icon name="heart" size={18} />
            {isFavorite ? '관심 해제' : '관심 저장'}
          </button>
          {storeLink && (
            <a className="btn" href={resolveProductOpenUrl(storeLink, product)} target="_blank" rel="noreferrer">원두 목록 보기</a>
          )}
          {productLink && (
            <a className="btn btn-primary" href={resolveProductOpenUrl(productLink, product)} target="_blank" rel="noreferrer">상품 페이지 열기</a>
          )}
        </div>
      </div>
    </div>
  );
}

// 선 아이콘 한 벌. 글자 기호(♡·↑)나 이모지는 기기마다 모양이 달라 SVG로 통일한다.
const ICON_PATHS = {
  bean: <><ellipse cx="12" cy="12" rx="6" ry="9" transform="rotate(35 12 12)" /><path d="M8.6 6.2c3.2 2.6 3.6 8.8 6.8 11.6" /></>,
  map: <><path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z" /><path d="M9 4v14M15 6v14" /></>,
  store: <><path d="M4 9.5L5.5 4h13L20 9.5" /><path d="M4 9.5h16c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3" /><path d="M5.5 12.3V20h13v-7.7" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />,
  status: <><path d="M4 18a8 8 0 1 1 16 0" /><path d="M12 18l4-5" /></>,
  filter: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  chevron: <path d="M6 9l6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  sparkle: <><path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9L11 3z" /><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z" /></>,
};
const NAV_ICONS = { explore: 'sparkle', products: 'bean', map: 'map', sources: 'store', alerts: 'heart', server: 'status' };

function Icon({ name, size = 20 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  );
}

function NoteTag({ note, active, onClick }) {
  return (
    <button className={`note-tag ${active ? 'active' : ''}`} type="button" onClick={() => onClick(note)}>
      {note}
    </button>
  );
}

function getBestUnitPriceLabel(product, priceOptions) {
  const candidates = ((priceOptions || []).length > 0 ? priceOptions : [product])
    .filter((item) => Number(item?.price || 0) > 0 && Number(item?.weight || 0) > 0)
    .map((item) => ({
      label: getPricePer100g(item),
      value: Number(item.price) / Number(item.weight),
    }))
    .filter((item) => item.label)
    .sort((a, b) => a.value - b.value);

  return candidates[0]?.label || '';
}

function BeanProductCard({ product, activeNotes, isFavorite, onSelect, onToggleFavorite, tasteAxis }) {
  const hasImage = Boolean(product.imageUrl);
  const detailLabel = `${product.roasterName} ${product.productName} 상세 보기`;
  const metaItems = [product.roasterName].filter(Boolean);
  const displayInfo = formatProductDisplayInfo(product);
  const infoItems = [
    displayInfo.process,
    displayInfo.farm,
  ].filter(Boolean);
  const priceOptions = product.priceOptions?.length ? product.priceOptions : createPriceOptions([product]);
  const representativePrice = getRepresentativePriceOption(product);
  const cardPriceOptions = representativePrice.option ? [representativePrice.option] : priceOptions.slice(0, 1);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const imageContent = hasImage
    ? <img src={product.imageUrl} alt="" loading="lazy" onLoad={() => setImageLoaded(true)} onError={() => setImageLoaded(true)} />
    : <span className="bean-image-placeholder">{product.roasterName.slice(0, 2)}</span>;
  const showTasteInfoMissing = tasteAxis !== null && (product.acidityScore === null || product.acidityScore === undefined);

  return (
    <article className={`bean-card ${product.isSoldOut ? 'is-soldout' : ''}`}>
      <div className={`bean-image ${hasImage && !imageLoaded ? 'is-loading' : ''}`}>
        <button className="bean-image-link" type="button" aria-label={detailLabel} onClick={() => onSelect(product)}>
          {imageContent}
        </button>
        {product.isNew && <b>NEW</b>}
        {isOnePlusOneProduct(product) && <span className="event-ribbon">1+1</span>}
        {product.isSoldOut && <span className="soldout-ribbon">품절</span>}
        <button
          className={`image-favorite-btn ${isFavorite ? 'active' : ''}`}
          type="button"
          aria-label={isFavorite ? `${product.productName} 관심 해제` : `${product.productName} 관심 저장`}
          onClick={() => onToggleFavorite(product.id)}
        >
          <Icon name="heart" size={18} />
        </button>
      </div>
      <div className="bean-content">
        <div className="bean-meta">
          {metaItems.map((item) => <span key={item}>{item}</span>)}
        </div>
        <h3>
          <button className="bean-title-link" type="button" onClick={() => onSelect(product)}>
            {displayInfo.primary}
          </button>
        </h3>
        {infoItems.length > 0 && (
          <div className="bean-info-lines">
            <span>{infoItems.join(' · ')}</span>
          </div>
        )}
        {product.blendComposition && product.blendComposition.length > 0 && (
          <div className="bean-blend-info">
            <span className="bean-blend-label">블렌딩</span>
            {product.blendComposition.map((c) => (
              <span key={c.country} className="bean-blend-chip">{c.country} {c.percent}%</span>
            ))}
          </div>
        )}
        {(getDisplayTastingNotes(product).length > 0 || showTasteInfoMissing) && (
          <div className="notes">
            {/* 카드 안 노트는 눌러도 상세가 열리도록 글자로만 보여주고, 상세검색에서 고른 노트만 강조한다. */}
            {getDisplayTastingNotes(product).map((note) => {
              const filterNote = normalizeTastingNotes([note]).find((tag) => product.tastingNotes.includes(tag));
              const isActive = Boolean(filterNote) && activeNotes.includes(filterNote);
              return <span className={`note-tag is-static ${isActive ? 'active' : ''}`} key={note}>{note}</span>;
            })}
            {showTasteInfoMissing && <span className="note-tag is-static taste-missing-note">맛정보 없음</span>}
          </div>
        )}
      </div>
      <div className="bean-footer">
        <div className="bean-price-options">
          {cardPriceOptions.map((option) => {
            const [unitPriceValue, unitPriceSuffix] = option.unitPriceLabel ? option.unitPriceLabel.split('/') : [];
            // 100g 상품은 가격과 100g당 단가가 같은 숫자라 중복이므로 단가를 숨긴다.
            const showUnitPrice = Boolean(option.unitPriceLabel) && unitPriceValue?.trim() !== option.priceLabel?.trim();

            // 카드의 가격 상자는 쇼핑몰로 바로 나가지 않는다. 쇼핑몰 이동은 상세창의 상품 페이지 버튼에서만 한다.
            return (
              <div className="bean-price-option" key={option.id}>
                <div className="bean-price-main">
                  {option.originalPriceLabel && <del>{option.originalPriceLabel}</del>}
                  <strong>{option.priceLabel}</strong>
                  {option.discountLabel && <small>{option.discountLabel}</small>}
                  <div className="bean-price-weight-row">
                    <span>{option.weightLabel}</span>
                    {representativePrice.extraCount > 0 && (
                      <span className="bean-price-more-pill">
                        +{representativePrice.extraCount}<span className="bean-price-more-label"> 용량</span>
                      </span>
                    )}
                  </div>
                </div>
                <em
                  className={`bean-price-unit${showUnitPrice ? '' : ' is-placeholder'}`}
                  aria-hidden={showUnitPrice ? undefined : true}
                >
                  {showUnitPrice && (
                    <>
                      <span className="bean-price-unit-value">{unitPriceValue}</span>
                      {unitPriceSuffix && <span className="bean-price-unit-suffix">{unitPriceSuffix}</span>}
                    </>
                  )}
                </em>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function ChangeList({ changes }) {
  if (changes.length === 0) {
    return <div className="empty-result compact">아직 보여줄 변화가 없습니다.</div>;
  }

  return (
    <div className="change-list">
      {changes.slice(0, 6).map((change) => (
        <div className={`change-item change-${change.type}`} key={`${change.type}-${change.id}`}>
          <span>{change.label}</span>
          <p>{change.detail}</p>
        </div>
      ))}
    </div>
  );
}

function ProductGrid({ activeNotes, emptyMessage = '조건에 맞는 원두가 없습니다. 검색어를 줄이거나 필터를 해제해보세요.', favoriteIds, products, onSelect, onToggleFavorite, tasteAxis }) {
  if (products.length === 0) {
    return <div className="empty-result">{emptyMessage}</div>;
  }

  return (
    <div className="bean-grid">
      {products.map((product) => (
        <BeanProductCard
          key={product.id}
          product={product}
          activeNotes={activeNotes}
          isFavorite={favoriteIds.includes(product.id)}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
          tasteAxis={tasteAxis}
        />
      ))}
    </div>
  );
}

function LoadingSpinner({ compact = false }) {
  return <span className={`loading-spinner ${compact ? 'compact' : ''}`} aria-hidden="true" />;
}

function SourcesPage({ monitorSummary, onSaveSnapshot }) {
  return (
    <div className="page-stack">
      <header className="page-head compact">
        <div>
          <span className="eyebrow">로스터리</span>
          <h1>좋은 원두를 가져오는 로스터리</h1>
          <p>BeanPick이 확인하는 공식몰 목록입니다. 어디에서 상품을 가져오는지 한눈에 볼 수 있어요.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={onSaveSnapshot}>현재 목록 저장</button>
      </header>

      <div className="stats-grid">
        <Stat label="등록 로스터리" value={monitorSummary.sourceCount} delta="+6" />
        <Stat label="사용 중" value={monitorSummary.enabledSourceCount} delta="+5" />
        <Stat label="연동 가능" value={monitorSummary.readySourceCount} delta="+3" />
        <Stat label="감지 변화" value={monitorSummary.changes.length} delta="saved" />
      </div>

      <div className="source-layout">
        <section className="panel">
          <div className="section-title">
            <h2>공식몰 목록</h2>
            <span>상품을 가져오는 출처</span>
          </div>
          <div className="source-list">
            {roasterySources.map((source) => (
              <article className={`source-card ${source.enabled ? '' : 'is-disabled'}`} key={source.id}>
                <div className="source-top">
                  <div>
                    <h3>
                      <a className="source-title-link" href={source.sourceUrl} target="_blank" rel="noreferrer">
                        {source.roasterName}
                      </a>
                    </h3>
                    <p>{source.sourceUrl}</p>
                  </div>
                  <span className={`stock-pill ${source.status === 'ready' ? 'available' : source.status === 'paused' ? 'soldout' : ''}`}>
                    {SOURCE_STATUS_LABEL[source.status]}
                  </span>
                </div>
                <p className="source-memo">{source.memo}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel side-panel">
          <div className="section-title">
            <h2>변화 기록</h2>
            <span>{monitorSummary.hasSavedBaseline ? '저장 기준 비교' : '샘플 기준 비교'}</span>
          </div>
          <ChangeList changes={monitorSummary.changes} />
        </aside>
      </div>
    </div>
  );
}

// 품종 동그라미의 열매 그림. 품종별 겉모습 특징을 과장해서 그린다.
// 근거: World Coffee Research 품종 목록(원두 크기·새잎 끝 색·카투아이 빨강/노랑 열매), 치로소는 길쭉하고 뾰족한 열매라는 로스터리 설명.
// 근거가 없는 품종(시드라 등)은 기준형(빨갛고 둥근 열매 3알, 초록 새잎)으로 그린다.
const CHERRY_COLORS = {
  red: ['#d8473d', '#8a2520'],
  wine: ['#b3303f', '#5f1422'],
  scarlet: ['#ef5d3d', '#a4301c'],
  pink: ['#f7aebd', '#c25f78'],
  yellow: ['#f6cd50', '#bd8a17'],
};
const CHERRY_SHAPES = { round: [1, 1], oval: [0.9, 1.12], long: [0.72, 1.32], pointed: [0.8, 1.3] };
const LEAF_TIP_COLORS = { green: ['#9cc46f', '#bcd99c'], bronze: ['#c0703f', '#dc9668'], darkBronze: ['#86401f', '#a95d3b'] };
const VARIETY_CHERRY = {
  geisha: { shape: 'long' },
  typica: { shape: 'oval', size: 1.15, tip: 'bronze' },
  sl28: { size: 1.15 },
  sl34: { size: 1.15, tip: 'darkBronze' },
  chiroso: { shape: 'pointed' },
  'pink-bourbon': { colors: ['pink'] },
  pacamara: { shape: 'oval', size: 1.45, count: 2 },
  maragogype: { shape: 'oval', size: 1.5, count: 2 },
  mocha: { size: 0.72, count: 4 },
  // 재래종은 유전적으로 다양해서 크기·색이 조금씩 다른 작은 열매 여러 알로 그린다
  'ethiopian-landrace': { shape: 'oval', size: 0.72, count: 5, colors: ['red', 'wine', 'scarlet', 'red', 'wine'] },
  eugenioides: { size: 0.68, count: 4 },
  laurina: { shape: 'pointed', size: 0.85, count: 4 },
  catuai: { count: 4, colors: ['red', 'yellow', 'yellow', 'red'] },
};
const CHERRY_SPOTS = {
  2: [[37, 66, -10], [66, 66, 10]],
  3: [[37, 62, -14], [65, 61, 12], [51, 77, 0]],
  4: [[35, 60, -14], [66, 60, 14], [43, 78, -6], [60, 79, 8]],
  5: [[33, 60, -16], [50, 57, 0], [67, 60, 16], [41, 77, -8], [60, 78, 8]],
};
const LEAF_PATH = 'M0 0C10-12 30-12 42 0C30 12 10 12 0 0Z';

function cherryShapePath(cx, cy, rx, ry) {
  // 위아래 끝이 뾰족한 럭비공 모양
  const k = rx * 1.35;
  return `M${cx} ${cy - ry}C${cx + k} ${cy - ry * 0.55} ${cx + k} ${cy + ry * 0.55} ${cx} ${cy + ry}C${cx - k} ${cy + ry * 0.55} ${cx - k} ${cy - ry * 0.55} ${cx} ${cy - ry}Z`;
}

function CherryArt({ varietyId }) {
  const { shape = 'round', size = 1, count = 3, colors = ['red'], tip = 'green' } = VARIETY_CHERRY[varietyId] ?? {};
  const [sx, sy] = CHERRY_SHAPES[shape];
  const rx = 13 * size * sx;
  const ry = 13 * size * sy;
  const [tipFill, tipStroke] = LEAF_TIP_COLORS[tip];
  return (
    <svg viewBox="0 0 104 104" aria-hidden="true">
      <defs>
        {Object.entries(CHERRY_COLORS).map(([name, [light, dark]]) => (
          <radialGradient key={name} id={`cherry-${varietyId}-${name}`} cx="36%" cy="30%" r="78%">
            <stop offset="0%" stopColor={light} />
            <stop offset="100%" stopColor={dark} />
          </radialGradient>
        ))}
      </defs>
      <g fill="#5f8a55" stroke="#7fa872" strokeWidth="1">
        <path d={LEAF_PATH} transform="translate(26 37) rotate(-150)" />
        <path d={LEAF_PATH} transform="translate(60 31) rotate(-58) scale(0.85)" />
      </g>
      <path d="M0 43C26 33 58 28 80 33" fill="none" stroke="#7a5236" strokeWidth="3.5" strokeLinecap="round" />
      {/* 가지 끝 새잎: 품종에 따라 초록·구릿빛 */}
      <g fill={tipFill} stroke={tipStroke} strokeWidth="1">
        <path d={LEAF_PATH} transform="translate(80 33) rotate(-42) scale(0.66)" />
        <path d={LEAF_PATH} transform="translate(80 33) rotate(24) scale(0.54)" />
      </g>
      {CHERRY_SPOTS[count].map(([cx, cy], i) => (
        <path key={i} d={`M50 33L${cx} ${cy - ry + 2}`} stroke="#6d8f4f" strokeWidth="2" strokeLinecap="round" />
      ))}
      {CHERRY_SPOTS[count].map(([cx, cy, rotate], i) => (
        <g key={i} transform={`rotate(${rotate} ${cx} ${cy})`}>
          {shape === 'pointed'
            ? <path d={cherryShapePath(cx, cy, rx, ry)} fill={`url(#cherry-${varietyId}-${colors[i % colors.length]})`} />
            : <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#cherry-${varietyId}-${colors[i % colors.length]})`} />}
          <ellipse cx={cx - rx * 0.36} cy={cy - ry * 0.42} rx={rx * 0.26} ry={ry * 0.15} fill="#fff" opacity="0.5" />
          <circle cx={cx} cy={cy + ry * 0.84} r={1.6 * size} fill="#3c1e14" opacity="0.45" />
        </g>
      ))}
    </svg>
  );
}

// 아이폰 웹 첫 화면. 품종·새 원두·로스터리를 가로로 넘겨 보는 줄 세 개.
function ExplorePage({ products, isLoading, onSelectVariety, onSelectProduct, onSelectRoaster, onBrowseAll }) {
  // 판매 중인 원두가 있는 품종만 원두 수와 함께 보여 준다.
  const varieties = React.useMemo(() => {
    const counts = new Map();
    products.forEach((product) => {
      matchSingleVarietyIds(product.variety || formatProductDisplayInfo(product).variety).forEach((id) => {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      });
    });
    return VARIETY_TIERS
      .flatMap(({ items }) => items)
      .filter((item) => counts.has(item.id))
      .map((item) => ({ ...item, count: counts.get(item.id) }));
  }, [products]);
  // 로스터리마다 원두 수와 대표 사진(처음 나온 원두 사진)을 모은다.
  const newProducts = React.useMemo(() => products.filter((product) => product.isNew).slice(0, 12), [products]);
  const roasters = React.useMemo(() => {
    const byName = new Map();
    products.forEach((product) => {
      const entry = byName.get(product.roasterName) ?? { name: product.roasterName, count: 0, imageUrl: '' };
      entry.count += 1;
      entry.imageUrl ||= product.imageUrl || '';
      byName.set(product.roasterName, entry);
    });
    return [...byName.values()].sort((a, b) => b.count - a.count);
  }, [products]);

  return (
    <div className="page-stack explore-page">
      <h1 className="explore-title">탐색</h1>

      {isLoading ? (
        <div className="explore-loading"><LoadingSpinner /><p>원두를 불러오는 중입니다</p></div>
      ) : (
        <>
          <section className="explore-section" aria-label="품종으로 고르기">
            <h2>품종으로 고르기</h2>
            <p>품종마다 맛의 성격이 다릅니다. 빈픽 추천 등급 순서로 모았습니다.</p>
            <div className="explore-rail">
              {varieties.map((variety) => (
                <button key={variety.id} className="explore-circle" type="button" onClick={() => onSelectVariety(variety.id)}>
                  <span className="explore-circle-image"><CherryArt varietyId={variety.id} /></span>
                  {/* SL28·SL34는 한글 이름이 둘 다 '케냐'라 영문 이름으로 구분한다 */}
                  <strong>{variety.ko === '케냐' ? variety.name : variety.ko}</strong>
                  <span>{variety.count}개</span>
                </button>
              ))}
            </div>
          </section>

          {newProducts.length > 0 && (
            <section className="explore-section" aria-label="새로 들어온 원두">
              <div className="explore-section-head">
                <h2>새로 들어온 원두</h2>
                <button type="button" onClick={onBrowseAll}>전체 보기</button>
              </div>
              <p>최근 새로 올라온 원두입니다.</p>
              <div className="explore-rail">
                {newProducts.map((product) => (
                  <button key={product.id} className="explore-card" type="button" onClick={() => onSelectProduct(product)}>
                    <span className="explore-card-image">{product.imageUrl && <img src={product.imageUrl} alt="" loading="lazy" />}</span>
                    <span className="explore-card-roaster">{product.roasterName}</span>
                    <strong>{product.productName}</strong>
                    <span className="explore-card-price">{product.priceLabel}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="explore-section" aria-label="로스터리">
            <h2>로스터리</h2>
            <p>빈픽이 매일 판매 원두를 확인하는 로스터리 {roasters.length}곳입니다.</p>
            <div className="explore-rail">
              {roasters.map((roaster) => (
                <button key={roaster.name} className="explore-card" type="button" onClick={() => onSelectRoaster(roaster.name)}>
                  <span className="explore-card-image">{roaster.imageUrl && <img src={roaster.imageUrl} alt="" loading="lazy" />}</span>
                  <strong>{roaster.name}</strong>
                  <span className="explore-card-roaster">원두 {roaster.count}개</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function AlertsPage({ favoriteProducts, onBrowse, onToggleFavorite }) {
  return (
    <div className="page-stack">
      <header className="page-head compact">
        <div>
          <span className="eyebrow">관심</span>
          <h1>관심 원두와 입고 알림</h1>
          <p>저장한 관심 원두를 한곳에서 확인합니다.</p>
        </div>
      </header>

      <section className="panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">관심 원두</span>
            <h2>관심 원두 <em>{favoriteProducts.length}개</em></h2>
          </div>
        </div>
        {favoriteProducts.length > 0 ? (
          <div className="favorite-list">
            {favoriteProducts.map((product) => (
              <article className="favorite-row" key={product.id}>
                <div>
                  <strong>{product.productName}</strong>
                  <span>{product.roasterName} · {formatPrice(product.price)} · {product.isSoldOut ? '품절' : '판매 중'}</span>
                </div>
                <button className="btn btn-small" type="button" onClick={() => onToggleFavorite(product.id)}>관심 해제</button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-result empty-favorites">
            <p>아직 관심 원두가 없어요. 원두 카드의 하트를 누르면 여기에 모여요.</p>
            <p>저장한 원두가 품절되면 '품절', 다시 들어오면 '판매 중'으로 여기서 표시돼요.</p>
            <button className="btn btn-primary" type="button" onClick={onBrowse}>원두 둘러보기</button>
          </div>
        )}
      </section>
    </div>
  );
}

function AppStatusPage({ dataMode, favoriteCount, lastLoadedAt, loadState, monitorSummary, publishState, smartStoreState, onPublishIphoneSnapshot, onTestSmartStoreSearch }) {
  const isTestingSmartStore = smartStoreState.status === 'loading';
  const isPublishing = publishState.status === 'loading';

  return (
    <div className="page-stack">
      <header className="page-head compact">
        <div>
          <span className="eyebrow">앱 상태</span>
          <h1>앱 상태</h1>
          <p>현재 표시 중인 데이터와 저장 상태를 확인합니다.</p>
        </div>
      </header>

      <div className="stats-grid">
        <Stat label="데이터 모드" value={dataModeLabel(dataMode)} delta={loadState.status || 'idle'} />
        <Stat label="마지막 확인" value={formatDateTime(lastLoadedAt)} delta="local" />
        <Stat label="관심 원두" value={favoriteCount} delta="saved" />
        <Stat label="연동 로스터리" value={monitorSummary.readySourceCount} delta={`${monitorSummary.sourceCount}개 중`} />
      </div>

      {canLoadLiveProducts() && (
        <section className="panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">아이폰</span>
              <h2>아이폰 웹앱 게시</h2>
            </div>
            <button className="btn btn-primary" type="button" onClick={onPublishIphoneSnapshot} disabled={isPublishing}>
              {isPublishing && <LoadingSpinner compact />}
              {getPublishButtonLabel(publishState)}
            </button>
          </div>
          {publishState.message && (
            <div className={`load-banner load-${publishState.status}`}>
              <strong>{publishState.status === 'success' ? '게시 완료' : publishState.status === 'error' ? '게시 실패' : '게시 중'}</strong>
              <p>{publishState.message}</p>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">연결</span>
            <h2>로스터리 연결 상태</h2>
          </div>
        </div>
        <div className="status-list">
          {roasterySources.map((source) => (
            <div className="status-row" key={source.id}>
              <div>
                <strong>{source.roasterName}</strong>
                <span>{source.sourceUrl}</span>
              </div>
              <span className={`stock-pill ${source.status === 'ready' ? 'available' : source.status === 'paused' ? 'soldout' : ''}`}>
                {SOURCE_STATUS_LABEL[source.status]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">스마트스토어</span>
            <h2>스마트스토어 검색</h2>
          </div>
          <button className="btn btn-small" type="button" onClick={onTestSmartStoreSearch} disabled={isTestingSmartStore}>
            {isTestingSmartStore ? '확인 중' : '검색 테스트'}
          </button>
        </div>
        <div className={`load-banner load-${smartStoreState.status}`}>
          <strong>{smartStoreState.status === 'success' ? '검색됨' : smartStoreState.status === 'error' ? '확인 필요' : '대기 중'}</strong>
          <p>{smartStoreState.message || '.env에 네이버 검색 API Client ID와 Secret을 넣은 뒤 테스트할 수 있습니다.'}</p>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  // 아이폰 웹은 탐색, PC 앱은 원두 목록이 첫 화면이다.
  const [screen, setScreen] = React.useState(() => (canLoadLiveProducts() ? 'products' : 'explore'));
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortMode, setSortMode] = React.useState('score');
  const [activeNotes, setActiveNotes] = React.useState([]);
  // 노트 상세검색: 꼭 포함할 단어 / 제외할 단어
  const [noteIncludeQuery, setNoteIncludeQuery] = React.useState('');
  const [noteExcludeQuery, setNoteExcludeQuery] = React.useState('');
  const [budget, setBudget] = React.useState('all');
  const [capacityFilter, setCapacityFilter] = React.useState('all');
  const [originFilter, setOriginFilter] = React.useState('all');
  const [processFilter, setProcessFilter] = React.useState('all');
  // On Sale = 할인 중이거나 1+1 행사 상품. 두 필터를 하나로 묶었다.
  const [saleOnly, setSaleOnly] = React.useState(false);
  const [decafOnly, setDecafOnly] = React.useState(false);
  const [tasteAxis, setTasteAxis] = React.useState(null);
  // 앱을 켜면 마지막으로 저장된 상품 목록을 먼저 보여준다.
  const [initialCache] = React.useState(() => loadProductCache());
  const [baseProducts, setBaseProducts] = React.useState(initialCache?.products ?? mockBeans);
  const [dataMode, setDataMode] = React.useState(initialCache ? 'cached' : 'mock');
  // 아이폰 웹은 게시된 원두를 받아 오기 전까지 샘플 원두가 잠깐 보이지 않도록 '불러오는 중'으로 시작한다.
  const [loadState, setLoadState] = React.useState(() => (
    !initialCache && !canLoadLiveProducts() ? { status: 'loading', message: '' } : { status: 'idle', message: '' }
  ));
  const [publishState, setPublishState] = React.useState({ status: 'idle', message: '' });
  const [collectionRuns, setCollectionRuns] = React.useState([]);
  const [smartStoreState, setSmartStoreState] = React.useState({ status: 'idle', message: '' });
  const [lastLoadedAt, setLastLoadedAt] = React.useState(initialCache ? new Date(initialCache.savedAt) : null);
  const [favoriteIds, setFavoriteIds] = React.useState(() => loadFavoriteProductIds());
  const [monitorSummary, setMonitorSummary] = React.useState(() => createMonitorSummary(initialCache?.products ?? mockBeans, roasterySources));
  // 상세 보기로 열어 둔 상품. 데이터가 새로고침돼도 id로 다시 찾는다.
  const [detailProductId, setDetailProductId] = React.useState(null);
  const [mapEntry, setMapEntry] = React.useState({ varietyId: null, key: 0 });
  const [searchFocused, setSearchFocused] = React.useState(false);
  const loadingRef = React.useRef(false);
  const loadProductsRef = React.useRef(null);

  const products = React.useMemo(() => normalizeProducts(baseProducts), [baseProducts]);
  const discountProducts = React.useMemo(() => filterDiscountProducts(products), [products]);
  // 품절·분쇄 원두를 뺀 "판매 중" 원두. 탭 배지·원두 목록·지도가 모두 이 기준으로 센다.
  const availableProducts = React.useMemo(() => (
    products.filter((product) => !product.isSoldOut && !isGroundCoffeeProduct(product))
  ), [products]);

  // 앱 상태·로스터리 연결 탭은 운영용이라 PC 앱에서만 보여주고, 아이폰 웹앱에서는 숨긴다.
  // (아이폰 웹의 로스터리 목록은 탐색 화면의 로스터리 줄로 옮겼다.)
  const navItems = React.useMemo(() => NAV
    .filter((item) => (item.id !== 'server' && item.id !== 'sources') || canLoadLiveProducts())
    .map((item) => {
      if (item.id === 'products') return { ...item, badge: availableProducts.length };
      if (item.id === 'alerts') return { ...item, badge: favoriteIds.length };
      return item;
    }), [favoriteIds.length, availableProducts.length]);

  const groups = navItems.reduce((acc, item) => {
    acc[item.group] = acc[item.group] || [];
    acc[item.group].push(item);
    return acc;
  }, {});
  const current = navItems.find((item) => item.id === screen) ?? navItems[0];

  const noteOptions = React.useMemo(() => getNoteOptions(products), [products]);

  // 보유 상품에서 실제로 나오는 원산지/가공방식만 골라 많은 순으로 보여준다.
  const originOptions = React.useMemo(() => countLabelOptions(products, getProductCountryLabel), [products]);
  const processOptions = React.useMemo(() => countLabelOptions(products, getProductProcessLabel), [products]);

  const favoriteProducts = React.useMemo(() => {
    return products.filter((product) => favoriteIds.includes(product.id));
  }, [favoriteIds, products]);

  // 판매 중 원두에 검색·노트·할인·디카페인·원산지·가공·가격 조건을 적용한다.
  const visibleProducts = React.useMemo(() => (
    availableProducts.filter((product) => (
      matchesDetailQuery(product, searchQuery)
      && (activeNotes.length === 0 || activeNotes.some((note) => product.tastingNotes.includes(note)))
      && matchesNoteQuery(product, noteIncludeQuery, noteExcludeQuery)
      && (!saleOnly || discountProducts.includes(product) || isOnePlusOneProduct(product))
      && (!decafOnly || isDecafProduct(product))
      && (originFilter === 'all' || getProductCountryLabel(product) === originFilter)
      && (processFilter === 'all' || getProductProcessLabel(product) === processFilter)
      && matchesBudgetFilter(product, budget)
      && matchesCapacityFilter(product, capacityFilter)
    ))
  ), [activeNotes, availableProducts, budget, capacityFilter, decafOnly, saleOnly, discountProducts, noteExcludeQuery, noteIncludeQuery, originFilter, processFilter, searchQuery]);

  const filteredProducts = React.useMemo(() => (
    sortProducts(visibleProducts, sortMode, tasteAxis)
  ), [visibleProducts, sortMode, tasteAxis]);

  const hasActiveFilters = Boolean(searchQuery.trim()) || activeNotes.length > 0
    || budget !== 'all' || capacityFilter !== 'all' || originFilter !== 'all' || processFilter !== 'all' || saleOnly || decafOnly
    || Boolean(noteIncludeQuery.trim()) || Boolean(noteExcludeQuery.trim())
    || tasteAxis !== null;

  const detailProduct = React.useMemo(() => (
    detailProductId ? products.find((product) => product.id === detailProductId) ?? null : null
  ), [detailProductId, products]);

  // 입력 중인 검색어와 비슷한 로스터리·원두·노트 이름을 추천한다.
  const searchSuggestions = React.useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return [];

    const candidates = new Set();
    availableProducts.forEach((product) => {
      candidates.add(product.roasterName);
      candidates.add(formatProductDisplayInfo(product).primary);
      product.tastingNotes.forEach((note) => candidates.add(note));
    });

    return [...candidates]
      .filter(Boolean)
      .filter((candidate) => candidate.toLowerCase() !== query.toLowerCase() && matchesSmartSearch(candidate, query))
      .slice(0, 8);
  }, [availableProducts, searchQuery]);

  function clearAllFilters() {
    setSearchQuery('');
    setActiveNotes([]);
    setNoteIncludeQuery('');
    setNoteExcludeQuery('');
    setBudget('all');
    setCapacityFilter('all');
    setOriginFilter('all');
    setProcessFilter('all');
    setSaleOnly(false);
    setDecafOnly(false);
    setTasteAxis(null);
    // 할인 중을 켜면 정렬도 할인율순으로 바뀌므로, 초기화하면 정렬도 추천순으로 되돌린다.
    setSortMode('score');
  }

  function handleNoteClick(note) {
    setActiveNotes((currentNotes) => (
      currentNotes.includes(note)
        ? currentNotes.filter((currentNote) => currentNote !== note)
        : [...currentNotes, note]
    ));
  }

  function handleToggleFavorite(productId) {
    setFavoriteIds((current) => {
      const next = current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId];
      saveFavoriteProductIds(next);
      return next;
    });
  }

  function handleSaveSnapshot() {
    saveProductSnapshot(products);
    setMonitorSummary(createMonitorSummary(products, roasterySources));
  }

  async function handlePublishIphoneSnapshot() {
    setPublishState({ status: 'loading', message: '현재 원두 목록을 GitHub Pages용 파일로 올리는 중입니다.' });

    try {
      if (!window.beanpick?.publishToGithub) {
        throw new Error('아이폰 게시 기능은 Electron 데스크톱 앱에서만 사용할 수 있습니다.');
      }

      const result = await window.beanpick.publishToGithub({ products, collectionRuns });
      if (!result?.ok) throw new Error(result?.error || 'GitHub에 게시하지 못했습니다.');

      setPublishState({
        status: 'success',
        message: `원두 ${result.count}종을 게시했습니다. 아이폰 웹앱을 새로고침하면 반영됩니다.`,
      });
    } catch (error) {
      setPublishState({
        status: 'error',
        message: error instanceof Error ? error.message : '아이폰 게시 중 알 수 없는 오류가 발생했습니다.',
      });
    }
  }

  async function handleTestSmartStoreSearch() {
    setSmartStoreState({ status: 'loading', message: '스마트스토어 카테고리와 커피정경 커머스 API 연결을 확인하는 중입니다.' });

    try {
      if (!window.beanpick?.testSmartStoreSearch) {
        throw new Error('스마트스토어 검색 테스트는 Electron 데스크톱 앱에서만 사용할 수 있습니다. 일반 브라우저나 HTML 파일로 열면 네이버 검색 연결이 붙지 않습니다.');
      }

      const result = await window.beanpick.testSmartStoreSearch();
      if (!result?.ok) {
        throw new Error(result?.error || '스마트스토어 검색을 확인하지 못했습니다.');
      }

      setSmartStoreState({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      setSmartStoreState({
        status: 'error',
        message: error instanceof Error ? error.message : '스마트스토어 검색 중 알 수 없는 오류가 발생했습니다.',
      });
    }
  }

  async function handleLoadProducts() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadState({ status: 'loading', message: '로스터리를 확인하는 중입니다.' });

    try {
      if (!canLoadLiveProducts()) {
        throw new Error('실제 데이터는 Electron 데스크톱 앱에서만 불러올 수 있습니다. 일반 브라우저나 HTML 파일로 열면 네이버 검색 연결이 없으니 npm.cmd run dev로 실행해주세요.');
      }

      const warnings = [];
      const sources = await window.beanpick.listCollectionSources();
      const sourceRuns = [];
      const tasks = sources.map(({ sourceId, roasterName, driver }) => ({
        sourceId,
        roasterName,
        driver,
        label: roasterName || sourceId,
        fetchProducts: async () => {
          const result = await window.beanpick.fetchCollectionSource(sourceId);
          if (!result?.ok) throw new Error(result?.error || `${roasterName || sourceId} 데이터를 가져오지 못했습니다.`);
          if (result.warning) warnings.push(result.warning);

          let sourceProducts;
          if (driver === 'terarosaApi') {
            const parsedProducts = result.apiRows?.length
              ? normalizeTerarosaApiRows(result.apiRows)
              : parseTerarosaHtmlProducts(result.html || '');
            sourceProducts = enrichTerarosaProducts(parsedProducts, result.detailPages || []);
          } else if (driver === 'momosShop') {
            sourceProducts = normalizeMomosPages(result.pages || [{ url: result.sourceUrl, html: result.html || '' }]);
          } else if (driver === 'officialMallPages') {
            const config = OFFICIAL_MALL_CONFIGS[sourceId];
            if (!config) throw new Error(`${roasterName || sourceId} 화면 변환 설정이 없습니다.`);
            sourceProducts = normalizeCafe24Pages(result.pages || [{ url: result.sourceUrl, html: result.html || '' }], config);
          } else if (driver === 'smartStoreCategory') {
            sourceProducts = result.products || [];
          } else {
            throw new Error(`${roasterName || sourceId} 수집 드라이버를 지원하지 않습니다: ${driver}`);
          }

          const promotedProducts = await promoteCollectionProducts(sourceId, sourceProducts);
          return {
            products: promotedProducts,
            run: {
              sourceId,
              roasterName,
              status: result.listCompleteness || (result.warning ? 'partial' : 'complete'),
              itemCount: promotedProducts.length,
              usedFallback: false,
            },
          };
        },
      }));

      const loadedProducts = [];
      const sourceCounts = [];
      let completedCount = 0;
      const previousProducts = Array.isArray(baseProducts) && baseProducts.length > 0
        ? baseProducts
        : (loadProductCache()?.products || []);

      // 한 로스터리가 비정상적으로 오래 걸리면(네트워크 행 등) 버리고 나머지로 발행을 진행한다.
      // 메인 프로세스의 어떤 비동기 단계가 멈추든 전체 수집이 무한 대기에 빠지지 않게 하는 안전장치.
      // 공식몰은 상세보강에 자체 시간 예산이 있어 빨리 반환하므로, 이 한도는 카테고리를 여러 개 크롤하는
      // 느린 스마트스토어(로스터릭·루비아 등)가 정상 수집을 마칠 수 있도록 넉넉히 준다.
      const withRoasterTimeout = (promise, label, ms = 300000) => Promise.race([
        promise,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`${label} 수집 시간이 초과됐습니다 (${ms / 1000}초).`)), ms);
        }),
      ]);

      // 한꺼번에 모든 로스터리를 열면 공식몰·스마트스토어가 서로 요청을 밀어내
      // 목록 요청 자체가 ECONNRESET/AbortError로 끝날 수 있다. 끝난 로스터리부터
      // 바로 화면에 반영하되, 전체 수집 요청은 제한된 수만 동시에 진행한다.
      await mapWithConcurrency(tasks, LIVE_SOURCE_LOAD_CONCURRENCY, async (task) => {
        try {
          console.log(`[beanpick:load-start] ${task.label}`);
          const collected = await withRoasterTimeout(task.fetchProducts(), task.label);
          const sourceProducts = collected.products || [];
          sourceRuns.push(collected.run);
          console.log(`[beanpick:load-success] ${task.label} (${sourceProducts.length} products)`);
          loadedProducts.push(...sourceProducts);
          sourceCounts.push(`${task.label} ${sourceProducts.length}개`);

          if (loadedProducts.length > 0) {
            setBaseProducts(groupProductsByNameAndWeight([...loadedProducts]));
            setDataMode('live');
          }
        } catch (error) {
          console.error(`[beanpick:load-fail] ${task.label} error:`, error);
          const normLabel = String(task.label || '').replace(/\s+/g, '').toLowerCase();
          const fallbackProducts = previousProducts.filter((p) => {
            const normRoaster = String(p?.roasterName || '').replace(/\s+/g, '').toLowerCase();
            return normRoaster && (normRoaster === normLabel || normRoaster.includes(normLabel) || normLabel.includes(normRoaster));
          });

          if (fallbackProducts.length > 0) {
            console.log(`[beanpick:load-fallback] ${task.label} (${fallbackProducts.length} products preserved from previous data)`);
            loadedProducts.push(...fallbackProducts.map((p) => ({
              ...p,
              roasterPreservedReason: '수집 실패로 이전 데이터 유지',
            })));
            sourceCounts.push(`${task.label} ${fallbackProducts.length}개(보존)`);
            sourceRuns.push({
              sourceId: task.sourceId,
              roasterName: task.roasterName,
              status: 'failed',
              itemCount: fallbackProducts.length,
              usedFallback: true,
            });
            warnings.push(`${task.label} 수집 지연으로 이전 데이터를 유지합니다.`);

            if (loadedProducts.length > 0) {
              setBaseProducts(groupProductsByNameAndWeight([...loadedProducts]));
              setDataMode('live');
            }
          } else {
            sourceRuns.push({
              sourceId: task.sourceId,
              roasterName: task.roasterName,
              status: 'failed',
              itemCount: 0,
              usedFallback: false,
            });
            warnings.push(error instanceof Error ? error.message : `${task.label} 데이터를 가져오지 못했습니다.`);
          }
        } finally {
          completedCount += 1;
          setLoadState({
            status: 'loading',
            message: `로스터리 확인 중 ${completedCount}/${tasks.length} · 지금까지 원두 ${loadedProducts.length}개 발견`,
          });
        }
      });

      setCollectionRuns(sourceRuns);

      if (loadedProducts.length === 0) {
        throw new Error(warnings.join(' / ') || '상품 데이터를 찾지 못했습니다.');
      }

      const groupedProducts = groupProductsByNameAndWeight(loadedProducts);
      const loadedAt = new Date();

      setBaseProducts(groupedProducts);
      setDataMode('live');
      setActiveNotes([]);
      setLastLoadedAt(loadedAt);
      // 변화 비교는 이전 저장본 기준으로 먼저 계산한 뒤, 다음 비교를 위해 자동 저장한다.
      const summary = createMonitorSummary(groupedProducts, roasterySources);
      setMonitorSummary(summary);
      saveProductCache(groupedProducts, loadedAt.getTime());
      saveProductSnapshot(groupedProducts);
      notifyFavoriteChanges(summary.changes, favoriteIds);
      setLoadState({
        status: 'success',
        message: `원두 ${loadedProducts.length}개를 불러와 ${groupedProducts.length}종으로 묶었습니다. ${sourceCounts.join(' · ')}${warnings.length > 0 ? ` 일부 안내: ${warnings.join(' / ')}` : ''}`,
      });
    } catch (error) {
      // 불러오기에 실패해도 저장해 둔 마지막 목록이 있으면 그것을 보여준다.
      const cache = loadProductCache();
      const fallbackProducts = cache?.products ?? mockBeans;

      setDataMode(cache ? 'cached' : 'mock');
      setBaseProducts(fallbackProducts);
      setMonitorSummary(createMonitorSummary(fallbackProducts, roasterySources));
      setLoadState({
        status: 'error',
        message: `${error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'} ${cache ? '마지막으로 저장된 원두 목록을 계속 보여드립니다.' : '샘플 원두를 계속 보여드립니다.'}`,
      });
    } finally {
      loadingRef.current = false;
    }
  }

  loadProductsRef.current = handleLoadProducts;

  // 일반 웹에서는 PC 앱이 게시한 products.json 스냅샷을 먼저 읽어 아이폰용 목록으로 보여준다.
  React.useEffect(() => {
    if (canLoadLiveProducts()) return undefined;

    let cancelled = false;
    loadPublishedSnapshot(window.fetch?.bind(window)).then((snapshot) => {
      if (cancelled) return;
      // 스냅샷을 못 읽으면 조용히 샘플 화면에 머무르지 말고 실패를 분명히 알린다.
      if (!snapshot) {
        setLoadState({ status: 'error', message: '게시된 원두 데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.' });
        return;
      }
      setBaseProducts(snapshot.products);
      setDataMode('published');
      setLastLoadedAt(snapshot.publishedAt ? new Date(snapshot.publishedAt) : null);
      setMonitorSummary(createMonitorSummary(snapshot.products, roasterySources));
      setLoadState({
        status: 'success',
        message: '게시된 원두 정보를 불러왔습니다.',
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Electron에서는 2시간마다 자동으로 다시 확인해 관심 원두 변화를 알린다.
  React.useEffect(() => {
    if (!canLoadLiveProducts()) return undefined;
    const intervalId = setInterval(() => loadProductsRef.current?.(), 2 * 60 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setScreen(canLoadLiveProducts() ? 'products' : 'explore')}>
          <span className="brand-head">
            <span className="brand-mark">BeanPick</span>
            {lastLoadedAt && <span className="brand-updated">{formatDateTime(lastLoadedAt)} 기준</span>}
          </span>
          <span>오늘 마실 원두를 쉽게 고르기</span>
        </button>

        {/* 폰 화면 아래 탭바. 아이폰 앱처럼 스크롤해도 항상 보인다. */}
        <div className="mobile-nav-bar" role="tablist" aria-label="메뉴 탐색">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`mobile-nav-item ${screen === item.id ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={screen === item.id}
              onClick={() => { setMapEntry({ varietyId: null, key: Date.now() }); setScreen(item.id); }}
            >
              <Icon name={NAV_ICONS[item.id]} size={24} />
              <span>{item.label}</span>
              {item.id === 'alerts' && item.badge > 0 && <em>{item.badge}</em>}
            </button>
          ))}
        </div>

        {Object.entries(groups).map(([group, items]) => (
          <nav key={group} className="nav-section" aria-label={group}>
            <span className="nav-label">{group}</span>
            {items.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${screen === item.id ? 'active' : ''}`}
                type="button"
                onClick={() => { setMapEntry({ varietyId: null, key: Date.now() }); setScreen(item.id); }}
              >
                <span>{item.label}</span>
                {item.badge != null && <em>{item.badge}</em>}
              </button>
            ))}
          </nav>
        ))}

        <div className="sidebar-note">
          <span className={`status-dot ${dataMode === 'live' || dataMode === 'published' ? 'green' : 'amber'}`} />
          <div>
            <strong>{dataModeDescription(dataMode)}</strong>
            <p>공식몰 데이터를 불러오면 오늘 판매 중인 원두로 바뀝니다.</p>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <span>BeanPick / {current.label}</span>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <span>검색</span>
              <input
                value={searchQuery}
                placeholder="원두·로스터리·노트 검색 (초성 가능)"
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  // 탐색 화면은 검색 결과를 보여주지 않으므로 원두 화면으로 넘긴다.
                  if (screen === 'explore') setScreen('products');
                }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {searchFocused && searchSuggestions.length > 0 && (
                <div className="search-suggest" role="listbox" aria-label="검색어 추천">
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      // blur보다 먼저 실행되도록 mousedown에서 처리한다.
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setSearchQuery(suggestion);
                        setScreen('products');
                        setSearchFocused(false);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </label>
            {canLoadLiveProducts() && (
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleLoadProducts}
                disabled={loadState.status === 'loading'}
              >
                {loadState.status === 'loading' && <LoadingSpinner compact />}
                {loadState.status === 'loading' ? '불러오는 중' : '오늘의 원두 불러오기'}
              </button>
            )}
            {canLoadLiveProducts() && (
              <button
                className="btn"
                type="button"
                onClick={handlePublishIphoneSnapshot}
                disabled={publishState.status === 'loading'}
              >
                {publishState.status === 'loading' && <LoadingSpinner compact />}
                {getPublishButtonLabel(publishState)}
              </button>
            )}
          </div>
        </div>

        {screen === 'explore' ? (
          <ExplorePage
            products={availableProducts}
            isLoading={loadState.status === 'loading' && dataMode === 'mock'}
            onSelectVariety={(varietyId) => {
              setMapEntry({ varietyId, key: Date.now() });
              setScreen('map');
              window.scrollTo({ top: 0 });
            }}
            onSelectProduct={(product) => setDetailProductId(product.id)}
            onSelectRoaster={(roasterName) => {
              clearAllFilters();
              setSearchQuery(roasterName);
              setScreen('products');
              window.scrollTo({ top: 0 });
            }}
            onBrowseAll={() => {
              setScreen('products');
              window.scrollTo({ top: 0 });
            }}
          />
        ) : screen === 'products' ? (
          <BrowsePage
            activeNotes={activeNotes}
            budget={budget}
            capacityFilter={capacityFilter}
            dataMode={dataMode}
            decafOnly={decafOnly}
            saleOnly={saleOnly}
            discountCount={discountProducts.filter((product) => !product.isSoldOut).length}
            favoriteIds={favoriteIds}
            hasActiveFilters={hasActiveFilters}
            lastLoadedAt={lastLoadedAt}
            loadState={loadState}
            noteExcludeQuery={noteExcludeQuery}
            noteIncludeQuery={noteIncludeQuery}
            noteOptions={noteOptions}
            onClearFilters={clearAllFilters}
            onNoteClick={handleNoteClick}
            onSelectProduct={(product) => setDetailProductId(product.id)}
            onToggleFavorite={handleToggleFavorite}
            originFilter={originFilter}
            originOptions={originOptions}
            processFilter={processFilter}
            processOptions={processOptions}
            publishState={publishState}
            products={filteredProducts}
            setBudget={setBudget}
            setCapacityFilter={setCapacityFilter}
            setDecafOnly={setDecafOnly}
            setSaleOnly={setSaleOnly}
            setNoteExcludeQuery={setNoteExcludeQuery}
            setNoteIncludeQuery={setNoteIncludeQuery}
            setOriginFilter={setOriginFilter}
            setProcessFilter={setProcessFilter}
            setSortMode={setSortMode}
            sortMode={sortMode}
            summaryProducts={products}
            tasteAxis={tasteAxis}
            setTasteAxis={setTasteAxis}
          />
        ) : screen === 'map' ? (
          <MapPage
            key={mapEntry.key}
            initialVarietyId={mapEntry.varietyId}
            products={availableProducts}
            favoriteIds={favoriteIds}
            onSelectProduct={(product) => setDetailProductId(product.id)}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : screen === 'sources' ? (
          <SourcesPage monitorSummary={monitorSummary} onSaveSnapshot={handleSaveSnapshot} />
        ) : screen === 'alerts' ? (
          <AlertsPage
            onBrowse={() => setScreen('products')}
            favoriteProducts={favoriteProducts}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : (
          <AppStatusPage
            dataMode={dataMode}
            favoriteCount={favoriteIds.length}
            lastLoadedAt={lastLoadedAt}
            loadState={loadState}
            monitorSummary={monitorSummary}
            publishState={publishState}
            smartStoreState={smartStoreState}
            onPublishIphoneSnapshot={handlePublishIphoneSnapshot}
            onTestSmartStoreSearch={handleTestSmartStoreSearch}
          />
        )}
      </main>

      {detailProduct && (
        <ProductDetailModal
          isFavorite={favoriteIds.includes(detailProduct.id)}
          product={detailProduct}
          onClose={() => setDetailProductId(null)}
          onToggleFavorite={handleToggleFavorite}
          onSelectVariety={(varietyId) => {
            setDetailProductId(null);
            setMapEntry({ varietyId, key: Date.now() });
            setScreen('map');
          }}
        />
      )}
    </div>
  );
}

function MapPage({
  initialVarietyId,
  products,
  favoriteIds,
  onSelectProduct,
  onToggleFavorite,
}) {
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [selectedCountry, setSelectedCountry] = React.useState(null);
  const [blendOnly, setBlendOnly] = React.useState(false);
  const [highlightedCountries, setHighlightedCountries] = React.useState([]);
  const [focusedProductId, setFocusedProductId] = React.useState(null);
  // 상세창 품종 링크로 들어오면 그 품종을 선택한 채로 연다
  const [mapMode, setMapMode] = React.useState(initialVarietyId ? 'variety' : 'origin');
  const [selectedVariety, setSelectedVariety] = React.useState(() => {
    for (const { tier, items } of VARIETY_TIERS) {
      const item = items.find((i) => i.id === initialVarietyId);
      if (item) return { ...item, tier };
    }
    return null;
  });
  const listHeadRef = React.useRef(null);

  const varietyIdsByProduct = React.useMemo(() => new Map(products.map((p) => (
    [p.id, matchSingleVarietyIds(p.variety || formatProductDisplayInfo(p).variety)]
  ))), [products]);
  const varietyCounts = React.useMemo(() => {
    const counts = {};
    varietyIdsByProduct.forEach((ids) => ids.forEach((id) => { counts[id] = (counts[id] || 0) + 1; }));
    return counts;
  }, [varietyIdsByProduct]);
  const varietyProducts = React.useMemo(() => products.filter((p) => {
    const ids = varietyIdsByProduct.get(p.id) || [];
    return selectedVariety ? ids.includes(selectedVariety.id) : ids.length > 0;
  }), [products, varietyIdsByProduct, selectedVariety]);
  const listProducts = mapMode === 'variety' ? varietyProducts : null;

  // 빈픽에서는: 선택한 품종의 100g 가격대와 많이 파는 로스터리
  const varietyStats = React.useMemo(() => {
    if (!selectedVariety || !varietyProducts.length) return null;
    const unitPrices = varietyProducts.map((p) => {
      const options = (p.priceOptions?.length ? p.priceOptions : [p])
        .filter((o) => Number(o?.price) > 0 && Number(o?.weight) > 0);
      return options.length ? Math.min(...options.map((o) => (o.price / o.weight) * 100)) : 0;
    }).filter(Boolean).sort((a, b) => a - b);
    const roasterCounts = {};
    varietyProducts.forEach((p) => { roasterCounts[p.roasterName] = (roasterCounts[p.roasterName] || 0) + 1; });
    const topRoasters = Object.entries(roasterCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const won = (value) => `${Math.round(value / 100) * 100}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원';
    return {
      priceRange: unitPrices.length === 1
        ? `100g당 ${won(unitPrices[0])}`
        : unitPrices.length
        ? `100g당 ${won(unitPrices[0])} ~ ${won(unitPrices[unitPrices.length - 1])} (중간값 ${won(unitPrices[Math.floor(unitPrices.length / 2)])})`
        : '',
      topRoasters: topRoasters.map(([name, count]) => `${name} ${count}`).join(' · '),
    };
  }, [selectedVariety, varietyProducts]);

  // 할인 중인 원두가 있는 생산국 (지도 핀에 표시)
  const discountCountries = React.useMemo(() => {
    const set = new Set();
    filterDiscountProducts(products)
      .filter((p) => !p.isSoldOut)
      .forEach((p) => extractProductCountries(p).forEach((c) => set.add(c)));
    return [...set];
  }, [products]);

  // 국가별 및 블렌드 분류 집계
  const { filteredProducts, unmappedBlendCount, countryTopList } = React.useMemo(() => {
    let unmappedBlends = 0;
    const countryCounts = new Map();

    products.forEach((p) => {
      const countries = extractProductCountries(p);
      if (countries.length === 0) {
        unmappedBlends++;
      } else {
        countries.forEach((c) => {
          countryCounts.set(c, (countryCounts.get(c) || 0) + 1);
        });
      }
    });

    const topList = [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([country, count]) => ({ country, count }));

    let result = products;
    if (blendOnly) {
      result = products.filter((p) => extractProductCountries(p).length === 0);
    } else if (selectedCountry) {
      result = products.filter((p) => extractProductCountries(p).includes(selectedCountry));
    }

    return {
      filteredProducts: result,
      unmappedBlendCount: unmappedBlends,
      countryTopList: topList,
    };
  }, [products, selectedCountry, blendOnly]);

  // 필터 변경 시 표시 개수 리셋
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCountry, blendOnly, mapMode, selectedVariety]);

  const handleSelectCountry = (country) => {
    setBlendOnly(false);
    setSelectedCountry(country);
    if (country) {
      setHighlightedCountries([country]);
    } else {
      setHighlightedCountries([]);
    }
  };

  const handleToggleBlendOnly = () => {
    setSelectedCountry(null);
    setHighlightedCountries([]);
    setBlendOnly((prev) => !prev);
  };

  const handleProductCardClick = (product) => {
    const countries = extractProductCountries(product);
    setHighlightedCountries(countries);
    setFocusedProductId(product.id);
  };

  const shownProducts = listProducts || filteredProducts;
  const visibleProducts = shownProducts.slice(0, visibleCount);

  return (
    <div className="browse-layout atlas-page">
      <div className="map-mode-toggle" role="group" aria-label="보기 전환">
        {[['origin', '산지'], ['variety', '품종']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={mapMode === id ? 'is-active' : ''}
            aria-pressed={mapMode === id}
            onClick={() => {
              setMapMode(id);
              setSelectedVariety(null);
              setFocusedProductId(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mapMode === 'variety' ? (
        <>
          <section className="variety-guide" aria-label="빈픽 추천 등급">
            <div className="variety-guide-head">
              <h2 className="section-title">빈픽 추천 등급</h2>
              <span className="variety-guide-note">
                단일 품종 원두 {[...varietyIdsByProduct.values()].filter((ids) => ids.length).length}개 / 전체 {products.length}개 기준 (블렌드 제외)
              </span>
            </div>
            {VARIETY_TIERS.map(({ tier, caption, items }) => (
              <div className="variety-tier" key={tier}>
                <div className="variety-tier-label">
                  <strong>{tier}</strong>
                  <span>{caption}</span>
                </div>
                <div className="variety-tier-chips">
                  {items.map((item) => {
                    const count = varietyCounts[item.id] || 0;
                    const active = selectedVariety?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`variety-chip ${active ? 'is-active' : ''} ${count ? '' : 'is-empty'}`}
                        aria-pressed={active}
                        onClick={() => setSelectedVariety(active ? null : { ...item, tier })}
                      >
                        <span className="variety-chip-name">{item.name} <span className="variety-chip-count">({count})</span></span>
                        <span className="variety-chip-ko">{item.ko}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          {selectedVariety && (
            <div className="origin-story-card">
              <div className="origin-story-header">
                <div className="origin-story-title-group">
                  <span className="variety-story-tier">{selectedVariety.tier}</span>
                  <div>
                    <span className="origin-story-name">{selectedVariety.ko}</span>
                    <span className="origin-story-en"> ({selectedVariety.name})</span>
                  </div>
                </div>
                <span className="origin-story-badge">
                  {varietyCounts[selectedVariety.id] ? `원두 ${varietyCounts[selectedVariety.id]}종 판매 중` : '현재 판매 없음'}
                </span>
              </div>
              <div className="origin-story-body">
                <p className="variety-intro">{selectedVariety.note}</p>
                {STORY_SECTIONS.filter(([key]) => selectedVariety.story?.[key]).map(([key, label]) => (
                  <div className="variety-story-item" key={key}>
                    <strong>{label}</strong>
                    <p>{selectedVariety.story[key]}</p>
                  </div>
                ))}
                {varietyStats && (
                  <div className="variety-story-item is-beanpick">
                    <strong>빈픽에서는</strong>
                    <p>
                      지금 {varietyCounts[selectedVariety.id]}개 판매 중{varietyStats.priceRange ? ` · ${varietyStats.priceRange}` : ''}
                      {varietyStats.topRoasters ? <><br />많이 파는 곳: {varietyStats.topRoasters}</> : null}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
      <>
      {/* 1. 상단 세계지도 뷰어 */}
      <WorldCoffeeMap
        products={products}
        selectedCountry={selectedCountry}
        highlightedCountries={highlightedCountries}
        discountCountries={discountCountries}
        unmappedCount={unmappedBlendCount}
        onSelectCountry={handleSelectCountry}
        onShowList={() => {
          setBlendOnly(false);
          // 필터 해제로 목록 위치가 바뀐 뒤 이동한다.
          window.requestAnimationFrame(() => {
            listHeadRef.current?.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
              block: 'start',
            });
            listHeadRef.current?.focus({ preventScroll: true });
          });
        }}
      />

      {/* 2. 퀵 필터 칩 바 */}
      <div className="map-view-controls" role="group" aria-label="원두 생산국 빠른 선택">
        <button
          type="button"
          className={`map-filter-chip ${!selectedCountry && !blendOnly ? 'is-active' : ''}`}
          aria-pressed={!selectedCountry && !blendOnly}
          onClick={() => {
            setSelectedCountry(null);
            setBlendOnly(false);
            setHighlightedCountries([]);
            setFocusedProductId(null);
          }}
        >
          전체 <span>{products.length}</span>
        </button>

        {countryTopList.map(({ country, count }) => {
          return (
            <button
              key={country}
              type="button"
              className={`map-filter-chip ${selectedCountry === country ? 'is-active' : ''}`}
              aria-pressed={selectedCountry === country}
              onClick={() => handleSelectCountry(selectedCountry === country ? null : country)}
            >
              {country} <span>{count}</span>
            </button>
          );
        })}

        <button
          type="button"
          className={`map-filter-chip is-blend-chip ${blendOnly ? 'is-active' : ''}`}
          aria-pressed={blendOnly}
          onClick={handleToggleBlendOnly}
        >
          생산국 미표기 <span>{unmappedBlendCount}</span>
        </button>
      </div>

      {blendOnly && (
        <div className="origin-story-card">
          <div className="origin-story-header">
            <div className="origin-story-title-group">
              <span className="origin-story-flag"><Icon name="bean" size={22} /></span>
              <div>
                <span className="origin-story-name">하우스 블렌드 (House Blend)</span>
                <span className="origin-story-en">(생산국 미표기 또는 복합 배합)</span>
              </div>
            </div>
            <span className="origin-story-badge">
              원두 {unmappedBlendCount}종 판매 중
            </span>
          </div>
          <div className="origin-story-body">
            <div className="origin-story-item">
              <span className="origin-story-label">특징</span>
              <span className="origin-story-val">
                여러 산지의 원두를 황금비율로 배합하여 균형 잡힌 바디감과 고소한 단맛을 느낄 수 있는 로스터리의 대표 시그니처 원두입니다.
              </span>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* 3. 섹션 타이틀 */}
      <div className="section-head atlas-list-head" ref={listHeadRef} tabIndex={-1} style={{ marginBottom: '16px' }}>
        <div>
          <span className="section-eyebrow">원두 목록</span>
          <h2 className="section-title" style={{ fontSize: '18px' }}>
            {mapMode === 'variety'
              ? `${selectedVariety ? selectedVariety.ko : '단일 품종'} 원두 (${shownProducts.length}개)`
              : selectedCountry
              ? `${selectedCountry} 생산 원두 (${filteredProducts.length}개)`
              : blendOnly
              ? `생산국 미표기 블렌드 (${filteredProducts.length}개)`
              : `전체 원두 (${filteredProducts.length}개)`}
          </h2>
        </div>
      </div>

      {/* 4. 원두 카드 그리드 피드 */}
      <div className={`bean-grid atlas-product-grid ${mapMode === 'variety' ? 'is-variety-grid' : ''}`}>
        {visibleProducts.map((product) => {
          const isFocused = focusedProductId === product.id;
          return (
            <div
              key={product.id}
              onClick={() => handleProductCardClick(product)}
              style={{
                borderRadius: 'var(--radius)',
                transition: 'box-shadow 0.2s ease',
                boxShadow: isFocused ? '0 0 0 2.5px var(--accent)' : undefined,
              }}
            >
              <BeanProductCard
                product={product}
                activeNotes={[]}
                isFavorite={favoriteIds.includes(product.id)}
                onSelect={() => {
                  handleProductCardClick(product);
                  onSelectProduct?.(product);
                }}
                onToggleFavorite={onToggleFavorite}
                tasteAxis={null}
              />
            </div>
          );
        })}
      </div>

      {/* 5. 더보기 버튼 */}
      {visibleProducts.length < shownProducts.length && (
        <div style={{ textAlign: 'center', marginTop: '24px', marginBottom: '24px' }}>
          <button
            type="button"
            className="filter-chip"
            style={{ padding: '10px 24px', fontSize: '14px', fontWeight: '600' }}
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
          >
            더 많은 원두 보기 ({visibleProducts.length} / {shownProducts.length})
          </button>
        </div>
      )}
    </div>
  );
}

function BrowsePage({ activeNotes, budget, capacityFilter, dataMode, decafOnly, saleOnly, discountCount, favoriteIds, hasActiveFilters, lastLoadedAt, loadState, noteExcludeQuery, noteIncludeQuery, noteOptions, onClearFilters, onNoteClick, onSelectProduct, onToggleFavorite, originFilter, originOptions, processFilter, processOptions, publishState, products, setBudget, setCapacityFilter, setDecafOnly, setSaleOnly, setNoteExcludeQuery, setNoteIncludeQuery, setOriginFilter, setProcessFilter, setSortMode, sortMode, summaryProducts, tasteAxis, setTasteAxis }) {
  const PAGE_SIZE = 24;
  const NOTE_PREVIEW_COUNT = 12;
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [notesExpanded, setNotesExpanded] = React.useState(false);
  const [filtersExpanded, setFiltersExpanded] = React.useState(false);
  const [showBackToTop, setShowBackToTop] = React.useState(false);

  // 필터나 데이터가 바뀌면 다시 첫 페이지부터 보여준다.
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [products]);

  React.useEffect(() => {
    function handleScroll() {
      setShowBackToTop(window.scrollY > 600);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isLoading = loadState.status === 'loading';
  const showSkeleton = isLoading && dataMode === 'mock';
  const visibleProducts = products.slice(0, visibleCount);
  const visibleNotes = notesExpanded ? noteOptions : noteOptions.slice(0, NOTE_PREVIEW_COUNT);
  const hiddenNoteCount = noteOptions.length - NOTE_PREVIEW_COUNT;
  // 켜진 필터 개수. 칩 줄의 '필터' 옆에 보여 줘서 접혀 있어도 걸린 조건이 있는 걸 알 수 있게 한다.
  const filterCount = [
    originFilter !== 'all', processFilter !== 'all', budget !== 'all', capacityFilter !== 'all',
    activeNotes.length > 0, Boolean(noteIncludeQuery.trim()), Boolean(noteExcludeQuery.trim()), tasteAxis !== null,
  ].filter(Boolean).length;
  const summary = {
    total: summaryProducts.filter((product) => !product.isSoldOut).length,
    discount: discountCount,
  };
  const soldOutCount = summaryProducts.filter((product) => product.isSoldOut).length;
  const sortValue = tasteAxis !== null ? 'taste' : sortMode;
  const sortOptions = [
    ['score', '추천순'],
    ['discount', '할인율 높은순'],
    ['unitPriceAsc', '100g당 낮은 가격순'],
    ['unitPriceDesc', '100g당 높은 가격순'],
  ];
  const sortName = sortValue === 'taste' ? '입맛 맞춤순' : (sortOptions.find(([value]) => value === sortValue)?.[1] ?? '추천순');
  const emptyMessage = '조건에 맞는 원두가 없습니다. 검색어를 줄이거나 필터를 해제해보세요.';

  return (
    <div className="page-stack">
      {publishState.message && (
        <div className={`load-banner load-${publishState.status}`}>
          {publishState.status === 'loading' && <LoadingSpinner />}
          <strong>{publishState.status === 'success' ? '게시 완료' : publishState.status === 'error' ? '게시 실패' : '게시 중'}</strong>
          <p>{publishState.message}</p>
        </div>
      )}

      {loadState.message && (
        <div className={`load-banner load-${loadState.status}`}>
          {loadState.status === 'loading' && <LoadingSpinner />}
          <strong>{loadState.status === 'success' ? '완료' : loadState.status === 'error' ? '안내' : '확인 중'}</strong>
          <p>{loadState.message}</p>
        </div>
      )}

      <div className="browse-summary">
        <span>전체 <strong>{summary.total}</strong>개</span>
        <span>할인 중 <strong>{summary.discount}</strong>개</span>
        <em>{dataModeSourceLabel(dataMode)} · 마지막 확인 {formatDateTime(lastLoadedAt)}</em>
      </div>

      <div className="results-toolbar">
        {/* 정렬(하나만 고름)은 펼치는 버튼, 필터(여러 개 켬)는 칩으로 모양부터 나눈다. */}
        <div className="browse-chips" role="toolbar" aria-label="정렬과 필터">
          <button className="chip chip-filter" type="button" aria-haspopup="dialog" onClick={() => setFiltersExpanded(true)}>
            <Icon name="filter" size={16} />
            필터
            {filterCount > 0 && <em>{filterCount}</em>}
          </button>
          <label className="chip chip-sort">
            <span className="visually-hidden">정렬</span>
            <span aria-hidden="true">{sortName}</span>
            <Icon name="chevron" size={16} />
            <select
              value={sortValue}
              onChange={(event) => {
                if (event.target.value === 'taste') return;
                setTasteAxis(null);
                setSortMode(event.target.value);
              }}
            >
              {tasteAxis !== null && <option value="taste">입맛 맞춤순</option>}
              {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <span className="chip-divider" aria-hidden="true" />
          {/* 할인 중은 필터이면서, 켜면 자동으로 할인율 높은순 정렬로 보여준다. */}
          <button
            className={`chip ${saleOnly ? 'active' : ''}`}
            type="button"
            aria-pressed={saleOnly}
            onClick={() => {
              const next = !saleOnly;
              setSaleOnly(next);
              if (next) {
                setTasteAxis(null);
                setSortMode('discount');
              } else if (sortMode === 'discount') {
                setSortMode('score');
              }
            }}
          >
            할인 중
          </button>
          <button className={`chip ${decafOnly ? 'active' : ''}`} type="button" aria-pressed={decafOnly} onClick={() => setDecafOnly(!decafOnly)}>디카페인</button>
          <button className={`chip ${tasteAxis !== null ? 'active' : ''}`} type="button" aria-haspopup="dialog" onClick={() => setFiltersExpanded(true)}>입맛 맞춤</button>
          {/* 로스터리 선택처럼 필터를 열지 않고 걸린 조건도 바로 되돌릴 수 있게 한다. */}
          {hasActiveFilters && <button className="chip chip-reset" type="button" onClick={onClearFilters}>초기화</button>}
        </div>
        <p className="results-count">
          {showSkeleton ? <strong>원두를 불러오는 중…</strong> : <strong>{hasActiveFilters ? '찾은 원두' : '판매 중'} {products.length}개</strong>}
          {/* 검색·필터가 걸리면 숫자가 안 맞으므로 품절 안내는 숨긴다. */}
          {!showSkeleton && !hasActiveFilters && soldOutCount > 0 && <span> · 품절 {soldOutCount}개 숨김</span>}
        </p>
      </div>

      {filtersExpanded && (
        <div className="sheet-overlay" onClick={() => setFiltersExpanded(false)}>
          <section className="filter-sheet" role="dialog" aria-modal="true" aria-label="필터" onClick={(event) => event.stopPropagation()}>
            <header className="filter-sheet-head">
              <h2>필터</h2>
              <div>
                <button className="sheet-text-btn" type="button" disabled={!hasActiveFilters} onClick={onClearFilters}>초기화</button>
                <button className="sheet-close" type="button" aria-label="닫기" onClick={() => setFiltersExpanded(false)}>
                  <Icon name="close" size={22} />
                </button>
              </div>
            </header>
            <div className="filter-sheet-body" id="bean-filters-body">
            {/* 맛 슬라이더 UI */}
            <div className="taste-slider-container">
              <div className="taste-slider-header">
                <span>입맛 맞춤 정렬</span>
                {tasteAxis !== null && (
                  <button className="btn-reset" type="button" onClick={() => setTasteAxis(null)}>초기화</button>
                )}
              </div>
              <div className="taste-slider-body">
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.5"
                  value={tasteAxis === null ? 0 : tasteAxis}
                  onChange={(event) => setTasteAxis(parseFloat(event.target.value))}
                  className={tasteAxis === null ? 'is-disabled' : 'is-active'}
                />
                <div className="taste-slider-labels">
                  <span className="label-left">산뜻·산미형</span>
                  <span className="label-value">
                    {tasteAxis === null
                      ? '슬라이더를 조작해 입맛에 맞춰보세요'
                      : (() => {
                          const getCountForAxis = (axis) => {
                            return products.filter((p) => {
                              if (p.acidityScore === null || p.acidityScore === undefined) return false;
                              const axes = [-1.0, -0.5, 0.0, 0.5, 1.0];
                              let minD = Infinity;
                              let closestAxis = 0;
                              axes.forEach((ax) => {
                                const d = Math.abs(p.acidityScore + ax);
                                if (d < minD) {
                                  minD = d;
                                  closestAxis = ax;
                                }
                              });
                              return closestAxis === axis;
                            }).length;
                          };
                          const count = getCountForAxis(tasteAxis);
                          const label = tasteAxis === -1.0
                            ? '산뜻·상큼'
                            : tasteAxis === -0.5
                            ? '새콤한 편'
                            : tasteAxis === 0
                            ? '밸런스'
                            : tasteAxis === 0.5
                            ? '고소한 편'
                            : '고소·묵직';
                          return `${label} (${count}개)`;
                        })()}
                  </span>
                  <span className="label-right">고소·묵직형</span>
                </div>
              </div>
            </div>

            <div className="detail-filter-row">
              <label>
                <span>원산지</span>
                <select value={originFilter} onChange={(event) => setOriginFilter(event.target.value)}>
                  <option value="all">전체</option>
                  {originOptions.map((label) => <option key={label} value={label}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>가공방식</span>
                <select value={processFilter} onChange={(event) => setProcessFilter(event.target.value)}>
                  <option value="all">전체</option>
                  {processOptions.map((label) => <option key={label} value={label}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>가격</span>
                <select value={budget} onChange={(event) => setBudget(event.target.value)}>
                  <option value="all">가격 전체</option>
                  <option value="under30000">3만원 이하</option>
                  <option value="under50000">5만원 이하</option>
                </select>
              </label>
              <label>
                <span>용량</span>
                <select value={capacityFilter} onChange={(event) => setCapacityFilter(event.target.value)}>
                  <option value="all">용량 전체</option>
                  <option value="under100">100g</option>
                  <option value="over200">200g</option>
                  <option value="over500">500g</option>
                  <option value="exact1000">1kg</option>
                </select>
              </label>
            </div>

            {noteOptions.length > 0 && (
              <div className="detail-note-cloud">
                <span>테이스팅 노트</span>
                <div className="notes">
                  {visibleNotes.map((note) => (
                    <NoteTag key={note} note={note} active={activeNotes.includes(note)} onClick={onNoteClick} />
                  ))}
                  {hiddenNoteCount > 0 && (
                    <button className="note-tag note-more" type="button" onClick={() => setNotesExpanded(!notesExpanded)}>
                      {notesExpanded ? '접기' : `+${hiddenNoteCount}개 더`}
                    </button>
                  )}
                </div>
                <div className="note-query-row">
                  <label>
                    꼭 포함
                    <input
                      type="text"
                      value={noteIncludeQuery}
                      placeholder="예: 초콜릿 견과류"
                      onChange={(event) => setNoteIncludeQuery(event.target.value)}
                    />
                  </label>
                  <label>
                    제외
                    <input
                      type="text"
                      value={noteExcludeQuery}
                      placeholder="예: 산미, 플로럴"
                      onChange={(event) => setNoteExcludeQuery(event.target.value)}
                    />
                  </label>
                </div>
              </div>
            )}
            </div>
            <footer className="filter-sheet-foot">
              <button className="btn btn-primary" type="button" onClick={() => setFiltersExpanded(false)}>원두 {products.length}개 보기</button>
            </footer>
          </section>
        </div>
      )}

      <section className="panel browse-grid-panel">
        {showSkeleton ? (
          <div className="bean-grid" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <div className="bean-card skeleton-card" key={index}>
                <div className="skeleton-image" />
                <div className="skeleton-body">
                  <div className="skeleton-line" />
                  <div className="skeleton-line short" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <ProductGrid
              activeNotes={activeNotes}
              favoriteIds={favoriteIds}
              emptyMessage={emptyMessage}
              products={visibleProducts}
              onSelect={onSelectProduct}
              onToggleFavorite={onToggleFavorite}
              tasteAxis={tasteAxis}
            />
            {products.length > visibleCount && (
              <div className="load-more-row">
                <button className="btn" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                  더 보기 ({products.length - visibleCount}개 남음)
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {showBackToTop && (
        <button
          className="back-to-top"
          type="button"
          aria-label="맨 위로"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <Icon name="arrowUp" size={20} />
        </button>
      )}
    </div>
  );
}
