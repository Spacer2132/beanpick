import React from 'react';
import { dashboardStats, mockBeans, priceTrend } from './data/mockBeans.ts';
import { CHANNEL_LABEL, SOURCE_STATUS_LABEL, roasterySources } from './data/roasterySources.ts';
import { normalizeCafe24Pages } from './services/adapters/cafe24OfficialAdapter.ts';
import { normalizeMomosPages } from './services/adapters/momosOfficialAdapter.ts';
import { OFFICIAL_MALL_CONFIGS } from './services/adapters/officialMallConfigs.ts';
import { enrichTerarosaProducts, normalizeTerarosaApiRows, parseTerarosaHtmlProducts } from './services/adapters/terarosaOfficialAdapter.ts';
import {
  createPriceOptions,
  filterDiscountProducts,
  filterProductsBySearchAndNotes,
  formatPrice,
  formatProductDisplayInfo,
  getNoteOptions,
  getStockCounts,
  getTasteNoteGroup,
  groupProductsByNameAndWeight,
  isRealProductUrl,
  normalizeProducts,
  sortProducts,
} from './services/coreFeatures.js';
import { createMonitorSummary, loadFavoriteProductIds, saveFavoriteProductIds, saveProductSnapshot } from './services/monitoring.ts';

const NAV = [
  { id: 'home', label: '추천 원두', group: '둘러보기' },
  { id: 'products', label: '전체 원두', group: '둘러보기', badge: mockBeans.length },
  { id: 'discounts', label: '할인상품', group: '둘러보기', badge: 0 },
  { id: 'sources', label: '로스터리', group: '데이터', badge: roasterySources.length },
  { id: 'search', label: '취향 찾기', group: '고르기' },
  { id: 'alerts', label: '입고 알림', group: '고르기' },
  { id: 'server', label: '앱 상태', group: '데이터' },
];

const STOCK_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'available', label: '판매 중' },
  { id: 'soldout', label: '품절' },
];

const TASTE_NOTE_COLUMNS = [
  { id: 'light', eyebrow: 'Light', label: '라이트' },
  { id: 'medium', eyebrow: 'Medium', label: '미디움' },
  { id: 'dark', eyebrow: 'Dark', label: '다크' },
];

const TASTE_PRESETS = [
  {
    id: 'bright',
    label: '산미 있는',
    description: '시트러스, 차 같은 산뜻한 느낌',
    matches: (product) => hasText(product, ['citrus', 'orange', 'tea', 'jasmine', 'bergamot', 'floral', '시트러스', '오렌지', '차', '자스민', '베르가못', '플로럴']),
  },
  {
    id: 'nutty',
    label: '고소한',
    description: '견과, 초콜릿, 캐러멜 계열',
    matches: (product) => hasText(product, ['nutty', 'chocolate', 'caramel', 'almond', 'cacao', 'brown sugar', '견과류', '초콜릿', '캐러멜', '아몬드', '브라운슈가']),
  },
  {
    id: 'fruity',
    label: '과일향',
    description: '베리, 복숭아, 열대과일 느낌',
    matches: (product) => hasText(product, ['berry', 'blueberry', 'strawberry', 'peach', 'tropical', 'lychee', 'stone fruit', 'fruit', '베리', '블루베리', '딸기', '복숭아', '열대과일', '리치', '과일']),
  },
  {
    id: 'floral',
    label: '꽃향',
    description: '플로럴하고 향긋한 원두',
    matches: (product) => hasText(product, ['floral', 'jasmine', 'bergamot', 'tea-like', '플로럴', '자스민', '베르가못', '차']),
  },
  {
    id: 'sweet',
    label: '단맛 좋은',
    description: '꿀, 당밀, 달콤한 여운',
    matches: (product) => hasText(product, ['honey', 'sweet', 'caramel', 'brown sugar', '꿀', '단맛', '캐러멜', '브라운슈가']),
  },
  {
    id: 'decaf',
    label: '디카페인',
    description: '카페인 부담을 줄이고 싶을 때',
    matches: (product) => hasText(product, ['decaf', 'decaffeinated', '디카페인']),
  },
];

function hasText(product, words) {
  const text = [
    product.roasterName,
    product.productName,
    product.origin,
    product.process,
    product.roastLevel,
    ...product.tastingNotes,
  ].join(' ').toLowerCase();

  return words.some((word) => text.includes(word.toLowerCase()));
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
  return ['fritz', 'namusairo', 'coffeelibre', 'werk', 'deepbluelake', 'hellcafe', 'centercoffee'];
}

const SMARTSTORE_SOURCE_LABELS = {
  roasterick: '로스터릭',
  lubia: '루비아 커피',
  hitte: '히떼 로스터리',
  identity: '아이덴티티 커피랩',
  toch: '토치 커피',
  cafedoan: '카페도안',
};

function getSmartStoreSourceIds() {
  return ['roasterick', 'lubia', 'hitte', 'identity', 'toch', 'cafedoan'];
}

function Spark({ data }) {
  const width = 260;
  const height = 70;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - 8) + 4;
    const y = height - 6 - ((value - min) / range) * (height - 12);
    return [x, y];
  });
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(' ');
  const area = `${line} L ${points[points.length - 1][0]} ${height} L ${points[0][0]} ${height} Z`;

  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={area} fill="var(--accent-soft)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      {points.map((point, index) => (
        <circle key={index} cx={point[0]} cy={point[1]} r="3" fill={index === points.length - 1 ? 'var(--accent)' : 'var(--surface)'} stroke="var(--accent)" />
      ))}
    </svg>
  );
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

function NoteTag({ note, active, onClick }) {
  return (
    <button className={`note-tag ${active ? 'active' : ''}`} type="button" onClick={() => onClick(note)}>
      {note}
    </button>
  );
}

function BeanProductCard({ product, activeNotes, isFavorite, onNoteClick, onToggleFavorite }) {
  const hasImage = Boolean(product.imageUrl);
  const isAvailable = !product.isSoldOut;
  const productLink = isRealProductUrl(product.productUrl) ? product.productUrl : '';
  const productLinkLabel = `${product.roasterName} ${product.productName} 공식 페이지 열기`;
  const metaItems = [product.roasterName].filter(Boolean);
  const displayInfo = formatProductDisplayInfo(product);
  const infoItems = [
    displayInfo.process,
    displayInfo.farm,
  ].filter(Boolean);
  const priceOptions = product.priceOptions?.length ? product.priceOptions : createPriceOptions([product]);
  const imageContent = hasImage
    ? <img src={product.imageUrl} alt="" loading="lazy" />
    : <span className="bean-image-placeholder">{product.roasterName.slice(0, 2)}</span>;

  return (
    <article className={`bean-card ${product.isSoldOut ? 'is-soldout' : ''}`}>
      <div className="bean-image">
        {productLink ? (
          <a className="bean-image-link" href={productLink} target="_blank" rel="noreferrer" aria-label={productLinkLabel}>
            {imageContent}
          </a>
        ) : (
          <div className="bean-image-link is-disabled" aria-hidden="true">{imageContent}</div>
        )}
        {product.isNew && <b>NEW</b>}
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
          {productLink ? (
            <a className="bean-title-link" href={productLink} target="_blank" rel="noreferrer">
              {displayInfo.primary}
            </a>
          ) : displayInfo.primary}
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
                aria-label={hasOptionLink ? `${product.productName} ${option.weightLabel} 상품 열기` : undefined}
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
        <div className="bean-actions">
          <span className={`stock-pill ${isAvailable ? 'available' : 'soldout'}`}>{isAvailable ? '판매 중' : '품절'}</span>
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

function ProductGrid({ activeNotes, emptyMessage = '조건에 맞는 원두가 없습니다. 검색어를 줄이거나 필터를 해제해보세요.', favoriteIds, products, onNoteClick, onToggleFavorite }) {
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
          onNoteClick={onNoteClick}
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

function TasteFinderPage({ activeNotes, favoriteIds, products, onNoteClick, onToggleFavorite }) {
  const [selectedTasteIds, setSelectedTasteIds] = React.useState(['fruity']);
  const [hideSoldOut, setHideSoldOut] = React.useState(true);
  const [budget, setBudget] = React.useState('all');

  const selectedPresets = TASTE_PRESETS.filter((preset) => selectedTasteIds.includes(preset.id));
  const matchedProducts = products.filter((product) => {
    const matchesTaste = selectedPresets.length === 0 || selectedPresets.some((preset) => preset.matches(product));
    const matchesStock = !hideSoldOut || !product.isSoldOut;
    const matchesBudget = budget === 'all'
      || (budget === 'under30000' && product.price > 0 && product.price <= 30000)
      || (budget === 'under40000' && product.price > 0 && product.price <= 40000);

    return matchesTaste && matchesStock && matchesBudget;
  });

  function toggleTaste(id) {
    setSelectedTasteIds((current) => (
      current.includes(id) ? current.filter((tasteId) => tasteId !== id) : [...current, id]
    ));
  }

  return (
    <div className="page-stack">
      <header className="page-head compact">
        <div>
          <span className="eyebrow">Taste Finder</span>
          <h1>내 취향에 가까운 원두 찾기</h1>
          <p>어려운 커피 용어 대신 좋아하는 느낌을 고르면 맞는 원두를 골라드립니다.</p>
        </div>
      </header>

      <section className="panel preference-panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">Step 1</span>
            <h2>좋아하는 맛을 골라주세요</h2>
          </div>
          <span>{matchedProducts.length}개 추천</span>
        </div>
        <div className="preference-grid">
          {TASTE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`preference-card ${selectedTasteIds.includes(preset.id) ? 'active' : ''}`}
              type="button"
              onClick={() => toggleTaste(preset.id)}
            >
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
        <div className="preference-controls">
          <label>
            <input type="checkbox" checked={hideSoldOut} onChange={(event) => setHideSoldOut(event.target.checked)} />
            품절 원두 숨기기
          </label>
          <select value={budget} onChange={(event) => setBudget(event.target.value)}>
            <option value="all">가격 전체</option>
            <option value="under30000">3만원 이하</option>
            <option value="under40000">4만원 이하</option>
          </select>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">Matches</span>
            <h2>취향 추천 원두 <em>{matchedProducts.length}개</em></h2>
          </div>
        </div>
        <ProductGrid
          activeNotes={activeNotes}
          favoriteIds={favoriteIds}
          products={matchedProducts}
          onNoteClick={onNoteClick}
          onToggleFavorite={onToggleFavorite}
        />
      </section>
    </div>
  );
}

function AlertsPage({ changes, favoriteIds, favoriteProducts, onToggleFavorite }) {
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

function AppStatusPage({ dataMode, favoriteCount, lastLoadedAt, loadState, monitorSummary, smartStoreState, onTestSmartStoreSearch }) {
  const isTestingSmartStore = smartStoreState.status === 'loading';

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
        <Stat label="데이터 모드" value={dataMode === 'live' ? '실제' : '샘플'} delta={loadState.status || 'idle'} />
        <Stat label="마지막 확인" value={formatDateTime(lastLoadedAt)} delta="local" />
        <Stat label="관심 원두" value={favoriteCount} delta="saved" />
        <Stat label="연동 로스터리" value={monitorSummary.readySourceCount} delta={`${monitorSummary.sourceCount}개 중`} />
      </div>

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
  const [screen, setScreen] = React.useState('home');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortMode, setSortMode] = React.useState('score');
  const [activeNotes, setActiveNotes] = React.useState([]);
  const [stockFilter, setStockFilter] = React.useState('all');
  const [baseProducts, setBaseProducts] = React.useState(mockBeans);
  const [dataMode, setDataMode] = React.useState('mock');
  const [loadState, setLoadState] = React.useState({ status: 'idle', message: '' });
  const [smartStoreState, setSmartStoreState] = React.useState({ status: 'idle', message: '' });
  const [lastLoadedAt, setLastLoadedAt] = React.useState(null);
  const [favoriteIds, setFavoriteIds] = React.useState(() => loadFavoriteProductIds());
  const [monitorSummary, setMonitorSummary] = React.useState(() => createMonitorSummary(mockBeans, roasterySources));
  const autoLoadStartedRef = React.useRef(false);

  const products = React.useMemo(() => normalizeProducts(baseProducts), [baseProducts]);
  const discountProducts = React.useMemo(() => filterDiscountProducts(products), [products]);
  const browsingProducts = screen === 'discounts' ? discountProducts : products;

  const navItems = React.useMemo(() => NAV.map((item) => {
    if (item.id === 'products') return { ...item, badge: products.length };
    if (item.id === 'discounts') return { ...item, badge: discountProducts.length };
    if (item.id === 'alerts') return { ...item, badge: favoriteIds.length };
    return item;
  }), [discountProducts.length, favoriteIds.length, products.length]);

  const groups = navItems.reduce((acc, item) => {
    acc[item.group] = acc[item.group] || [];
    acc[item.group].push(item);
    return acc;
  }, {});
  const current = navItems.find((item) => item.id === screen) ?? navItems[0];

  const noteOptions = React.useMemo(() => getNoteOptions(products), [products]);

  const favoriteProducts = React.useMemo(() => {
    return products.filter((product) => favoriteIds.includes(product.id));
  }, [favoriteIds, products]);

  const searchMatchedProducts = React.useMemo(() => (
    filterProductsBySearchAndNotes(browsingProducts, searchQuery, activeNotes)
  ), [activeNotes, browsingProducts, searchQuery]);

  const stockCounts = React.useMemo(() => getStockCounts(searchMatchedProducts), [searchMatchedProducts]);

  const filteredProducts = React.useMemo(() => {
    const stockMatchedProducts = searchMatchedProducts.filter((product) => {
      if (stockFilter === 'available') return !product.isSoldOut;
      if (stockFilter === 'soldout') return product.isSoldOut;
      return true;
    });

    return sortProducts(stockMatchedProducts, sortMode);
  }, [searchMatchedProducts, sortMode, stockFilter]);

  const searchProducts = React.useMemo(() => (
    sortProducts(filterProductsBySearchAndNotes(products, searchQuery, activeNotes), sortMode)
  ), [activeNotes, products, searchQuery, sortMode]);

  const dynamicStats = React.useMemo(() => {
    if (dataMode === 'mock') return dashboardStats;

    return [
      { label: '찾은 원두', value: String(products.length), delta: 'live' },
      { label: '새 상품', value: String(products.filter((bean) => bean.isNew).length), delta: '+0' },
      { label: '판매 중', value: String(products.filter((bean) => !bean.isSoldOut).length), delta: '+0' },
      { label: '품절', value: String(products.filter((bean) => bean.isSoldOut).length), delta: '+0' },
    ];
  }, [dataMode, products]);

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
    setLoadState({ status: 'loading', message: '오늘은 어떤 원두를 드실 건가요? 취향에 맞는 후보를 천천히 고르는 중입니다.' });

    try {
      if (!canLoadLiveProducts()) {
        throw new Error('실제 데이터는 Electron 데스크톱 앱에서만 불러올 수 있습니다. 일반 브라우저나 HTML 파일로 열면 네이버 검색 연결이 없으니 npm.cmd run dev로 실행해주세요.');
      }

      const officialSourceIds = getOfficialSourceIds();
      const smartStoreSourceIds = getSmartStoreSourceIds();
      const [terarosaResult, momosResult, ...sourceResults] = await Promise.all([
        window.beanpick.fetchTerarosaProducts(),
        window.beanpick.fetchMomosProducts(),
        ...officialSourceIds.map((sourceId) => window.beanpick.fetchOfficialMallProducts(sourceId)),
        ...smartStoreSourceIds.map((sourceId) => window.beanpick.fetchSmartStoreProducts(sourceId)),
      ]);
      const officialResults = sourceResults.slice(0, officialSourceIds.length);
      const smartStoreResults = sourceResults.slice(officialSourceIds.length);
      const loadedProducts = [];
      const warnings = [];
      const sourceCounts = [];
      const addLoadedProducts = (label, productsForSource) => {
        loadedProducts.push(...productsForSource);
        sourceCounts.push(`${label} ${productsForSource.length}개`);
      };

      if (terarosaResult?.ok) {
        const parsedProducts = terarosaResult.apiRows?.length
          ? normalizeTerarosaApiRows(terarosaResult.apiRows)
          : parseTerarosaHtmlProducts(terarosaResult.html || '');
        const enrichedProducts = enrichTerarosaProducts(parsedProducts, terarosaResult.detailPages || []);
        addLoadedProducts('테라로사', enrichedProducts);
        if (terarosaResult.warning) warnings.push(terarosaResult.warning);
      } else {
        warnings.push(terarosaResult?.error || '테라로사 데이터를 가져오지 못했습니다.');
      }

      if (momosResult?.ok) {
        const momosProducts = normalizeMomosPages(momosResult.pages || [{ url: momosResult.sourceUrl, html: momosResult.html || '' }]);
        addLoadedProducts('모모스커피', momosProducts);
      } else {
        warnings.push(momosResult?.error || '모모스커피 데이터를 가져오지 못했습니다.');
      }

      officialResults.forEach((result, index) => {
        const sourceId = officialSourceIds[index];
        const config = OFFICIAL_MALL_CONFIGS[sourceId];

        if (result?.ok && config) {
          const officialProducts = normalizeCafe24Pages(result.pages || [{ url: result.sourceUrl, html: result.html || '' }], config);
          addLoadedProducts(config.roasterName, officialProducts);
        } else {
          warnings.push(result?.error || `${config?.roasterName || sourceId} 데이터를 가져오지 못했습니다.`);
        }
      });

      smartStoreResults.forEach((result, index) => {
        const sourceId = smartStoreSourceIds[index];
        const label = SMARTSTORE_SOURCE_LABELS[sourceId] || sourceId;

        if (result?.ok) {
          const smartStoreProducts = result.products || [];
          addLoadedProducts(label, smartStoreProducts);
          if (result.warning) warnings.push(result.warning);
        } else {
          warnings.push(result?.error || `${label} 스마트스토어 검색 결과를 가져오지 못했습니다.`);
        }
      });

      if (loadedProducts.length === 0) {
        throw new Error(warnings.join(' / ') || '상품 데이터를 찾지 못했습니다.');
      }

      const groupedProducts = groupProductsByNameAndWeight(loadedProducts);

      setBaseProducts(groupedProducts);
      setDataMode('live');
      setActiveNotes([]);
      setStockFilter('all');
      setLastLoadedAt(new Date());
      setMonitorSummary(createMonitorSummary(groupedProducts, roasterySources));
      setLoadState({
        status: 'success',
        message: `원두 ${loadedProducts.length}개를 불러와 ${groupedProducts.length}종으로 묶었습니다. ${sourceCounts.join(' · ')}${warnings.length > 0 ? ` 일부 안내: ${warnings.join(' / ')}` : ''}`,
      });
    } catch (error) {
      setDataMode('mock');
      setBaseProducts(mockBeans);
      setStockFilter('all');
      setMonitorSummary(createMonitorSummary(mockBeans, roasterySources));
      setLoadState({
        status: 'error',
        message: `${error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'} 샘플 원두를 계속 보여드립니다.`,
      });
    }
  }

  React.useEffect(() => {
    if (autoLoadStartedRef.current || !canLoadLiveProducts()) return;
    autoLoadStartedRef.current = true;
    handleLoadProducts();
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setScreen('home')}>
          <span className="brand-mark">BeanPick</span>
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
          <span className={`status-dot ${dataMode === 'live' ? 'green' : 'amber'}`} />
          <div>
            <strong>{dataMode === 'live' ? '실제 상품 표시 중' : '샘플 상품 표시 중'}</strong>
            <p>공식몰 데이터를 불러오면 오늘 판매 중인 원두로 바뀝니다.</p>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <span>BeanPick / {current.label}</span>
          </div>
          <label className="search-box">
            <span>검색</span>
            <input
              value={searchQuery}
              placeholder="로스터리, 원두명, 노트 검색"
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
        </div>

        {screen === 'home' || screen === 'products' || screen === 'discounts' ? (
          <Dashboard
            activeNotes={activeNotes}
            favoriteIds={favoriteIds}
            loadState={loadState}
            monitorSummary={monitorSummary}
            noteOptions={noteOptions}
            onLoadProducts={handleLoadProducts}
            onNoteClick={handleNoteClick}
            onOpenProducts={() => setScreen('products')}
            onToggleFavorite={handleToggleFavorite}
            products={filteredProducts}
            searchQuery={searchQuery}
            screen={screen}
            sortMode={sortMode}
            stats={dynamicStats}
            stockCounts={stockCounts}
            stockFilter={stockFilter}
            setActiveNotes={setActiveNotes}
            setSortMode={setSortMode}
            setStockFilter={setStockFilter}
          />
        ) : screen === 'sources' ? (
          <SourcesPage monitorSummary={monitorSummary} onSaveSnapshot={handleSaveSnapshot} />
        ) : screen === 'search' ? (
          <TasteFinderPage
            activeNotes={activeNotes}
            favoriteIds={favoriteIds}
            products={searchProducts}
            onNoteClick={handleNoteClick}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : screen === 'alerts' ? (
          <AlertsPage
            changes={monitorSummary.changes}
            favoriteIds={favoriteIds}
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
            smartStoreState={smartStoreState}
            onTestSmartStoreSearch={handleTestSmartStoreSearch}
          />
        )}
      </main>
    </div>
  );
}

function Dashboard({ activeNotes, favoriteIds, loadState, monitorSummary, noteOptions, onLoadProducts, onNoteClick, onOpenProducts, onToggleFavorite, products, searchQuery, screen, sortMode, stats, stockCounts, stockFilter, setActiveNotes, setSortMode, setStockFilter }) {
  const isLoading = loadState.status === 'loading';
  const sortLabel = sortMode === 'latest' ? '최근 확인순'
    : sortMode === 'price' ? '낮은 가격순'
    : sortMode === 'unitPriceAsc' ? '100g당 낮은가격순'
    : sortMode === 'unitPriceDesc' ? '100g당 높은가격순'
    : '추천순';
  const isHome = screen === 'home';
  const isDiscounts = screen === 'discounts';
  const featuredProducts = isHome ? products.slice(0, 8) : products;
  const noteColumns = TASTE_NOTE_COLUMNS.map((column) => ({
    ...column,
    notes: noteOptions.filter((note) => getTasteNoteGroup(note) === column.id),
  }));
  const selectedNoteLabel = activeNotes.length === 0
    ? '좋아하는 맛으로 고르기'
    : activeNotes.length === 1
      ? `${activeNotes[0]} 노트만 보기`
      : `${activeNotes.length}개 노트 중 하나라도 맞는 원두`;
  const emptyMessage = isDiscounts && stockFilter === 'all'
    ? '30% 이상 할인 중인 원두가 없습니다.'
    : stockFilter === 'all'
    ? '조건에 맞는 원두가 없습니다. 검색어를 줄이거나 필터를 해제해보세요.'
    : '선택한 판매 상태에 맞는 원두가 없습니다. 다른 탭을 눌러보세요.';

  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Coffee Curation</span>
          <h1>오늘 마실 원두를 예쁘고 쉽게 골라보세요.</h1>
          <p>국내 로스터리 공식몰의 원두를 한곳에 모아 가격, 품절 여부, 테이스팅 노트를 보기 쉽게 정리합니다.</p>
          <div className="hero-actions">
            <button className="btn btn-primary" type="button" onClick={onLoadProducts} disabled={isLoading}>
              {isLoading && <LoadingSpinner compact />}
              {isLoading ? '불러오는 중' : '오늘의 원두 불러오기'}
            </button>
            <button className="btn" type="button" onClick={isHome ? onOpenProducts : () => setSortMode('price')}>
              {isHome ? `전체 ${products.length}개 보기` : '가격 낮은 순 보기'}
            </button>
          </div>
        </div>
        <div className="hero-card" aria-label="추천 원두 미리보기">
          <span>Pick of the day</span>
          <strong>{featuredProducts[0]?.productName ?? '추천 원두'}</strong>
          <p>{featuredProducts[0]?.roasterName ?? 'BeanPick'} · {featuredProducts[0]?.origin ?? '오늘의 원두'}</p>
          <div className="hero-price">{formatPrice(featuredProducts[0]?.price)}</div>
        </div>
      </section>

      {loadState.message && (
        <div className={`load-banner load-${loadState.status}`}>
          {loadState.status === 'loading' && <LoadingSpinner />}
          <strong>{loadState.status === 'success' ? '완료' : loadState.status === 'error' ? '안내' : '확인 중'}</strong>
          <p>{loadState.message}</p>
        </div>
      )}

      <div className="stats-grid">
        {stats.map((stat) => <Stat key={stat.label} {...stat} />)}
      </div>

      <section className="panel filter-panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">Taste notes</span>
            <h2>{selectedNoteLabel}</h2>
          </div>
          {activeNotes.length > 0 && <button className="btn btn-small" type="button" onClick={() => setActiveNotes([])}>필터 해제</button>}
        </div>
        <div className="taste-note-columns">
          {noteColumns.map((column) => (
            <div className="taste-note-column" key={column.id}>
              <div className="taste-note-column-head">
                <span>{column.eyebrow}</span>
                <strong>{column.label}</strong>
              </div>
              <div className="notes">
                {column.notes.map((note) => (
                  <NoteTag key={note} note={note} active={activeNotes.includes(note)} onClick={onNoteClick} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="product-layout">
        <section className="panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">{searchQuery ? 'Search results' : sortLabel}</span>
              <h2>{isHome ? '추천 원두' : isDiscounts ? '할인상품' : '전체 원두'} <em>{featuredProducts.length}개</em></h2>
              {isHome && products.length > featuredProducts.length && (
                <p className="section-help">홈에는 추천 원두 {featuredProducts.length}개만 먼저 보여드려요. 전체 {products.length}개는 전체 목록에서 볼 수 있습니다.</p>
              )}
            </div>
            <div className="sort-actions" aria-label="원두 정렬">
              <button className={sortMode === 'score' ? 'active' : ''} type="button" onClick={() => setSortMode('score')}>추천순</button>
              <button className={sortMode === 'latest' ? 'active' : ''} type="button" onClick={() => setSortMode('latest')}>최근순</button>
              <button className={sortMode === 'price' ? 'active' : ''} type="button" onClick={() => setSortMode('price')}>가격순</button>
              <button className={sortMode === 'unitPriceAsc' ? 'active' : ''} type="button" onClick={() => setSortMode('unitPriceAsc')}>100g당 낮은가격</button>
              <button className={sortMode === 'unitPriceDesc' ? 'active' : ''} type="button" onClick={() => setSortMode('unitPriceDesc')}>100g당 높은가격</button>
            </div>
          </div>

          <div className="stock-tabs" role="tablist" aria-label="판매 상태 필터">
            {STOCK_FILTERS.map((filter) => (
              <button
                key={filter.id}
                className={stockFilter === filter.id ? 'active' : ''}
                type="button"
                role="tab"
                aria-selected={stockFilter === filter.id}
                onClick={() => setStockFilter(filter.id)}
              >
                <span>{filter.label}</span>
                <em>{stockCounts[filter.id] ?? 0}</em>
              </button>
            ))}
          </div>

          <ProductGrid
            activeNotes={activeNotes}
            favoriteIds={favoriteIds}
            emptyMessage={emptyMessage}
            products={featuredProducts}
            onNoteClick={onNoteClick}
            onToggleFavorite={onToggleFavorite}
          />
        </section>

        <aside className="panel side-panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">Freshness</span>
              <h2>원두 상태</h2>
            </div>
          </div>
          <Spark data={priceTrend} />
          <div className="mini-metrics">
            <div><strong>{monitorSummary.enabledSourceCount}</strong><span>로스터리</span></div>
            <div><strong>{monitorSummary.productCount}</strong><span>원두</span></div>
            <div><strong>{monitorSummary.changes.length}</strong><span>변화</span></div>
          </div>
          <ChangeList changes={monitorSummary.changes} />
        </aside>
      </div>
    </div>
  );
}
