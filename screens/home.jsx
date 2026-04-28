/* Screen 1: Dashboard Home */

function ScreenHome({ data }) {
  const recentBeans = data.beans.slice(0, 3);
  const sparkData = [62, 58, 71, 64, 78, 73, 81, 76, 84, 79, 88, 82, 91, 87];

  return (
    <div className="fade-in">
      {/* Page header */}
      <div className="page-head">
        <div className="page-title-block">
          <div className="eyebrow">Dashboard · 2026.04.27 화요일</div>
          <h1>오늘의 <em>한 잔</em>을 찾는 중입니다.</h1>
          <p className="lede">
            네이버 쇼핑과 16개 로스터리 사이트에서 자동 수집된 신상 원두를 컵노트 OCR과 취향 모델로 평가하고,
            기준치를 넘으면 텔레그램으로 알려드립니다.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost">＋ 수동 스캔</button>
          <button className="btn btn-primary">▶ 봇 실행 중</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-4 mb-6">
        <Stat label="오늘 발견" value="47" delta="+12" deco="bean" />
        <Stat label="알림 발송" value={<>14<em>/47</em></>} delta="+4" deco="bell" />
        <Stat label="평균 취향 점수" value="81.3" delta="+2.4" deco="cup" />
        <Stat label="OCR 처리율" value={<>91<em>%</em></>} delta="+1.1" deco="ocr" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 22 }}>
        {/* Latest finds */}
        <div className="card card-pad">
          <div className="section-title">
            <div className="h">방금 들어온 <em>원두</em></div>
            <div className="meta">최근 1시간 · 점수 ≥ 80 자동 알림</div>
          </div>
          <div className="flex-col gap-4">
            {recentBeans.map(b => <RecentBeanRow key={b.id} bean={b} />)}
          </div>
          <hr className="hr" />
          <div className="flex justify-between items-center">
            <span className="eyebrow">추가 발견 · 9건</span>
            <button className="btn btn-ghost btn-sm">모두 보기 →</button>
          </div>
        </div>

        {/* Side column */}
        <div className="flex-col gap-4">
          {/* Score trend */}
          <div className="card card-pad">
            <div className="section-title">
              <div className="h">점수 <em>추이</em></div>
              <div className="meta">14일</div>
            </div>
            <Spark data={sparkData} />
            <div className="flex justify-between mt-3">
              <div>
                <div className="eyebrow">최저</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink-soft)' }}>58</div>
              </div>
              <div>
                <div className="eyebrow">평균</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink-soft)' }}>76.4</div>
              </div>
              <div>
                <div className="eyebrow">최고</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--gold)' }}>96</div>
              </div>
            </div>
          </div>

          {/* Top notes */}
          <div className="card card-pad">
            <div className="section-title">
              <div className="h">자주 매칭된 <em>노트</em></div>
            </div>
            {[
              ['Floral', 18, 92],
              ['Berry', 14, 88],
              ['Stone Fruit', 11, 84],
              ['Honey', 9, 82],
              ['Tropical', 7, 78],
            ].map(([name, count, w]) => (
              <div key={name} className="bar-row">
                <span className="lbl">{name}</span>
                <div className="track"><div className="fill" style={{ width: `${w}%` }}></div></div>
                <span className="num">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Editorial pull quote */}
      <Ornament />
      <div className="paper-surface paper-grain mt-4">
        <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'center', gap: 32 }}>
          <div>
            <div className="eyebrow">Today's Pick · 96점</div>
            <h2 className="mt-3">Panama Janson <em>Esmeralda</em><br/>Geisha Reserve</h2>
            <p className="mt-3" style={{ fontSize: 14, lineHeight: 1.6 }}>
              모모스가 들여온 게이샤. 자스민과 베르가못, 잘 익은 백도의 향이
              차처럼 가볍게 떨어진다. 컵노트 4개 중 4개가 취향 모델과 맞아 떨어졌고,
              5분 전 텔레그램으로 알림이 발송되었다.
            </p>
            <div className="flex gap-2 mt-4">
              <span className="tag plum">Jasmine</span>
              <span className="tag plum">Bergamot</span>
              <span className="tag moss">Peach</span>
              <span className="tag plum">Tea-like</span>
            </div>
          </div>
          <div className="flex justify-between items-center" style={{ gap: 24 }}>
            <CupScore score={96} size={120} />
            <div style={{ fontFamily: 'var(--serif)', textAlign: 'right' }}>
              <div style={{ fontSize: 56, fontWeight: 500, lineHeight: 1, color: '#2A1F12' }}>96</div>
              <div className="eyebrow" style={{ marginTop: 6 }}>Outstanding</div>
              <div style={{ marginTop: 14, fontFamily: 'var(--mono)', fontSize: 12, color: 'rgba(58,40,23,0.6)' }}>
                ₩64,000 · 100g<br/>모모스 커피
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, delta, deco }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      <span className="delta">▲ {delta} <span style={{ color: 'var(--ink-dim)', marginLeft: 6 }}>vs 어제</span></span>
      <svg className="deco" viewBox="0 0 80 80">
        {deco === 'bean' && (
          <ellipse cx="40" cy="40" rx="22" ry="32" fill="none" stroke="currentColor" strokeWidth="1.4" />
        )}
        {deco === 'bell' && (
          <path d="M30 30 Q40 20 50 30 L52 50 L28 50 Z M37 54 Q40 58 43 54" fill="none" stroke="currentColor" strokeWidth="1.4" />
        )}
        {deco === 'cup' && (
          <path d="M28 30 L52 30 L48 56 Q40 60 32 56 Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
        )}
        {deco === 'ocr' && (
          <g fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="22" y="22" width="36" height="36" />
            <path d="M28 32 L52 32 M28 40 L46 40 M28 48 L44 48" />
          </g>
        )}
      </svg>
    </div>
  );
}

function RecentBeanRow({ bean }) {
  return (
    <div className="flex gap-4" style={{ padding: '4px 0' }}>
      <div style={{ width: 56, height: 70, borderRadius: 8, background: bean.bagColor, position: 'relative', flexShrink: 0, overflow: 'hidden', border: '1px solid var(--line-soft)' }}>
        <div style={{ position: 'absolute', top: 0, left: 8, right: 8, height: 3, background: 'rgba(0,0,0,0.4)', borderRadius: '0 0 4px 4px' }}></div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex justify-between items-center">
          <span className="eyebrow">{bean.roastery}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>{bean.foundAt}</span>
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink-soft)', marginTop: 2 }}>{bean.name}</div>
        <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
          {bean.notes.slice(0, 4).map(n => <NoteTag key={n}>{n}</NoteTag>)}
        </div>
      </div>
      <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--ink-soft)', lineHeight: 1 }}>{bean.score}</div>
          <div className="eyebrow" style={{ marginTop: 2 }}>{bean.scoreLabel}</div>
        </div>
        <CupScore score={bean.score} size={40} />
      </div>
    </div>
  );
}

window.ScreenHome = ScreenHome;
