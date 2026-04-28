/* Screen 5: Target Roasteries */

function ScreenRoasteries({ data }) {
  return (
    <div className="fade-in">
      <div className="page-head">
        <div className="page-title-block">
          <div className="eyebrow">Roasteries · {data.roasteries.length}곳 등록</div>
          <h1>스캔 중인 <em>로스터리</em>들</h1>
          <p className="lede">각 로스터리의 신상품 페이지를 일정 주기로 폴링합니다. 셀렉터 깨짐, 신뢰도 저하, 차단 등은 즉시 표시됩니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost">CSV 가져오기</button>
          <button className="btn btn-primary">＋ 로스터리 추가</button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-4 mb-6">
        <SmallStat label="활성" value={data.roasteries.filter(r=>r.enabled).length} sub={`/ ${data.roasteries.length}곳`} />
        <SmallStat label="스마트스토어" value={data.roasteries.filter(r=>r.channel && r.channel.includes('스마트스토어')).length} sub="네이버 쇼핑 연동" />
        <SmallStat label="누적 발견" value="1,832" sub="지난 30일" />
        <SmallStat label="평균 응답" value="1.4s" sub="HEAD 기준" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
        {data.roasteries.map(r => (
          <div key={r.id} className="roastery-card" style={{ opacity: r.enabled ? 1 : 0.55 }}>
            <div className="flex items-center gap-3">
              <div className="logo">{r.short}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="nm">{r.name}</div>
                <div className="url">{r.url}</div>
              </div>
              <div className={`toggle ${r.enabled ? 'on' : ''}`}></div>
            </div>

            <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
              <span className="kpi">📍 {r.city}</span>
              <span className="kpi">⏱ {r.scanFreq}</span>
              {r.channel && r.channel.includes('스마트스토어') && (
                <span className="tag moss" style={{ fontSize: 10 }}>스마트스토어</span>
              )}
              {r.channel === '자사몰' && (
                <span className="tag cream" style={{ fontSize: 10 }}>자사몰</span>
              )}
            </div>

            <hr style={{ border: 'none', borderTop: '1px dashed var(--line-soft)', margin: 0 }} />

            <div className="grid grid-3 gap-3">
              <Mini k="마지막 스캔" v={r.lastScan} />
              <Mini k="누적 발견" v={r.found.toString()} />
              <Mini k="OCR" v={r.ocr ? `${r.ocr}%` : '—'} accent={r.ocr >= 90 ? 'gold' : r.ocr >= 80 ? '' : 'low'} />
            </div>

            <div className="flex items-center gap-2">
              <span className="status">
                <span className={`dot ${r.enabled ? (r.ocr >= 85 ? 'green' : 'amber') : 'red'} pulse`}></span>
                {r.enabled ? (r.ocr >= 85 ? '정상' : '셀렉터 점검 권장') : '일시중지'}
              </span>
              <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }}>설정</button>
            </div>
          </div>
        ))}

        {/* Add card */}
        <div className="roastery-card" style={{ borderStyle: 'dashed', borderColor: 'var(--line-soft)', justifyContent: 'center', alignItems: 'center', minHeight: 240, cursor: 'pointer' }}>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 26, color: 'var(--gold)' }}>＋</div>
          <div className="eyebrow">새 로스터리 추가</div>
          <div style={{ color: 'var(--ink-faint)', fontSize: 11, textAlign: 'center', marginTop: 4 }}>URL · 셀렉터 · 스캔 주기</div>
        </div>
      </div>
    </div>
  );
}

function SmallStat({ label, value, sub }) {
  return (
    <div className="card card-pad" style={{ padding: '18px 22px' }}>
      <div className="eyebrow">{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 26, color: 'var(--ink-soft)', fontWeight: 500, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}
function Mini({ k, v, accent }) {
  return (
    <div>
      <div className="eyebrow" style={{ fontSize: 9 }}>{k}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 14, color: accent === 'gold' ? 'var(--gold)' : accent === 'low' ? 'var(--berry)' : 'var(--ink-soft)', marginTop: 2 }}>{v}</div>
    </div>
  );
}

window.ScreenRoasteries = ScreenRoasteries;
