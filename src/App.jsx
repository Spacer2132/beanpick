import React from 'react';
import { mockBeans } from './data/mockBeans.ts';
import { CHANNEL_LABEL, SOURCE_STATUS_LABEL, roasterySources } from './data/roasterySources.ts';
import { normalizeCafe24Pages } from './services/adapters/cafe24OfficialAdapter.ts';
import { normalizeMomosPages } from './services/adapters/momosOfficialAdapter.ts';
import { OFFICIAL_MALL_CONFIGS } from './services/adapters/officialMallConfigs.ts';
import { enrichTerarosaProducts, normalizeTerarosaApiRows, parseTerarosaHtmlProducts } from './services/adapters/terarosaOfficialAdapter.ts';
import {
  createPriceOptions,
  filterDiscountProducts,
  formatPrice,
  formatProductDisplayInfo,
  getNoteOptions,
  getPricePer100g,
  getProductCountryLabel,
  getProductProcessLabel,
  getRepresentativePriceOption,
  groupProductsByNameAndWeight,
  isDecafProduct,
  isRealProductUrl,
  matchesCapacityFilter,
  matchesNoteQuery,
  matchesSmartSearch,
  normalizeProducts,
  sortProducts,
} from './services/coreFeatures.js';
import { createMonitorSummary, loadFavoriteProductIds, saveFavoriteProductIds, saveProductSnapshot } from './services/monitoring.ts';
import { getPublishButtonLabel, loadPublishedSnapshot } from './services/publishedSnapshot.js';
import { getPriceDelta, getProductHistory, loadPriceHistory, loadProductCache, recordPriceHistory, saveProductCache } from './services/productHistory.js';

const NAV = [
  { id: 'products', label: '원두', group: '둘러보기', badge: mockBeans.length },
  { id: 'alerts', label: '관심·알림', group: '둘러보기', badge: 0 },
  { id: 'sources', label: '로스터리', group: '데이터', badge: roasterySources.length },
  { id: 'server', label: '앱 상태', group: '데이터' },
];

function productSearchText(product) {
  const displayInfo = formatProductDisplayInfo(product);
  const optionText = (product.priceOptions || [])
    .flatMap((option) => [option.weightLabel, option.priceLabel, option.unitPriceLabel])
    .filter(Boolean);

  return [
    product.roasterName,
    product.productName,
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
    window.beanpick?.fetchTerarosaProducts
    && window.beanpick?.fetchMomosProducts
    && window.beanpick?.fetchOfficialMallProducts
    && window.beanpick?.fetchSmartStoreProducts
  );
}

function getOfficialSourceIds() {
  return ['fritz', 'namusairo', 'coffeelibre', 'werk', 'deepbluelake', 'hellcafe', 'centercoffee', 'coffee502'];
}

const SMARTSTORE_SOURCE_LABELS = {
  roasterick: '로스터릭',
  lubia: '루비아 커피',
  hitte: '히떼 로스터리',
  identity: '아이덴티티 커피랩',
  toch: '토치 커피',
  fillout: '필아웃커피',
  cafedoan: '카페도안',
};

function getSmartStoreSourceIds() {
  return ['roasterick', 'lubia', 'hitte', 'identity', 'toch', 'fillout', 'cafedoan'];
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

// 관심 원두가 재입고되거나 가격이 내리면 시스템 알림을 보낸다.
function notifyFavoriteChanges(changes, favoriteIds, history) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  changes.filter((change) => favoriteIds.includes(change.id)).forEach((change) => {
    try {
      if (change.type === 'restocked') {
        new Notification('BeanPick · 재입고', { body: change.detail });
      } else if (change.type === 'priceChanged' && getPriceDelta(history, change.id) < 0) {
        new Notification('BeanPick · 가격 인하', { body: change.detail });
      }
    } catch {
      // 알림을 못 보내도 앱 동작은 계속한다.
    }
  });
}

function formatPriceDelta(delta) {
  const amount = new Intl.NumberFormat('ko-KR').format(Math.abs(delta));
  return delta < 0 ? `지난번보다 ${amount}원 ↓` : `지난번보다 ${amount}원 ↑`;
}

// 관심 원두의 가격 흐름을 보여주는 작은 선 그래프
function Sparkline({ points }) {
  if (points.length < 2) return null;

  const prices = points.map((point) => point.price).filter((price) => price > 0);
  if (prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const width = 120;
  const height = 32;
  const pad = 3;
  const coords = prices.map((price, index) => {
    const x = pad + (index / (prices.length - 1)) * (width - pad * 2);
    const y = max === min
      ? height / 2
      : pad + (1 - (price - min) / (max - min)) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} aria-label="가격 변화 그래프">
      <polyline points={coords.join(' ')} fill="none" />
    </svg>
  );
}

// 상세 보기용 가격 기록 그래프. 최저/최고가와 기록 기간을 함께 보여준다.
function PriceChart({ points }) {
  const priced = points.filter((point) => point.price > 0);

  if (priced.length < 2) {
    return <p className="chart-empty">가격 기록이 2회 이상 쌓이면 그래프가 표시됩니다. 원두를 불러올 때마다 자동으로 기록돼요.</p>;
  }

  const prices = priced.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const width = 560;
  const height = 140;
  const pad = 12;
  const coords = prices.map((price, index) => {
    const x = pad + (index / (prices.length - 1)) * (width - pad * 2);
    const y = max === min
      ? height / 2
      : pad + (1 - (price - min) / (max - min)) * (height - pad * 2);
    return [x, y];
  });

  return (
    <div className="price-chart">
      <svg viewBox={`0 0 ${width} ${height}`} aria-label="가격 기록 그래프">
        <polyline points={coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} fill="none" />
        {coords.map(([x, y], index) => (
          <circle key={index} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3" />
        ))}
      </svg>
      <div className="price-chart-meta">
        <span>최저 {formatPrice(min)} · 최고 {formatPrice(max)}</span>
        <span>{formatDateTime(new Date(priced[0].t))} ~ {formatDateTime(new Date(priced[priced.length - 1].t))}</span>
      </div>
    </div>
  );
}

// 카드를 누르면 열리는 원두 상세 보기 창
function ProductDetailModal({ isFavorite, priceDelta, priceHistory, product, onClose, onToggleFavorite }) {
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
    ['원산지', getProductCountryLabel(product) || product.origin],
    ['가공방식', displayInfo.process || product.process],
    ['품종', displayInfo.variety],
    ['농장', displayInfo.farm],
    ['로스팅', product.roastLevel],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={`${product.productName} 상세 정보`} onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>×</button>

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
              {infoRows.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
            {product.blendComposition && product.blendComposition.length > 0 && (
              <div className="bean-blend-info">
                <span className="bean-blend-label">블렌딩</span>
                {product.blendComposition.map((c) => (
                  <span key={c.country} className="bean-blend-chip">{c.country} {c.percent}%</span>
                ))}
              </div>
            )}
            {product.tastingNotes.length > 0 && (
              <div className="notes">
                {product.tastingNotes.map((note) => <span className="note-tag is-static" key={note}>{note}</span>)}
              </div>
            )}
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-head">
            <h3>가격</h3>
            {priceDelta !== 0 && (
              <span className={`price-delta ${priceDelta < 0 ? 'down' : 'up'}`}>{formatPriceDelta(priceDelta)}</span>
            )}
          </div>
          <div className="bean-price-options">
            {priceOptions.map((option) => {
              const hasOptionLink = isRealProductUrl(option.productUrl);
              const PriceOptionTag = hasOptionLink ? 'a' : 'div';

              return (
                <PriceOptionTag
                  className={`bean-price-option ${hasOptionLink ? 'is-link' : ''}`}
                  key={option.id}
                  href={hasOptionLink ? option.productUrl : undefined}
                  target={hasOptionLink ? '_blank' : undefined}
                  rel={hasOptionLink ? 'noreferrer' : undefined}
                >
                  {option.originalPriceLabel && <del>{option.originalPriceLabel}</del>}
                  <strong>{option.priceLabel}</strong>
                  {option.discountLabel && <small>{option.discountLabel}</small>}
                  <span>{option.weightLabel}</span>
                  {option.unitPriceLabel && <em>{option.unitPriceLabel}</em>}
                </PriceOptionTag>
              );
            })}
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-head">
            <h3>가격 기록</h3>
          </div>
          <PriceChart points={getProductHistory(priceHistory, product.id)} />
        </div>

        <div className="modal-actions">
          <button className="btn" type="button" onClick={() => onToggleFavorite(product.id)}>
            {isFavorite ? '♥ 관심 해제' : '♡ 관심 저장'}
          </button>
          {storeLink && (
            <a className="btn" href={storeLink} target="_blank" rel="noreferrer">원두 목록 보기</a>
          )}
          {productLink && (
            <a className="btn btn-primary" href={productLink} target="_blank" rel="noreferrer">상품 페이지 열기</a>
          )}
        </div>
      </div>
    </div>
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

function BeanProductCard({ product, activeNotes, isFavorite, priceDelta = 0, onNoteClick, onSelect, onToggleFavorite }) {
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
  const imageContent = hasImage
    ? <img src={product.imageUrl} alt="" loading="lazy" />
    : <span className="bean-image-placeholder">{product.roasterName.slice(0, 2)}</span>;

  return (
    <article className={`bean-card ${product.isSoldOut ? 'is-soldout' : ''}`}>
      <div className="bean-image">
        <button className="bean-image-link" type="button" aria-label={detailLabel} onClick={() => onSelect(product)}>
          {imageContent}
        </button>
        {product.isNew && <b>NEW</b>}
        {product.isSoldOut && <span className="soldout-ribbon">품절</span>}
        <button
          className={`image-favorite-btn ${isFavorite ? 'active' : ''}`}
          type="button"
          aria-label={isFavorite ? `${product.productName} 관심 해제` : `${product.productName} 관심 저장`}
          onClick={() => onToggleFavorite(product.id)}
        >
          {isFavorite ? '♥' : '♡'}
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
            {infoItems.map((item) => <span key={item}>{item}</span>)}
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
        {product.tastingNotes.length > 0 && (
          <div className="notes">
            {product.tastingNotes.map((note) => (
              <NoteTag key={note} note={note} active={activeNotes.includes(note)} onClick={onNoteClick} />
            ))}
          </div>
        )}
      </div>
      <div className="bean-footer">
        <div className="bean-price-options">
          {cardPriceOptions.map((option) => {
            const hasOptionLink = isRealProductUrl(option.productUrl);
            const PriceOptionTag = hasOptionLink ? 'a' : 'div';
            const [unitPriceValue, unitPriceSuffix] = option.unitPriceLabel ? option.unitPriceLabel.split('/') : [];

            return (
              <PriceOptionTag
                className={`bean-price-option ${hasOptionLink ? 'is-link' : ''}`}
                key={option.id}
                href={hasOptionLink ? option.productUrl : undefined}
                target={hasOptionLink ? '_blank' : undefined}
                rel={hasOptionLink ? 'noreferrer' : undefined}
                aria-label={hasOptionLink ? `${product.productName} ${option.weightLabel} 상품 열기` : undefined}
              >
                <div className="bean-price-main">
                  {option.originalPriceLabel && <del>{option.originalPriceLabel}</del>}
                  <strong>{option.priceLabel}</strong>
                  {option.discountLabel && <small>{option.discountLabel}</small>}
                  <span>{option.weightLabel}</span>
                </div>
                {option.unitPriceLabel && (
                  <em className="bean-price-unit">
                    <span className="bean-price-unit-value">{unitPriceValue}</span>
                    {unitPriceSuffix && <span className="bean-price-unit-suffix">{unitPriceSuffix}</span>}
                  </em>
                )}
              </PriceOptionTag>
            );
          })}
          {representativePrice.extraCount > 0 && (
            <span className="bean-price-more-pill">+{representativePrice.extraCount} 용량</span>
          )}
        </div>
        {priceDelta !== 0 && (
          <div className="bean-actions">
            <span className={`price-delta ${priceDelta < 0 ? 'down' : 'up'}`}>{formatPriceDelta(priceDelta)}</span>
          </div>
        )}
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

function ProductGrid({ activeNotes, emptyMessage = '조건에 맞는 원두가 없습니다. 검색어를 줄이거나 필터를 해제해보세요.', favoriteIds, priceDeltas = {}, products, onNoteClick, onSelect, onToggleFavorite }) {
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
          priceDelta={priceDeltas[product.id] || 0}
          onNoteClick={onNoteClick}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
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
          <span className="eyebrow">Roasteries</span>
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

function AlertsPage({ changes, favoriteIds, favoriteProducts, priceHistory, onToggleFavorite }) {
  const favoriteChanges = changes.filter((change) => favoriteIds.includes(change.id));

  return (
    <div className="page-stack">
      <header className="page-head compact">
        <div>
          <span className="eyebrow">In-app alerts</span>
          <h1>관심 원두와 입고 알림</h1>
          <p>저장한 관심 원두의 품절, 재입고, 가격 변화를 앱 안에서 확인합니다.</p>
        </div>
      </header>

      <div className="alerts-layout">
        <section className="panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">Favorites</span>
              <h2>관심 원두 <em>{favoriteProducts.length}개</em></h2>
            </div>
          </div>
          {favoriteProducts.length > 0 ? (
            <div className="favorite-list">
              {favoriteProducts.map((product) => {
                const delta = getPriceDelta(priceHistory, product.id);

                return (
                  <article className="favorite-row" key={product.id}>
                    <div>
                      <strong>{product.productName}</strong>
                      <span>{product.roasterName} · {formatPrice(product.price)} · {product.isSoldOut ? '품절' : '판매 중'}</span>
                      {delta !== 0 && (
                        <span className={`price-delta ${delta < 0 ? 'down' : 'up'}`}>{formatPriceDelta(delta)}</span>
                      )}
                    </div>
                    <div className="favorite-side">
                      <Sparkline points={getProductHistory(priceHistory, product.id)} />
                      <button className="btn btn-small" type="button" onClick={() => onToggleFavorite(product.id)}>관심 해제</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-result">아직 관심 원두가 없습니다. 상품 카드에서 관심 저장을 눌러보세요.</div>
          )}
        </section>

        <aside className="panel side-panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">Updates</span>
              <h2>관심 변화</h2>
            </div>
          </div>
          <ChangeList changes={favoriteChanges} />
        </aside>
      </div>
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
          <span className="eyebrow">App status</span>
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
              <span className="eyebrow">iPhone</span>
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
            <span className="eyebrow">Connection</span>
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
            <span className="eyebrow">SmartStore</span>
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
  const [screen, setScreen] = React.useState('products');
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
  const [discountOnly, setDiscountOnly] = React.useState(false);
  const [decafOnly, setDecafOnly] = React.useState(false);
  // 앱을 켜면 마지막으로 저장된 상품 목록을 먼저 보여준다.
  const [initialCache] = React.useState(() => loadProductCache());
  const [baseProducts, setBaseProducts] = React.useState(initialCache?.products ?? mockBeans);
  const [dataMode, setDataMode] = React.useState(initialCache ? 'cached' : 'mock');
  const [loadState, setLoadState] = React.useState({ status: 'idle', message: '' });
  const [publishState, setPublishState] = React.useState({ status: 'idle', message: '' });
  const [smartStoreState, setSmartStoreState] = React.useState({ status: 'idle', message: '' });
  const [lastLoadedAt, setLastLoadedAt] = React.useState(initialCache ? new Date(initialCache.savedAt) : null);
  const [favoriteIds, setFavoriteIds] = React.useState(() => loadFavoriteProductIds());
  const [monitorSummary, setMonitorSummary] = React.useState(() => createMonitorSummary(initialCache?.products ?? mockBeans, roasterySources));
  const [priceHistory, setPriceHistory] = React.useState(() => loadPriceHistory());
  // 상세 보기로 열어 둔 상품. 데이터가 새로고침돼도 id로 다시 찾는다.
  const [detailProductId, setDetailProductId] = React.useState(null);
  const [searchFocused, setSearchFocused] = React.useState(false);
  const autoLoadStartedRef = React.useRef(false);
  const loadingRef = React.useRef(false);
  const loadProductsRef = React.useRef(null);

  const products = React.useMemo(() => normalizeProducts(baseProducts), [baseProducts]);
  const discountProducts = React.useMemo(() => filterDiscountProducts(products), [products]);

  const navItems = React.useMemo(() => NAV.map((item) => {
    if (item.id === 'products') return { ...item, badge: products.length };
    if (item.id === 'alerts') return { ...item, badge: favoriteIds.length };
    return item;
  }), [favoriteIds.length, products.length]);

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

  // 상품별 "지난번 대비 가격 변화" 금액. 0이면 변화 없음.
  const priceDeltas = React.useMemo(() => {
    const deltas = {};
    products.forEach((product) => {
      const delta = getPriceDelta(priceHistory, product.id);
      if (delta !== 0) deltas[product.id] = delta;
    });
    return deltas;
  }, [priceHistory, products]);

  // 검색·노트·할인·디카페인·원산지·가공·가격 조건을 적용하고, 품절 원두는 목록에서 제외한다.
  const visibleProducts = React.useMemo(() => (
    products.filter((product) => (
      !product.isSoldOut
      && matchesDetailQuery(product, searchQuery)
      && (activeNotes.length === 0 || activeNotes.some((note) => product.tastingNotes.includes(note)))
      && matchesNoteQuery(product, noteIncludeQuery, noteExcludeQuery)
      && (!discountOnly || discountProducts.includes(product))
      && (!decafOnly || isDecafProduct(product))
      && (originFilter === 'all' || getProductCountryLabel(product) === originFilter)
      && (processFilter === 'all' || getProductProcessLabel(product) === processFilter)
      && matchesBudgetFilter(product, budget)
      && matchesCapacityFilter(product, capacityFilter)
    ))
  ), [activeNotes, budget, capacityFilter, decafOnly, discountOnly, discountProducts, noteExcludeQuery, noteIncludeQuery, originFilter, processFilter, products, searchQuery]);

  const filteredProducts = React.useMemo(() => (
    sortProducts(visibleProducts, sortMode)
  ), [visibleProducts, sortMode]);

  const hasActiveFilters = Boolean(searchQuery.trim()) || activeNotes.length > 0
    || budget !== 'all' || capacityFilter !== 'all' || originFilter !== 'all' || processFilter !== 'all' || discountOnly || decafOnly
    || Boolean(noteIncludeQuery.trim()) || Boolean(noteExcludeQuery.trim());

  const detailProduct = React.useMemo(() => (
    detailProductId ? products.find((product) => product.id === detailProductId) ?? null : null
  ), [detailProductId, products]);

  // 입력 중인 검색어와 비슷한 로스터리·원두·노트 이름을 추천한다.
  const searchSuggestions = React.useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return [];

    const candidates = new Set();
    products.forEach((product) => {
      candidates.add(product.roasterName);
      candidates.add(formatProductDisplayInfo(product).primary);
      product.tastingNotes.forEach((note) => candidates.add(note));
    });

    return [...candidates]
      .filter(Boolean)
      .filter((candidate) => candidate.toLowerCase() !== query.toLowerCase() && matchesSmartSearch(candidate, query))
      .slice(0, 8);
  }, [products, searchQuery]);

  function clearAllFilters() {
    setSearchQuery('');
    setActiveNotes([]);
    setNoteIncludeQuery('');
    setNoteExcludeQuery('');
    setBudget('all');
    setCapacityFilter('all');
    setOriginFilter('all');
    setProcessFilter('all');
    setDiscountOnly(false);
    setDecafOnly(false);
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

      const result = await window.beanpick.publishToGithub({ products });
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
    setSmartStoreState({ status: 'loading', message: '로스터릭, 루비아, 히떼, 아이덴티티, 토치 원두를 네이버 쇼핑에서 검색하는 중입니다.' });

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
      const tasks = [
        {
          label: '테라로사',
          fetchProducts: async () => {
            const result = await window.beanpick.fetchTerarosaProducts();
            if (!result?.ok) throw new Error(result?.error || '테라로사 데이터를 가져오지 못했습니다.');
            if (result.warning) warnings.push(result.warning);
            const parsedProducts = result.apiRows?.length
              ? normalizeTerarosaApiRows(result.apiRows)
              : parseTerarosaHtmlProducts(result.html || '');
            return enrichTerarosaProducts(parsedProducts, result.detailPages || []);
          },
        },
        {
          label: '모모스커피',
          fetchProducts: async () => {
            const result = await window.beanpick.fetchMomosProducts();
            if (!result?.ok) throw new Error(result?.error || '모모스커피 데이터를 가져오지 못했습니다.');
            return normalizeMomosPages(result.pages || [{ url: result.sourceUrl, html: result.html || '' }]);
          },
        },
        ...getOfficialSourceIds().map((sourceId) => {
          const config = OFFICIAL_MALL_CONFIGS[sourceId];
          return {
            label: config?.roasterName || sourceId,
            fetchProducts: async () => {
              const result = await window.beanpick.fetchOfficialMallProducts(sourceId);
              if (!result?.ok || !config) {
                throw new Error(result?.error || `${config?.roasterName || sourceId} 데이터를 가져오지 못했습니다.`);
              }
              return normalizeCafe24Pages(result.pages || [{ url: result.sourceUrl, html: result.html || '' }], config);
            },
          };
        }),
        ...getSmartStoreSourceIds().map((sourceId) => {
          const label = SMARTSTORE_SOURCE_LABELS[sourceId] || sourceId;
          return {
            label,
            fetchProducts: async () => {
              const result = await window.beanpick.fetchSmartStoreProducts(sourceId);
              if (!result?.ok) throw new Error(result?.error || `${label} 스마트스토어 검색 결과를 가져오지 못했습니다.`);
              if (result.warning) warnings.push(result.warning);
              return result.products || [];
            },
          };
        }),
      ];

      const loadedProducts = [];
      const sourceCounts = [];
      let completedCount = 0;

      // 끝난 로스터리부터 바로 화면에 반영한다. 느린 곳을 기다리지 않는다.
      await Promise.all(tasks.map(async (task) => {
        try {
          const sourceProducts = await task.fetchProducts();
          loadedProducts.push(...sourceProducts);
          sourceCounts.push(`${task.label} ${sourceProducts.length}개`);

          if (loadedProducts.length > 0) {
            setBaseProducts(groupProductsByNameAndWeight([...loadedProducts]));
            setDataMode('live');
          }
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : `${task.label} 데이터를 가져오지 못했습니다.`);
        } finally {
          completedCount += 1;
          setLoadState({
            status: 'loading',
            message: `로스터리 확인 중 ${completedCount}/${tasks.length} · 지금까지 원두 ${loadedProducts.length}개 발견`,
          });
        }
      }));

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
      const nextHistory = recordPriceHistory(groupedProducts, loadedAt.getTime());
      setPriceHistory(nextHistory);
      saveProductSnapshot(groupedProducts);
      notifyFavoriteChanges(summary.changes, favoriteIds, nextHistory);
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

  React.useEffect(() => {
    if (autoLoadStartedRef.current || !canLoadLiveProducts()) return;
    autoLoadStartedRef.current = true;
    handleLoadProducts();
  }, []);

  // 일반 웹에서는 PC 앱이 게시한 products.json 스냅샷을 먼저 읽어 아이폰용 목록으로 보여준다.
  React.useEffect(() => {
    if (canLoadLiveProducts()) return undefined;

    let cancelled = false;
    loadPublishedSnapshot(window.fetch?.bind(window)).then((snapshot) => {
      if (cancelled || !snapshot) return;
      setBaseProducts(snapshot.products);
      setDataMode('published');
      setLastLoadedAt(snapshot.publishedAt ? new Date(snapshot.publishedAt) : null);
      setMonitorSummary(createMonitorSummary(snapshot.products, roasterySources));
      setLoadState({
        status: 'success',
        message: `게시된 원두 ${snapshot.count || snapshot.products.length}종을 불러왔습니다.`,
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
        <button className="brand" type="button" onClick={() => setScreen('products')}>
          <span className="brand-head">
            <span className="brand-mark">BeanPick</span>
            {lastLoadedAt && <span className="brand-updated">{formatDateTime(lastLoadedAt)} 기준</span>}
          </span>
          <span>오늘 마실 원두를 쉽게 고르기</span>
        </button>

        {Object.entries(groups).map(([group, items]) => (
          <nav key={group} className="nav-section" aria-label={group}>
            <span className="nav-label">{group}</span>
            {items.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${screen === item.id ? 'active' : ''}`}
                type="button"
                onClick={() => setScreen(item.id)}
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
                onChange={(event) => setSearchQuery(event.target.value)}
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

        {screen === 'products' ? (
          <BrowsePage
            activeNotes={activeNotes}
            budget={budget}
            capacityFilter={capacityFilter}
            dataMode={dataMode}
            decafOnly={decafOnly}
            discountCount={discountProducts.filter((product) => !product.isSoldOut).length}
            discountOnly={discountOnly}
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
            priceDeltas={priceDeltas}
            processFilter={processFilter}
            processOptions={processOptions}
            publishState={publishState}
            products={filteredProducts}
            setBudget={setBudget}
            setCapacityFilter={setCapacityFilter}
            setDecafOnly={setDecafOnly}
            setDiscountOnly={setDiscountOnly}
            setNoteExcludeQuery={setNoteExcludeQuery}
            setNoteIncludeQuery={setNoteIncludeQuery}
            setOriginFilter={setOriginFilter}
            setProcessFilter={setProcessFilter}
            setSortMode={setSortMode}
            sortMode={sortMode}
            summaryProducts={products}
          />
        ) : screen === 'sources' ? (
          <SourcesPage monitorSummary={monitorSummary} onSaveSnapshot={handleSaveSnapshot} />
        ) : screen === 'alerts' ? (
          <AlertsPage
            changes={monitorSummary.changes}
            favoriteIds={favoriteIds}
            favoriteProducts={favoriteProducts}
            priceHistory={priceHistory}
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
          priceDelta={getPriceDelta(priceHistory, detailProduct.id)}
          priceHistory={priceHistory}
          product={detailProduct}
          onClose={() => setDetailProductId(null)}
          onToggleFavorite={handleToggleFavorite}
        />
      )}
    </div>
  );
}

function BrowsePage({ activeNotes, budget, capacityFilter, dataMode, decafOnly, discountCount, discountOnly, favoriteIds, hasActiveFilters, lastLoadedAt, loadState, noteExcludeQuery, noteIncludeQuery, noteOptions, onClearFilters, onNoteClick, onSelectProduct, onToggleFavorite, originFilter, originOptions, priceDeltas, processFilter, processOptions, publishState, products, setBudget, setCapacityFilter, setDecafOnly, setDiscountOnly, setNoteExcludeQuery, setNoteIncludeQuery, setOriginFilter, setProcessFilter, setSortMode, sortMode, summaryProducts }) {
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
  const sortLabel = sortMode === 'latest' ? '최근 확인순'
    : sortMode === 'unitPriceAsc' ? '100g당 낮은가격순'
    : sortMode === 'unitPriceDesc' ? '100g당 높은가격순'
    : sortMode === 'discount' ? '할인율 높은순'
    : '추천순';
  const summary = {
    total: summaryProducts.filter((product) => !product.isSoldOut).length,
    discount: discountCount,
  };
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
        <div className="section-title">
          <div>
            <span className="eyebrow">{sortLabel}</span>
            <h2>원두 <em>{products.length}개</em></h2>
          </div>
          <div className="sort-actions" aria-label="원두 정렬">
            <button className={sortMode === 'score' ? 'active' : ''} type="button" onClick={() => setSortMode('score')}>추천순</button>
            <button className={sortMode === 'latest' ? 'active' : ''} type="button" onClick={() => setSortMode('latest')}>최근순</button>
            <button className={sortMode === 'unitPriceAsc' ? 'active' : ''} type="button" onClick={() => setSortMode('unitPriceAsc')}>100g당 낮은가격</button>
            <button className={sortMode === 'unitPriceDesc' ? 'active' : ''} type="button" onClick={() => setSortMode('unitPriceDesc')}>100g당 높은가격</button>
            <button className={sortMode === 'discount' ? 'active' : ''} type="button" onClick={() => setSortMode('discount')}>할인율 높은순</button>
          </div>
        </div>
      </div>

      <section className={`panel filter-panel ${filtersExpanded ? 'is-open' : 'is-collapsed'}`}>
        <div className="section-title filter-panel-head">
          <button
            className="filter-toggle"
            type="button"
            aria-expanded={filtersExpanded}
            aria-controls="bean-filters-body"
            onClick={() => setFiltersExpanded((expanded) => !expanded)}
          >
            <span className="filter-toggle-title">🔎 상세검색</span>
            <span className="filter-toggle-icon" aria-hidden="true">{filtersExpanded ? '⌃' : '⌄'}</span>
          </button>
          <div className="filter-panel-actions">
            {hasActiveFilters && <span className="filter-active-label">필터 적용 중</span>}
            {hasActiveFilters && <button className="btn btn-small" type="button" onClick={onClearFilters}>필터 초기화</button>}
          </div>
        </div>
        {filtersExpanded && (
          <div className="filter-panel-body" id="bean-filters-body">
            <div className="filter-chip-row">
              <button className={`note-tag ${discountOnly ? 'active' : ''}`} type="button" onClick={() => setDiscountOnly(!discountOnly)}>
                할인 중 {discountCount > 0 ? discountCount : ''}
              </button>
              <button className={`note-tag ${decafOnly ? 'active' : ''}`} type="button" onClick={() => setDecafOnly(!decafOnly)}>
                디카페인
              </button>
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
        )}
      </section>

      <section className="panel">
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
              priceDeltas={priceDeltas}
              products={visibleProducts}
              onNoteClick={onNoteClick}
              onSelect={onSelectProduct}
              onToggleFavorite={onToggleFavorite}
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
          ↑
        </button>
      )}
    </div>
  );
}
