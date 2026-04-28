/* App shell — sidebar + screen router + tweaks */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentColor": "#D4A574",
  "density": "comfortable",
  "showOrnaments": true,
  "useSerifBody": false
}/*EDITMODE-END*/;

const NAV = [
  { id: 'home',       num: 'I',   label: '대시보드 홈',       group: 'OVERVIEW' },
  { id: 'beans',      num: 'II',  label: '원두 후보',         group: 'OVERVIEW',  badge: 9 },
  { id: 'search',     num: 'III', label: '검색 조건',         group: 'PIPELINE' },
  { id: 'roasteries', num: 'IV',  label: '타겟 로스터리',     group: 'PIPELINE',  badge: 24 },
  { id: 'telegram',   num: 'V',   label: '텔레그램 알림',     group: '개발자 환경',    dot: true },
  { id: 'server',     num: 'VI',  label: '서버 / 환경',       group: '개발자 환경' },
  { id: 'ocr',        num: 'VII', label: 'OCR 분석 결과',     group: '기타' },
];

function App() {
  const [screen, setScreen] = React.useState('home');
  const data = window.BeanPickData;

  const groups = NAV.reduce((acc, n) => {
    (acc[n.group] = acc[n.group] || []).push(n);
    return acc;
  }, {});

  const screens = {
    home: <ScreenHome data={data} />,
    beans: <ScreenBeans data={data} />,
    ocr: <ScreenOCR data={data} />,
    search: <ScreenSearch data={data} />,
    roasteries: <ScreenRoasteries data={data} />,
    telegram: <ScreenTelegram data={data} />,
    server: <ScreenServer />,
  };

  const labels = {
    home: '대시보드', beans: '원두 후보', ocr: 'OCR 결과',
    search: '검색 조건', roasteries: '로스터리', telegram: '알림 로그', server: '서버 / 환경',
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">
            <span className="ko">원두픽</span>
            <span className="en">BeanPick</span>
          </div>
          <span className="brand-tag">Specialty Coffee Bot · Admin</span>
        </div>

        {Object.entries(groups).map(([g, items]) => (
          <div key={g} className="nav-section">
            <div className="label">{g}</div>
            {items.map(n => (
              <div key={n.id}
                className={`nav-item ${screen === n.id ? 'active' : ''}`}
                data-screen-label={`${n.num} ${n.label}`}
                onClick={() => setScreen(n.id)}>
                <span className="num">{n.num}</span>
                <span>{n.label}</span>
                {n.badge != null && <span className="count">{n.badge}</span>}
                {n.dot && <span className="badge-dot"></span>}
              </div>
            ))}
          </div>
        ))}

        <div className="sidebar-foot">
          <div className="health-pill"><span className="dot green pulse"></span><span>봇 정상 · 14d 6h</span></div>
          <div className="health-pill"><span className="dot amber"></span><span>OCR 큐 7건 처리 중</span></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
            <div className="avatar">현</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>김현우</div>
              <div style={{ fontSize: 10, color: 'var(--ink-faint)', fontFamily: 'var(--mono)' }}>admin@beanpick.kr</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main" data-screen-label={labels[screen]}>
        <div className="topbar">
          <div className="crumbs">
            <span>BeanPick</span>
            <span className="sep">/</span>
            <span>Admin</span>
            <span className="sep">/</span>
            <span className="here">{labels[screen]}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="search-box">
              <span style={{ color: 'var(--ink-faint)' }}>⌕</span>
              <input placeholder="원두, 로스터리, 노트 검색…" />
              <span className="kbd">⌘K</span>
            </div>
            <span className="status"><span className="dot green pulse"></span>실시간</span>
          </div>
        </div>
        {screens[screen]}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
