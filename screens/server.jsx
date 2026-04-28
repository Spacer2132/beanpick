/* Screen 7: Server / environment status */

function ScreenServer() {
  const cpuSpark = [22,28,34,30,36,42,38,44,52,48,40,46,52,58];
  const memSpark = [62,64,63,68,70,69,71,73,72,74,73,75,76,74];
  const apiSpark = [120,140,135,160,150,170,165,180,170,155,148,162,155,142];

  return (
    <div className="fade-in">
      <div className="page-head">
        <div className="page-title-block">
          <div className="eyebrow">System · Last deploy 6h ago</div>
          <h1>서버는 <em>잘</em> 살아있습니다.</h1>
          <p className="lede">크롤러, OCR 워커, 텔레그램 게이트웨이의 상태와 최근 이벤트입니다. 모든 서비스가 정상 동작 중.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost">로그 다운로드</button>
          <button className="btn btn-ghost">.env 편집</button>
          <button className="btn btn-primary">배포</button>
        </div>
      </div>

      <div className="grid grid-3 mb-6">
        <ResCard title="CPU" value="46%" sub="4 cores · 1.2 load" data={cpuSpark} color="#D4A574" />
        <ResCard title="Memory" value="74%" sub="2.96 / 4.00 GB" data={memSpark} color="#6B8E5A" />
        <ResCard title="API latency" value="155ms" sub="p95 · 24h" data={apiSpark} color="#C58B5C" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.1fr 1fr', gap: 22 }}>
        {/* Services */}
        <div className="card card-pad-lg">
          <div className="section-title">
            <div className="h">서비스 <em>상태</em></div>
            <span className="meta">5개 · 모두 정상</span>
          </div>
          <div className="flex-col">
            <ServiceRow name="naver-shopping-poller" status="up" uptime="14d 6h" rps="0.42" />
            <ServiceRow name="roastery-crawler"      status="up" uptime="14d 6h" rps="0.18" />
            <ServiceRow name="ocr-worker (tesseract)" status="up" uptime="2d 4h"  rps="0.71" warn />
            <ServiceRow name="taste-scorer"          status="up" uptime="14d 6h" rps="0.92" />
            <ServiceRow name="telegram-gateway"      status="up" uptime="14d 6h" rps="0.04" />
          </div>
          <hr className="hr" />
          <div className="flex justify-between items-center">
            <span className="eyebrow">Queue depth</span>
            <div className="flex gap-3">
              <span className="kpi">scan: 0</span>
              <span className="kpi" style={{ color: 'var(--gold)' }}>ocr: 7</span>
              <span className="kpi">notify: 0</span>
            </div>
          </div>
        </div>

        {/* Env */}
        <div className="card card-pad-lg">
          <div className="section-title">
            <div className="h"><em>.env</em> · 11개 변수</div>
            <span className="conf">모두 설정됨</span>
          </div>
          <pre className="code">
<span className="c"># Telegram</span>{'\n'}
<span className="k">TELEGRAM_BOT_TOKEN</span>=<span className="s">"7488*****************•••••"</span>{'\n'}
<span className="k">TELEGRAM_CHAT_ID</span>=<span className="s">"-1002447189202"</span>{'\n\n'}
<span className="c"># Naver Shopping API</span>{'\n'}
<span className="k">NAVER_CLIENT_ID</span>=<span className="s">"jXkP****"</span>{'\n'}
<span className="k">NAVER_CLIENT_SECRET</span>=<span className="s">"•••••••"</span>{'\n\n'}
<span className="c"># OCR</span>{'\n'}
<span className="k">OCR_ENGINE</span>=<span className="s">"tesseract+papago"</span>{'\n'}
<span className="k">OCR_MIN_CONFIDENCE</span>=<span className="n">0.72</span>{'\n'}
<span className="k">OCR_LANG</span>=<span className="s">"kor+eng"</span>{'\n\n'}
<span className="c"># Scoring</span>{'\n'}
<span className="k">SCORE_THRESHOLD</span>=<span className="n">75</span>{'\n'}
<span className="k">SCORE_MODEL</span>=<span className="s">"taste-v3.cosine"</span>{'\n\n'}
<span className="c"># Storage</span>{'\n'}
<span className="k">DATABASE_URL</span>=<span className="s">"postgres://****"</span>{'\n'}
<span className="k">REDIS_URL</span>=<span className="s">"redis://****"</span>
          </pre>
        </div>
      </div>

      {/* Event log */}
      <div className="card card-pad-lg mt-6">
        <div className="section-title">
          <div className="h">최근 <em>이벤트</em></div>
          <div className="flex gap-2">
            <span className="tag cream">all</span>
            <span className="tag" style={{ background: 'transparent', borderColor: 'var(--line-soft)', color: 'var(--ink-faint)' }}>info</span>
            <span className="tag" style={{ background: 'transparent', borderColor: 'var(--line-soft)', color: 'var(--ink-faint)' }}>warn</span>
            <span className="tag" style={{ background: 'transparent', borderColor: 'var(--line-soft)', color: 'var(--ink-faint)' }}>error</span>
          </div>
        </div>
        <div className="flex-col">
          <LogRow ts="14:32:08" lvl="info"  src="taste-scorer"      msg="bean#b3 scored 96 (Outstanding) · notify queued" />
          <LogRow ts="14:32:07" lvl="info"  src="ocr-worker"        msg="job#4811 completed in 2.7s, conf=0.96" />
          <LogRow ts="14:31:58" lvl="info"  src="roastery-crawler"  msg="momos.co.kr · 1 new product (Esmeralda Geisha)" />
          <LogRow ts="14:14:02" lvl="warn"  src="ocr-worker"        msg="queue depth 7 → throttle to 0.7 rps" />
          <LogRow ts="14:08:11" lvl="info"  src="taste-scorer"      msg="bean#b1 scored 92 · notify sent" />
          <LogRow ts="13:51:44" lvl="info"  src="naver-shopping"    msg="price drop detected: Kainamui AA 26000→24000" />
          <LogRow ts="10:14:02" lvl="error" src="roastery-crawler"  msg="bombayroastery.kr timeout 15s · retry in 5m" />
          <LogRow ts="08:30:00" lvl="info"  src="telegram-gateway"  msg="morning digest sent (3 matches)" />
        </div>
      </div>
    </div>
  );
}

function ResCard({ title, value, sub, data, color }) {
  return (
    <div className="card card-pad">
      <div className="flex justify-between items-center mb-3">
        <span className="eyebrow">{title}</span>
        <span className="status"><span className="dot green pulse"></span>OK</span>
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 38, color: 'var(--ink-soft)', fontWeight: 500, lineHeight: 1.05 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{sub}</div>
      <Spark data={data} color={color} height={48} />
    </div>
  );
}

function ServiceRow({ name, status, uptime, rps, warn }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}>
      <div className="flex items-center gap-3">
        <span className={`dot ${warn ? 'amber' : 'green'} pulse`}></span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink-soft)' }}>{name}</span>
      </div>
      <span className="status">
        <span style={{ color: warn ? 'var(--copper)' : 'var(--moss)', fontWeight: 500, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{warn ? 'warn' : status}</span>
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>↑ {uptime}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)', textAlign: 'right' }}>{rps} rps</span>
    </div>
  );
}

function LogRow({ ts, lvl, src, msg }) {
  const color = lvl === 'error' ? 'var(--berry)' : lvl === 'warn' ? 'var(--copper)' : 'var(--moss)';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 60px 160px 1fr', gap: 14, padding: '8px 0', borderBottom: '1px dashed var(--line-soft)', alignItems: 'baseline', fontFamily: 'var(--mono)', fontSize: 12 }}>
      <span style={{ color: 'var(--ink-faint)' }}>{ts}</span>
      <span style={{ color, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, fontWeight: 600 }}>{lvl}</span>
      <span style={{ color: 'var(--gold)' }}>{src}</span>
      <span style={{ color: 'var(--ink-soft)' }}>{msg}</span>
    </div>
  );
}

window.ScreenServer = ScreenServer;
