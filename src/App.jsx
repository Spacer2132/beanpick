import React from 'react';
import { dashboardStats, mockBeans, priceTrend } from './data/mockBeans.ts';
import { CHANNEL_LABEL, SOURCE_STATUS_LABEL, roasterySources } from './data/roasterySources.ts';
import { normalizeCafe24Pages } from './services/adapters/cafe24OfficialAdapter.ts';
import { normalizeMomosPages } from './services/adapters/momosOfficialAdapter.ts';
import { OFFICIAL_MALL_CONFIGS } from './services/adapters/officialMallConfigs.ts';
import { enrichTerarosaProducts, normalizeTerarosaApiRows, parseTerarosaHtmlProducts } from './services/adapters/terarosaOfficialAdapter.ts';
import { createMonitorSummary, saveProductSnapshot } from './services/monitoring.ts';

const NAV = [
  { id: 'home', num: 'I', label: '대시보드', group: 'OVERVIEW' },
  { id: 'products', num: 'II', label: '상품 목록', group: 'OVERVIEW', badge: mockBeans.length },
  { id: 'search', num: 'III', label: '검색 조건', group: 'PIPELINE' },
  { id: 'sources', num: 'IV', label: '로스터리 채널', group: 'PIPELINE', badge: roasterySources.length },
  { id: 'alerts', num: 'V', label: '관심 알림', group: '자동화', dot: true },
  { id: 'server', num: 'VI', label: '실행 환경', group: '자동화' },
];

const PLACEHOLDER_TEXT = {
  products: '상품 목록 화면 자리입니다. 다음 단계에서 상세 보기, 즐겨찾기, 품절 필터를 붙일 수 있습니다.',
  search: '검색 조건 화면 자리입니다. 로스터리, 가격, 원산지, 가공방식, 테이스팅 노트 조건을 저장하는 화면으로 확장할 수 있습니다.',
  alerts: '관심 알림 화면 자리입니다. 신상품, 품절 해제, 가격 변경 알림 규칙을 나중에 연결합니다.',
  server: '실행 환경 화면 자리입니다. 데이터 저장 위치와 마지막 확인 시간을 보여주는 화면으로 확장할 수 있습니다.',
};

function formatPrice(value) {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function Spark({ data, color = '#D4A574' }) {
  const width = 240;
  const height = 56;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - 4) + 2;
    const y = height - 4 - ((value - min) / range) * (height - 8);
    return [x, y];
  });
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(' ');
  const area = `${line} L ${points[points.length - 1][0]} ${height} L ${points[0][0]} ${height} Z`;

  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={area} fill={color} opacity="0.12" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" />
      {points.map((point, index) => (
        <circle key={index} cx={point[0]} cy={point[1]} r="2.4" fill={index === points.length - 1 ? color : 'var(--line)'} />
      ))}
    </svg>
  );
}

function CupScore({ score }) {
  const fill = Math.max(0, Math.min(100, score));

  return (
    <div className="cup-score simple-cup" aria-label={`큐레이션 점수 ${score}점`}>
      <div className="cup-body">
        <div className="cup-fill" style={{ height: `${fill}%` }} />
        <span>{score}</span>
      </div>
      <div className="cup-label">score</div>
    </div>
  );
}

function Stat({ label, value, delta }) {
  const isDown = String(delta).startsWith('-');

  return (
    <div className="stat card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className={`delta ${isDown ? 'down' : ''}`}>{isDown ? '감소' : '상승'} {delta}</div>
      <div className="deco" />
    </div>
  );
}

function NoteTag({ note, active, onClick }) {
  return (
    <button
      className={`note-tag ${active ? 'active' : ''}`}
      type="button"
      onClick={() => onClick(note)}
    >
      {note}
    </button>
  );
}

function BeanProductCard({ product, activeNote, onNoteClick }) {
  const hasPrice = product.price > 0;
  const pricePer100g = hasPrice ? Math.round((product.price / product.weight) * 100) : 0;
  const availabilityClass = product.isSoldOut ? 'status-soldout' : 'status-available';
  const availabilityLabel = product.isSoldOut ? '품절' : '판매 중';
  const hasImage = Boolean(product.imageUrl);
  const hasRealProductUrl = product.productUrl && !product.productUrl.includes('beanpick.local');

  return (
    <article className={`bean-list-card ${product.isSoldOut ? 'is-soldout' : ''}`}>
      <div className="bean-list-head">
        <div className={`product-bag ${hasImage ? 'has-image' : ''}`} aria-hidden="true">
          {hasImage ? (
            <img src={product.imageUrl} alt="" loading="lazy" />
          ) : (
            <span>{product.roasterName.slice(0, 2)}</span>
          )}
        </div>
        <div className="bean-list-title">
          <div className="listing-meta">
            <span>{product.roasterName}</span>
            <span>·</span>
            <span>{product.origin}</span>
            <span>·</span>
            <span>{product.lastCheckedAt}</span>
          </div>
          <h3>{product.productName}</h3>
          <p>{product.process} · {product.roastLevel} · {product.weight}g</p>
        </div>
        <div className="product-status-stack">
          {product.isNew && <span className="status-chip status-new">신상품</span>}
          <span className={`status-chip ${availabilityClass}`}>{availabilityLabel}</span>
        </div>
      </div>

      <div className="product-body">
        <CupScore score={product.score} />
        <div>
          <div className="notes">
            {product.tastingNotes.map((note) => (
              <NoteTag key={note} note={note} active={activeNote === note} onClick={onNoteClick} />
            ))}
          </div>
          <div className="product-source">공개 상품 페이지 · mock 또는 수동 연동 데이터</div>
        </div>
      </div>

      <div className="bean-list-foot">
        <div>
          <div className="price">{hasPrice ? `${formatPrice(product.price)}원` : '가격 확인 필요'}</div>
          <div className="ppg">{hasPrice ? `100g당 ${formatPrice(pricePer100g)}원 · ` : ''}마지막 확인 {product.lastCheckedAt}</div>
        </div>
        {hasRealProductUrl ? (
          <a className="btn btn-ghost btn-sm" href={product.productUrl} target="_blank" rel="noreferrer">상품 보기</a>
        ) : (
          <button className="btn btn-ghost btn-sm" type="button">상품 보기</button>
        )}
      </div>
    </article>
  );
}

function Placeholder({ title, screen }) {
  return (
    <div className="fade-in">
      <div className="card card-pad empty-panel">
        <div className="section-title">
          <div className="h">{title}</div>
          <div className="meta">화면 전환 느낌 확인용</div>
        </div>
        <p>{PLACEHOLDER_TEXT[screen] ?? '다음 단계에서 실제 기능을 붙일 예정입니다.'}</p>
      </div>
    </div>
  );
}

function ChangeList({ changes }) {
  if (changes.length === 0) {
    return <div className="empty-result compact">저장된 기준과 비교했을 때 변경 사항이 없습니다.</div>;
  }

  return (
    <div className="change-list">
      {changes.slice(0, 5).map((change) => (
        <div className={`change-item change-${change.type}`} key={`${change.type}-${change.id}`}>
          <span>{change.label}</span>
          <p>{change.detail}</p>
        </div>
      ))}
    </div>
  );
}

function SourcesPage({ monitorSummary, onSaveSnapshot }) {
  return (
    <div className="fade-in">
      <div className="page-head">
        <div className="page-title-block">
          <div className="eyebrow">Source Registry · 연동 준비 단계</div>
          <h1>로스터리 채널을 <em>연동 가능한 목록</em>으로 정리합니다.</h1>
          <p className="lede">
            아직 모든 사이트를 자동으로 읽지는 않습니다. 어떤 채널을 어떤 방식으로 읽을지 먼저 정리하고,
            공식몰과 스마트스토어 공개 상품 페이지부터 하나씩 연결합니다.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" type="button" onClick={onSaveSnapshot}>현재 기준 저장</button>
        </div>
      </div>

      <div className="grid grid-4 mb-6">
        <Stat label="등록 채널" value={monitorSummary.sourceCount} delta="+6" />
        <Stat label="활성 채널" value={monitorSummary.enabledSourceCount} delta="+5" />
        <Stat label="연동 가능" value={monitorSummary.readySourceCount} delta="+3" />
        <Stat label="감지 변경" value={monitorSummary.changes.length} delta="+4" />
      </div>

      <div className="dashboard-grid">
        <section className="card card-pad">
          <div className="section-title">
            <div className="h">로스터리 <em>소스 목록</em></div>
            <div className="meta">실제 접속 전 등록 후보</div>
          </div>
          <div className="source-list">
            {roasterySources.map((source) => (
              <article className={`source-card ${source.enabled ? '' : 'is-disabled'}`} key={source.id}>
                <div>
                  <div className="source-title">{source.roasterName}</div>
                  <div className="source-url">{source.sourceUrl}</div>
                </div>
                <div className="source-badges">
                  <span className="status-chip status-new">{CHANNEL_LABEL[source.channelType]}</span>
                  <span className={`status-chip ${source.status === 'ready' ? 'status-available' : source.status === 'paused' ? 'status-soldout' : ''}`}>
                    {SOURCE_STATUS_LABEL[source.status]}
                  </span>
                </div>
                <div className="source-meta">
                  <span>{source.adapterKey}</span>
                  <span>{source.productCount}개 상품</span>
                  <span>{source.lastCheckedAt}</span>
                </div>
                <p>{source.memo}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="card card-pad">
          <div className="section-title">
            <div className="h">변경 감지 mock</div>
            <div className="meta">{monitorSummary.hasSavedBaseline ? '저장 기준 비교' : '샘플 기준 비교'}</div>
          </div>
          <ChangeList changes={monitorSummary.changes} />
          <hr className="hr" />
          <div className="watch-list">
            <div><span className="dot green" />현재는 mock 데이터끼리만 비교합니다.</div>
            <div><span className="dot amber" />가격, 품절, 재입고, 신상품 변경을 감지합니다.</div>
            <div><span className="dot red" />외부 사이트 자동 주기 실행은 아직 연결하지 않았습니다.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = React.useState('home');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortMode, setSortMode] = React.useState('score');
  const [activeNote, setActiveNote] = React.useState('');
  const [products, setProducts] = React.useState(mockBeans);
  const [dataMode, setDataMode] = React.useState('mock');
  const [loadState, setLoadState] = React.useState({ status: 'idle', message: '' });
  const [monitorSummary, setMonitorSummary] = React.useState(() => createMonitorSummary(mockBeans, roasterySources));

  const navItems = React.useMemo(() => NAV.map((item) => (
    item.id === 'products' ? { ...item, badge: products.length } : item
  )), [products.length]);

  const groups = navItems.reduce((acc, item) => {
    acc[item.group] = acc[item.group] || [];
    acc[item.group].push(item);
    return acc;
  }, {});
  const current = navItems.find((item) => item.id === screen) ?? navItems[0];

  const noteOptions = React.useMemo(() => {
    return [...new Set(products.flatMap((product) => product.tastingNotes))].sort();
  }, [products]);

  const filteredProducts = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return products
      .filter((product) => {
        const searchable = [
          product.roasterName,
          product.productName,
          product.origin,
          product.process,
          product.roastLevel,
          ...product.tastingNotes,
        ].join(' ').toLowerCase();

        const matchesSearch = query.length === 0 || searchable.includes(query);
        const matchesNote = activeNote.length === 0 || product.tastingNotes.includes(activeNote);
        return matchesSearch && matchesNote;
      })
      .sort((a, b) => {
        if (sortMode === 'latest') return a.checkedMinutesAgo - b.checkedMinutesAgo;
        if (sortMode === 'price') return (a.price || Number.POSITIVE_INFINITY) - (b.price || Number.POSITIVE_INFINITY);
        return b.score - a.score;
      });
  }, [activeNote, products, searchQuery, sortMode]);

  const dynamicStats = React.useMemo(() => {
    if (dataMode === 'mock') return dashboardStats;

    return [
      { label: '모니터링 상품', value: String(products.length), delta: 'live' },
      { label: '신상품', value: String(products.filter((bean) => bean.isNew).length), delta: '+0' },
      { label: '판매 중', value: String(products.filter((bean) => !bean.isSoldOut).length), delta: '+0' },
      { label: '품절', value: String(products.filter((bean) => bean.isSoldOut).length), delta: '+0' },
    ];
  }, [dataMode, products]);

  function handleNoteClick(note) {
    setActiveNote((currentNote) => (currentNote === note ? '' : note));
  }

  function handleSaveSnapshot() {
    saveProductSnapshot(products);
    setMonitorSummary(createMonitorSummary(products, roasterySources));
  }

  async function handleLoadTerarosaProducts() {
    const officialSourceIds = ['namusairo', 'coffeelibre', 'lowkey', 'werk'];
    setLoadState({ status: 'loading', message: '테라로사, 모모스커피와 추가 공식몰 상품을 확인하는 중입니다.' });

    try {
      if (!window.beanpick?.fetchTerarosaProducts || !window.beanpick?.fetchMomosProducts || !window.beanpick?.fetchOfficialMallProducts) {
        throw new Error('실제 데이터 불러오기는 Electron 실행 환경에서만 사용할 수 있습니다. npm.cmd run dev로 실행해주세요.');
      }

      const [terarosaResult, momosResult, ...officialResults] = await Promise.all([
        window.beanpick.fetchTerarosaProducts(),
        window.beanpick.fetchMomosProducts(),
        ...officialSourceIds.map((sourceId) => window.beanpick.fetchOfficialMallProducts(sourceId)),
      ]);
      const loadedProducts = [];
      const warnings = [];

      if (terarosaResult?.ok) {
        const parsedProducts = terarosaResult.apiRows?.length
          ? normalizeTerarosaApiRows(terarosaResult.apiRows)
          : parseTerarosaHtmlProducts(terarosaResult.html || '');
        loadedProducts.push(...enrichTerarosaProducts(parsedProducts, terarosaResult.detailPages || []));
      } else {
        warnings.push(terarosaResult?.error || '테라로사 데이터를 가져오지 못했습니다.');
      }

      if (momosResult?.ok) {
        loadedProducts.push(...normalizeMomosPages(momosResult.pages || [{ url: momosResult.sourceUrl, html: momosResult.html || '' }]));
      } else {
        warnings.push(momosResult?.error || '모모스커피 데이터를 가져오지 못했습니다.');
      }

      officialResults.forEach((result, index) => {
        const sourceId = officialSourceIds[index];
        const config = OFFICIAL_MALL_CONFIGS[sourceId];

        if (result?.ok && config) {
          loadedProducts.push(...normalizeCafe24Pages(result.pages || [{ url: result.sourceUrl, html: result.html || '' }], config));
        } else {
          warnings.push(result?.error || `${config?.roasterName || sourceId} 데이터를 가져오지 못했습니다.`);
        }
      });

      if (loadedProducts.length === 0) {
        throw new Error(warnings.join(' / ') || '상품 데이터를 찾지 못했습니다.');
      }

      setProducts(loadedProducts);
      setDataMode('live');
      setActiveNote('');
      setMonitorSummary(createMonitorSummary(loadedProducts, roasterySources));
      setLoadState({
        status: 'success',
        message: `공식몰 상품 ${loadedProducts.length}개를 불러왔습니다.${warnings.length > 0 ? ` 일부 안내: ${warnings.join(' / ')}` : ''}`,
      });
    } catch (error) {
      setDataMode('mock');
      setProducts(mockBeans);
      setMonitorSummary(createMonitorSummary(mockBeans, roasterySources));
      setLoadState({
        status: 'error',
        message: `${error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'} mock 데이터를 유지합니다.`,
      });
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">
            <span className="ko">원두픽</span>
            <span className="en">BeanPick</span>
          </div>
          <span className="brand-tag">Roastery Bean · Dashboard</span>
        </div>

        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="nav-section">
            <div className="label">{group}</div>
            {items.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${screen === item.id ? 'active' : ''}`}
                type="button"
                onClick={() => setScreen(item.id)}
              >
                <span className="num">{item.num}</span>
                <span>{item.label}</span>
                {item.badge != null && <span className="count">{item.badge}</span>}
                {item.dot && <span className="badge-dot" />}
              </button>
            ))}
          </div>
        ))}

        <div className="sidebar-foot">
          <div className="health-pill"><span className="dot green pulse" /><span>mock 데이터 실행 중</span></div>
          <div className="health-pill"><span className="dot amber" /><span>일부 몰 연동 준비 단계</span></div>
          <div className="profile-row">
            <div className="avatar">B</div>
            <div>
              <div className="profile-name">BeanPick 관리자</div>
              <div className="profile-mail">local@beanpick.app</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="crumbs">
            <span>BeanPick</span>
            <span className="sep">/</span>
            <span>로스터리 원두</span>
            <span className="sep">/</span>
            <span className="here">{current.label}</span>
          </div>
          <div className="flex items-center gap-3 topbar-tools">
            <div className="search-box">
              <span>검색</span>
              <input
                value={searchQuery}
                placeholder="로스터리, 상품명, 노트 검색..."
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <span className="kbd">⌘K</span>
            </div>
            <span className="status"><span className={`dot ${dataMode === 'live' ? 'green' : 'amber'} pulse`} />{dataMode === 'live' ? 'live' : 'mock'}</span>
          </div>
        </div>

        {screen === 'home' ? (
          <Dashboard
            activeNote={activeNote}
            monitorSummary={monitorSummary}
            noteOptions={noteOptions}
            loadState={loadState}
            onLoadTerarosaProducts={handleLoadTerarosaProducts}
            onNoteClick={handleNoteClick}
            products={filteredProducts}
            searchQuery={searchQuery}
            sortMode={sortMode}
            stats={dynamicStats}
            setActiveNote={setActiveNote}
            setSortMode={setSortMode}
          />
        ) : screen === 'sources' ? (
          <SourcesPage monitorSummary={monitorSummary} onSaveSnapshot={handleSaveSnapshot} />
        ) : (
          <Placeholder title={current.label} screen={screen} />
        )}
      </main>
    </div>
  );
}

function Dashboard({ activeNote, loadState, monitorSummary, noteOptions, onLoadTerarosaProducts, onNoteClick, products, searchQuery, sortMode, stats, setActiveNote, setSortMode }) {
  const sortLabel = sortMode === 'latest' ? '최신순 정렬' : sortMode === 'price' ? '가격 낮은 순 정렬' : '점수순 정렬';
  const isLoading = loadState.status === 'loading';

  return (
    <div className="fade-in">
      <div className="page-head">
        <div className="page-title-block">
          <div className="eyebrow">Dashboard · 공식 로스터리 상품 모니터링</div>
          <h1>국내 로스터리의 <em>오늘의 원두</em>를 모아봅니다.</h1>
          <p className="lede">
            스마트스토어와 자사몰의 공개 상품 페이지를 기준으로 상품명, 가격, 품절 여부,
            원산지, 가공방식, 테이스팅 노트를 한 화면에서 확인하는 대시보드입니다.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" type="button" onClick={onLoadTerarosaProducts} disabled={isLoading}>
            {isLoading ? '불러오는 중' : '실제 데이터 불러오기'}
          </button>
          <div className="sort-actions" aria-label="상품 정렬">
            <button className={`btn ${sortMode === 'score' ? 'btn-primary' : 'btn-ghost'}`} type="button" onClick={() => setSortMode('score')}>
              점수순
            </button>
            <button className={`btn ${sortMode === 'latest' ? 'btn-primary' : 'btn-ghost'}`} type="button" onClick={() => setSortMode('latest')}>
              최신순
            </button>
            <button className={`btn ${sortMode === 'price' ? 'btn-primary' : 'btn-ghost'}`} type="button" onClick={() => setSortMode('price')}>
              가격순
            </button>
          </div>
        </div>
      </div>

      {loadState.message && (
        <div className={`load-banner load-${loadState.status} mb-6`}>
          <span>{loadState.status === 'success' ? '연동 성공' : loadState.status === 'error' ? '연동 안내' : '확인 중'}</span>
          <p>{loadState.message}</p>
        </div>
      )}

      <div className="grid grid-4 mb-6">
        {stats.map((stat) => <Stat key={stat.label} {...stat} />)}
      </div>

      <div className="filter-panel card card-pad mb-6">
        <div className="filter-head">
          <div>
            <div className="eyebrow">Tasting Note Filter</div>
            <strong>{activeNote ? `${activeNote} 노트만 보기` : '테이스팅 노트를 눌러 필터링'}</strong>
          </div>
          {activeNote && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setActiveNote('')}>
              필터 해제
            </button>
          )}
        </div>
        <div className="notes">
          {noteOptions.map((note) => (
            <NoteTag key={note} note={note} active={activeNote === note} onClick={onNoteClick} />
          ))}
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card card-pad">
          <div className="section-title">
            <div className="h">원두 상품 <em>{products.length}개</em></div>
            <div className="meta">
              {searchQuery ? `"${searchQuery}" 검색 결과` : sortLabel}
            </div>
          </div>

          {products.length > 0 ? (
            <div className="bean-card-list">
              {products.map((product) => (
                <BeanProductCard key={product.id} product={product} activeNote={activeNote} onNoteClick={onNoteClick} />
              ))}
            </div>
          ) : (
            <div className="empty-result">
              조건에 맞는 원두 상품이 없습니다. 검색어를 줄이거나 노트 필터를 해제해보세요.
            </div>
          )}
        </section>

        <aside className="card card-pad">
          <div className="section-title">
            <div className="h">연동 준비 상태</div>
            <div className="meta">mock 지표</div>
          </div>
          <Spark data={priceTrend} />
          <hr className="hr" />
          <div className="mini-metrics">
            <div><strong>{monitorSummary.enabledSourceCount}</strong><span>활성 채널</span></div>
            <div><strong>{monitorSummary.productCount}</strong><span>mock 상품</span></div>
            <div><strong>{monitorSummary.changes.length}</strong><span>감지 변경</span></div>
          </div>
          <hr className="hr" />
          <ChangeList changes={monitorSummary.changes} />
        </aside>
      </div>
    </div>
  );
}
