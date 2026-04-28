/* Screen 6: Telegram notification log */

function ScreenTelegram({ data }) {
  return (
    <div className="fade-in">
      <div className="page-head">
        <div className="page-title-block">
          <div className="eyebrow">Telegram · @beanpick_bot</div>
          <h1>오늘 보낸 <em>알림</em>들</h1>
          <p className="lede">취향 점수 75점 이상의 신상품, 가격 인하, 시스템 이벤트가 차곡차곡 쌓입니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost">테스트 발송</button>
          <button className="btn btn-ghost">필터</button>
        </div>
      </div>

      <div className="grid grid-4 mb-6">
        <SmallStat2 label="오늘 발송" value="14" />
        <SmallStat2 label="신상 매칭" value="9" tone="gold" />
        <SmallStat2 label="가격 인하" value="3" />
        <SmallStat2 label="실패" value="0" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 22 }}>
        {/* Timeline */}
        <div className="card" style={{ padding: '8px 0' }}>
          <div className="section-title" style={{ padding: '14px 28px 6px' }}>
            <div className="h">타임라인</div>
            <div className="meta">최신순 · 8건</div>
          </div>
          <div>
            {data.telegram.map((t, i) => <TGItem key={i} t={t} />)}
          </div>
        </div>

        {/* Phone preview */}
        <div className="flex-col gap-4">
          <div className="card card-pad">
            <div className="section-title">
              <div className="h">미리보기</div>
              <span className="kpi">@beanpick_bot</span>
            </div>
            <div className="flex-col gap-3" style={{ background: 'var(--bg-inset)', padding: 18, borderRadius: 12, border: '1px solid var(--line-soft)' }}>
              <div className="tg-bubble fade-in">
                <div className="hd">🎯 매우 높은 일치도</div>
                <div><strong style={{ color: 'var(--gold)' }}>Panama Janson Esmeralda Geisha</strong></div>
                <div style={{ marginTop: 4 }}>모모스 커피 · ₩64,000 / 100g</div>
                <div className="flex gap-2 mt-3" style={{ flexWrap: 'wrap' }}>
                  <span className="tag plum">Jasmine</span>
                  <span className="tag plum">Bergamot</span>
                  <span className="tag moss">Peach</span>
                  <span className="tag plum">Tea-like</span>
                </div>
                <div className="meta">취향 점수 96 · 14:32</div>
              </div>
              <div className="tg-bubble fade-in">
                <div className="hd">🫐 새 원두 발견</div>
                <div><strong style={{ color: 'var(--gold)' }}>Ethiopia Worka Sakaro</strong></div>
                <div style={{ marginTop: 4 }}>프릳츠 · ₩28,000 / 200g · ₩14,000/100g</div>
                <div className="flex gap-2 mt-3" style={{ flexWrap: 'wrap' }}>
                  <span className="tag berry">Blueberry</span>
                  <span className="tag plum">Floral</span>
                  <span className="tag cream">Honey</span>
                </div>
                <div className="meta">취향 점수 92 · 14:08</div>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="section-title"><div className="h">알림 <em>설정</em></div></div>
            <div className="flex-col gap-3">
              <Toggle label="신상품 매칭 (점수 ≥ 임계치)" on />
              <Toggle label="가격 인하 (5% 이상)" on />
              <Toggle label="재입고 알림" on />
              <Toggle label="OCR 실패 즉시 알림" />
              <Toggle label="아침 다이제스트 (08:30)" on />
              <Toggle label="시스템 에러" on />
            </div>
            <hr className="hr" />
            <div className="flex justify-between items-center">
              <div>
                <div className="eyebrow">Chat ID</div>
                <div className="mono" style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>−1002 4471 8920</div>
              </div>
              <button className="btn btn-sm btn-ghost">변경</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TGItem({ t }) {
  const icon = t.kind === 'match' ? '🎯' : t.kind === 'price' ? '💸' : t.kind === 'error' ? '⚠️' : t.kind === 'digest' ? '☕' : '⚙️';
  const tone =
    t.kind === 'match' ? 'var(--gold)' :
    t.kind === 'price' ? 'var(--moss)' :
    t.kind === 'error' ? 'var(--berry)' :
    'var(--ink-mute)';
  return (
    <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--line-soft)', display: 'grid', gridTemplateColumns: '90px 32px 1fr auto', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', paddingTop: 2 }}>{t.ts}</div>
      <div style={{ fontSize: 18, lineHeight: 1, paddingTop: 1 }}>{icon}</div>
      <div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 14, color: tone, fontStyle: 'italic' }}>{t.bean}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4, lineHeight: 1.55 }}>{t.text}</div>
      </div>
      <div style={{ minWidth: 70, textAlign: 'right' }}>
        {t.score !== null && t.score !== undefined ? (
          <>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--ink-soft)', lineHeight: 1, fontWeight: 500 }}>{t.score}</div>
            <div className="eyebrow" style={{ marginTop: 2 }}>점수</div>
          </>
        ) : (
          <span className="kpi">시스템</span>
        )}
      </div>
    </div>
  );
}

function SmallStat2({ label, value, tone }) {
  return (
    <div className="card card-pad" style={{ padding: '18px 22px' }}>
      <div className="eyebrow">{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 32, color: tone === 'gold' ? 'var(--gold)' : 'var(--ink-soft)', fontWeight: 500, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function Toggle({ label, on }) {
  const [v, setV] = React.useState(!!on);
  return (
    <div className="flex justify-between items-center" style={{ padding: '6px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{label}</span>
      <div className={`toggle ${v ? 'on' : ''}`} onClick={()=>setV(!v)}></div>
    </div>
  );
}

window.ScreenTelegram = ScreenTelegram;
