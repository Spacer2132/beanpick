/* Shared UI primitives for BeanPick */

// Coffee cup score meter — fills like coffee being poured
function CupScore({ score = 80, size = 56, label = true }) {
  const fillH = Math.max(0, Math.min(100, score)); // %
  const w = size, h = size * 1.14;
  const cupW = w * 0.78, cupH = h * 0.74;
  const cupX = (w - cupW) / 2, cupY = h * 0.04;
  // Fill rect
  const fillTop = cupY + (cupH - 8) * (1 - fillH / 100) + 4;
  const fillRectH = cupY + cupH - 4 - fillTop;

  const tone =
    score >= 90 ? '#D4A574' :
    score >= 80 ? '#D4A574' :
    score >= 70 ? '#C58B5C' :
    '#B86B4B';

  return (
    <div className="cup-score" style={{ width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <clipPath id={`cup-clip-${score}-${size}`}>
            <path d={`M ${cupX+3} ${cupY+3}
                     L ${cupX+cupW-3} ${cupY+3}
                     L ${cupX+cupW-7} ${cupY+cupH-4}
                     Q ${cupX+cupW/2} ${cupY+cupH+2}, ${cupX+7} ${cupY+cupH-4} Z`} />
          </clipPath>
          <linearGradient id={`coffee-${score}-${size}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={tone} stopOpacity="0.95" />
            <stop offset="1" stopColor="#6B4423" />
          </linearGradient>
        </defs>
        {/* cup body */}
        <path
          d={`M ${cupX} ${cupY}
              L ${cupX+cupW} ${cupY}
              L ${cupX+cupW-6} ${cupY+cupH}
              Q ${cupX+cupW/2} ${cupY+cupH+6}, ${cupX+6} ${cupY+cupH} Z`}
          fill="#1F2A24"
          stroke="#3A4A40"
          strokeWidth="1"
        />
        {/* handle */}
        <path
          d={`M ${cupX+cupW-2} ${cupY+cupH*0.18}
              q ${cupW*0.32} ${cupH*0.06}, ${cupW*0.22} ${cupH*0.4}
              q -${cupW*0.06} ${cupH*0.04}, -${cupW*0.16} -${cupH*0.04}`}
          fill="none"
          stroke="#3A4A40"
          strokeWidth="1.4"
        />
        {/* coffee fill */}
        <g clipPath={`url(#cup-clip-${score}-${size})`}>
          <rect
            x={cupX}
            y={fillTop}
            width={cupW}
            height={fillRectH}
            fill={`url(#coffee-${score}-${size})`}
          />
          {/* surface highlight */}
          <ellipse
            cx={cupX + cupW/2}
            cy={fillTop + 1}
            rx={cupW/2 - 5}
            ry={2}
            fill="#3A1F0E"
            opacity="0.6"
          />
          <ellipse
            cx={cupX + cupW/2 - 4}
            cy={fillTop + 1}
            rx={cupW/4}
            ry={1.2}
            fill={tone}
            opacity="0.9"
          />
        </g>
        {/* saucer */}
        <ellipse
          cx={cupX + cupW/2}
          cy={cupY + cupH + 6}
          rx={cupW * 0.62}
          ry={3.2}
          fill="none"
          stroke="#3A4A40"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

// Note tag with subtle hue based on flavor family
function NoteTag({ children }) {
  const text = String(children).toLowerCase();
  let cls = '';
  if (/berry|blue|straw|currant|wine|plum|cherry|grape/.test(text)) cls = 'berry';
  else if (/floral|jasmine|bergamot|tea|rose|herbal/.test(text)) cls = 'plum';
  else if (/cocoa|chocolate|nut|hazel|almond|caramel|brown sugar|honey/.test(text)) cls = '';
  else if (/citrus|lemon|orange|tropical|peach|apricot|stone|lychee|mango/.test(text)) cls = 'moss';
  else cls = 'cream';
  return <span className={`tag ${cls}`}>{children}</span>;
}

// Status mini-row
function MiniStatus({ kind, value }) {
  let dotCls = 'green', text = value;
  if (kind === 'ocr') {
    if (value === 'success') { dotCls = 'green'; text = 'OCR 성공'; }
    else if (value === 'partial') { dotCls = 'amber'; text = 'OCR 부분'; }
    else if (value === 'failed') { dotCls = 'red'; text = 'OCR 실패'; }
  } else if (kind === 'notify') {
    if (value === 'sent') { dotCls = 'green'; text = '알림 발송'; }
    else if (value === 'pending') { dotCls = 'amber'; text = '대기'; }
    else if (value === 'queued') { dotCls = 'amber'; text = '큐'; }
    else if (value === 'skipped') { dotCls = 'red'; text = '미발송'; }
  }
  return (
    <span className="mini-status">
      <span className={`dot ${dotCls}`}></span> {text}
    </span>
  );
}

// Sparkline
function Spark({ data = [], color = '#D4A574', height = 56 }) {
  if (!data.length) return null;
  const w = 240, h = height;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 4) + 2;
    const y = h - 4 - ((v - min) / range) * (h - 8);
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${pts[pts.length-1][0]} ${h} L ${pts[0][0]} ${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sp-${color.replace('#','')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.4" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp-${color.replace('#','')})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" />
      {pts.map((p, i) => i === pts.length - 1 ? (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} stroke="#1B2620" strokeWidth="1.5" />
      ) : null)}
    </svg>
  );
}

// Ornament — editorial flourish
function Ornament() {
  return (
    <div className="orn" style={{ height: 28, opacity: 0.45 }}>
      <svg width="80" height="20" viewBox="0 0 80 20">
        <path d="M0 10 L30 10 M50 10 L80 10" stroke="currentColor" strokeWidth="0.6" />
        <circle cx="40" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="0.7" />
        <circle cx="34" cy="10" r="0.8" fill="currentColor" />
        <circle cx="46" cy="10" r="0.8" fill="currentColor" />
      </svg>
    </div>
  );
}

// Bean card
function BeanCard({ bean }) {
  return (
    <article className="bean-card fade-in">
      <div className="head">
        <div className="img-wrap">
          <div className="bag" data-label={bean.tagline} style={{ background: bean.bagColor }}></div>
        </div>
        <div className="meta">
          <div className="roastery">{bean.roastery}</div>
          <h3 className="pname">{bean.name}</h3>
          <div className="price-row">
            <span className="price">₩{bean.price.toLocaleString()}</span>
            <span className="ppg">{bean.weight}g · ₩{bean.ppg.toLocaleString()}/100g</span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <CupScore score={bean.score} size={42} />
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--ink-soft)', lineHeight: 1 }}>
                {bean.score}<span style={{ color: 'var(--ink-faint)', fontSize: 12, marginLeft: 4 }}>/100</span>
              </div>
              <div className="eyebrow" style={{ marginTop: 4 }}>{bean.scoreLabel}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="body">
        <div className="spec-grid">
          <div className="spec-row"><span className="k">원산지</span><span className="v">{bean.origin}</span></div>
          <div className="spec-row"><span className="k">가공</span><span className="v">{bean.process}</span></div>
          <div className="spec-row"><span className="k">배전도</span><span className="v">{bean.roast}</span></div>
          <div className="spec-row"><span className="k">발견</span><span className="v" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{bean.foundAt}</span></div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Cup Notes</div>
          <div className="notes">
            {bean.notes.map(n => <NoteTag key={n}>{n}</NoteTag>)}
          </div>
        </div>
      </div>

      <div className="foot">
        <div className="flex items-center gap-3">
          <MiniStatus kind="ocr" value={bean.ocr} />
          <span style={{ color: 'var(--ink-dim)' }}>·</span>
          <MiniStatus kind="notify" value={bean.notify} />
        </div>
        <button className="btn btn-sm btn-ghost">자세히 →</button>
      </div>
    </article>
  );
}

Object.assign(window, { CupScore, NoteTag, MiniStatus, Spark, Ornament, BeanCard });
