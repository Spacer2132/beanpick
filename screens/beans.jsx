/* Screen 2: Bean Candidates list */

function ScreenBeans({ data }) {
  const [view, setView] = React.useState('grid'); // grid | table
  const [sort, setSort] = React.useState('score');
  const beans = [...data.beans].sort((a, b) => {
    if (sort === 'score') return b.score - a.score;
    if (sort === 'recent') return 0;
    if (sort === 'price') return a.ppg - b.ppg;
    return 0;
  });

  return (
    <div className="fade-in">
      <div className="page-head">
        <div className="page-title-block">
          <div className="eyebrow">Beans · {beans.length}건의 후보</div>
          <h1>지난 24시간 동안 발견한 <em>원두</em>들</h1>
          <p className="lede">취향 점수, OCR 결과, 알림 상태가 함께 표시됩니다. 카드를 누르면 상세 페이지로 이동합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost">필터 ▾</button>
          <button className="btn btn-ghost">내보내기</button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card card-pad mb-6" style={{ padding: '14px 22px' }}>
        <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
          <div className="flex gap-2">
            <Chip active>전체 <span className="kpi" style={{ marginLeft: 6, padding: '0 6px' }}>9</span></Chip>
            <Chip>알림 발송 <span className="kpi" style={{ marginLeft: 6, padding: '0 6px' }}>5</span></Chip>
            <Chip>대기/큐 <span className="kpi" style={{ marginLeft: 6, padding: '0 6px' }}>2</span></Chip>
            <Chip>OCR 실패 <span className="kpi" style={{ marginLeft: 6, padding: '0 6px' }}>1</span></Chip>
          </div>
          <div style={{ width: 1, background: 'var(--line-soft)', alignSelf: 'stretch' }}></div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">정렬</span>
            <SortPill active={sort==='score'}  onClick={()=>setSort('score')}>점수순</SortPill>
            <SortPill active={sort==='recent'} onClick={()=>setSort('recent')}>최신순</SortPill>
            <SortPill active={sort==='price'}  onClick={()=>setSort('price')}>가격↑</SortPill>
          </div>
          <div style={{ marginLeft: 'auto' }} className="flex items-center gap-2">
            <span className="eyebrow">보기</span>
            <ViewToggle v={view} onChange={setView} />
          </div>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-bean">
          {beans.map(b => <BeanCard key={b.id} bean={b} />)}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>상품 / 로스터리</th>
                <th>가격</th>
                <th>원산지 · 가공</th>
                <th>컵노트</th>
                <th>점수</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {beans.map(b => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--ink-soft)' }}>{b.name}</div>
                    <div className="eyebrow" style={{ marginTop: 4 }}>{b.roastery}</div>
                  </td>
                  <td>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>₩{b.price.toLocaleString()}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>₩{b.ppg.toLocaleString()}/100g</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12.5 }}>{b.origin}</div>
                    <div className="eyebrow" style={{ marginTop: 3 }}>{b.process} · {b.roast}</div>
                  </td>
                  <td>
                    <div className="flex gap-2" style={{ flexWrap: 'wrap', maxWidth: 240 }}>
                      {b.notes.slice(0,3).map(n => <NoteTag key={n}>{n}</NoteTag>)}
                      {b.notes.length > 3 && <span className="eyebrow">+{b.notes.length-3}</span>}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <CupScore score={b.score} size={32} />
                      <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink-soft)' }}>{b.score}</div>
                    </div>
                  </td>
                  <td>
                    <div className="flex-col gap-2">
                      <MiniStatus kind="ocr" value={b.ocr} />
                      <MiniStatus kind="notify" value={b.notify} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Chip({ children, active }) {
  return (
    <button className="btn btn-sm" style={{
      borderColor: active ? 'var(--gold)' : 'var(--line-soft)',
      background: active ? 'rgba(212,165,116,0.08)' : 'transparent',
      color: active ? 'var(--ink-soft)' : 'var(--ink-mute)',
    }}>{children}</button>
  );
}
function SortPill({ children, active, onClick }) {
  return (
    <button onClick={onClick} className="btn btn-sm" style={{
      borderColor: active ? 'var(--gold)' : 'var(--line-soft)',
      background: active ? 'rgba(212,165,116,0.10)' : 'transparent',
      color: active ? 'var(--gold)' : 'var(--ink-mute)',
    }}>{children}</button>
  );
}
function ViewToggle({ v, onChange }) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--line-soft)', borderRadius: 999, overflow: 'hidden' }}>
      {['grid','table'].map(k => (
        <button key={k} onClick={()=>onChange(k)} style={{
          padding: '6px 14px',
          fontSize: 12,
          background: v===k ? 'var(--bg-card-hi)' : 'transparent',
          color: v===k ? 'var(--ink-soft)' : 'var(--ink-faint)',
          border: 'none', cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
          {k === 'grid' ? '카드' : '표'}
        </button>
      ))}
    </div>
  );
}

window.ScreenBeans = ScreenBeans;
