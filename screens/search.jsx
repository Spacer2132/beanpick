/* Screen 4: Search filter settings */

function ScreenSearch({ data }) {
  const [scoreMin, setScoreMin] = React.useState(75);
  const [priceMax, setPriceMax] = React.useState(40000);
  const [ppgMax, setPpgMax]   = React.useState(20000);

  return (
    <div className="fade-in">
      <div className="page-head">
        <div className="page-title-block">
          <div className="eyebrow">Search · 취향 프로파일</div>
          <h1>어떤 원두를 <em>찾고</em> 있나요?</h1>
          <p className="lede">키워드, 가격, 컵노트 가중치를 조정하면 다음 스캔부터 즉시 반영됩니다. 마지막 저장: 2시간 전.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost">초기화</button>
          <button className="btn btn-primary">변경 저장</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 22 }}>
        <div className="flex-col gap-4">
          {/* Keywords */}
          <div className="card card-pad-lg">
            <div className="section-title">
              <div className="h">검색 <em>키워드</em></div>
              <span className="meta">네이버 쇼핑 + 로스터리 사이트</span>
            </div>
            <div className="grid grid-2 gap-4">
              <div className="field">
                <label>포함 키워드</label>
                <div className="input" style={{ minHeight: 64, display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start' }}>
                  {['스페셜티','싱글오리진','내추럴','워시드','게이샤','파나마','에티오피아'].map(k => (
                    <span key={k} className="tag cream">{k} <span style={{ marginLeft: 4, color: 'var(--ink-faint)' }}>×</span></span>
                  ))}
                  <span style={{ color: 'var(--ink-dim)', alignSelf: 'center' }}>＋</span>
                </div>
              </div>
              <div className="field">
                <label>제외 키워드</label>
                <div className="input" style={{ minHeight: 64, display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start' }}>
                  {['디카페인','블렌드','콜드브루 RTD','드립백'].map(k => (
                    <span key={k} className="tag berry">{k} <span style={{ marginLeft: 4, opacity: 0.6 }}>×</span></span>
                  ))}
                  <span style={{ color: 'var(--ink-dim)', alignSelf: 'center' }}>＋</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cup notes preference */}
          <div className="card card-pad-lg">
            <div className="section-title">
              <div className="h">컵노트 <em>가중치</em></div>
              <span className="meta">+5 ~ −5 · 내 취향 모델</span>
            </div>
            <div className="grid grid-2 gap-4">
              {[
                ['Floral / Jasmine', 5, 'plum'],
                ['Berry', 5, 'berry'],
                ['Stone Fruit', 4, 'moss'],
                ['Citrus / Bergamot', 4, 'moss'],
                ['Honey / Caramel', 3, ''],
                ['Tropical / Lychee', 3, 'moss'],
                ['Cocoa / Chocolate', 1, ''],
                ['Nutty', 0, ''],
                ['Earthy / Tobacco', -2, 'berry'],
                ['Smoky / Burnt', -4, 'berry'],
              ].map(([n, w, c]) => <NoteWeight key={n} name={n} weight={w} cls={c} />)}
            </div>
          </div>

          {/* Origins */}
          <div className="card card-pad-lg">
            <div className="section-title">
              <div className="h">선호 <em>원산지</em></div>
            </div>
            <div className="flex" style={{ flexWrap: 'wrap', gap: 8 }}>
              {[
                ['Ethiopia', true], ['Kenya', true], ['Panama', true], ['Colombia', true],
                ['Costa Rica', true], ['Burundi', true], ['Yemen', true], ['Indonesia', false],
                ['Brazil', false], ['Vietnam', false], ['Honduras', false], ['Peru', false],
              ].map(([n, on]) => (
                <span key={n} className="tag" style={{
                  background: on ? 'rgba(212,165,116,0.10)' : 'transparent',
                  color: on ? 'var(--gold)' : 'var(--ink-dim)',
                  borderColor: on ? 'rgba(212,165,116,0.3)' : 'var(--line-soft)',
                  cursor: 'pointer',
                }}>{n}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex-col gap-4">
          <div className="card card-pad-lg">
            <div className="section-title"><div className="h">기준 <em>점수</em> & 가격</div></div>
            <div className="field">
              <label>최소 취향 점수 — 이 점수 이상이면 알림</label>
              <div className="range-wrap">
                <input type="range" min="50" max="100" value={scoreMin} onChange={e=>setScoreMin(+e.target.value)} />
                <span className="val">{scoreMin} / 100</span>
              </div>
            </div>
            <hr className="hr" />
            <div className="field">
              <label>최대 가격 (총액)</label>
              <div className="range-wrap">
                <input type="range" min="10000" max="100000" step="1000" value={priceMax} onChange={e=>setPriceMax(+e.target.value)} />
                <span className="val">₩{priceMax.toLocaleString()}</span>
              </div>
            </div>
            <div className="field mt-3">
              <label>최대 100g당 가격</label>
              <div className="range-wrap">
                <input type="range" min="5000" max="80000" step="500" value={ppgMax} onChange={e=>setPpgMax(+e.target.value)} />
                <span className="val">₩{ppgMax.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="card card-pad-lg">
            <div className="section-title"><div className="h">가공 & <em>배전도</em></div></div>
            <div className="eyebrow mb-2">가공방식</div>
            <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
              {['Washed','Natural','Anaerobic','Honey','Pulped Natural','Carbonic'].map((p, i) => (
                <span key={p} className="tag" style={{ background: i<4 ? 'rgba(212,165,116,0.10)' : 'transparent', color: i<4 ? 'var(--gold)' : 'var(--ink-dim)', borderColor: i<4 ? 'rgba(212,165,116,0.3)' : 'var(--line-soft)' }}>{p}</span>
              ))}
            </div>
            <div className="eyebrow mb-2">배전도</div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {['Light','Light-Medium','Medium','Medium-Dark','Dark'].map((p, i) => (
                <span key={p} className="tag" style={{ background: i<3 ? 'rgba(212,165,116,0.10)' : 'transparent', color: i<3 ? 'var(--gold)' : 'var(--ink-dim)', borderColor: i<3 ? 'rgba(212,165,116,0.3)' : 'var(--line-soft)' }}>{p}</span>
              ))}
            </div>
          </div>

          <div className="card card-pad-lg">
            <div className="section-title"><div className="h">스캔 <em>주기</em></div></div>
            <div className="field">
              <label>기본 주기</label>
              <select className="select">
                <option>30분마다</option>
                <option>15분마다</option>
                <option>60분마다</option>
              </select>
            </div>
            <div className="flex justify-between items-center mt-4">
              <div>
                <div className="eyebrow">조용한 시간</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink-soft)', marginTop: 2 }}>23:00 — 07:30</div>
              </div>
              <div className="toggle on"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoteWeight({ name, weight, cls }) {
  const w = Math.abs(weight) / 5;
  const positive = weight >= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <span className={`tag ${cls}`} style={{ minWidth: 130, justifyContent: 'flex-start' }}>{name}</span>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-inset)', borderRadius: 999, position: 'relative', border: '1px solid var(--line-soft)' }}>
        <div style={{
          position: 'absolute',
          left: positive ? '50%' : `${50 - w * 50}%`,
          width: `${w * 50}%`,
          top: 0, bottom: 0,
          background: positive ? 'linear-gradient(90deg, var(--gold-deep), var(--gold))' : 'linear-gradient(270deg, var(--berry), #6e2c2c)',
          borderRadius: 999,
        }}></div>
        <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'var(--line)' }}></div>
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: positive ? 'var(--gold)' : 'var(--berry)', minWidth: 28, textAlign: 'right' }}>{weight > 0 ? '+' : ''}{weight}</span>
    </div>
  );
}

window.ScreenSearch = ScreenSearch;
