/* Screen 3: OCR Analysis Result */

function ScreenOCR({ data }) {
  const bean = data.beans[0]; // Worka Sakaro

  // OCR detection regions (% of canvas)
  const regions = [
    { x: 18, y: 14, w: 64, h: 8,  text: 'Ethiopia · Worka Sakaro', conf: 0.98, family: 'origin' },
    { x: 22, y: 26, w: 56, h: 6,  text: 'Yirgacheffe · Gedeb',     conf: 0.95, family: 'origin' },
    { x: 16, y: 38, w: 30, h: 5,  text: 'Process: Natural',         conf: 0.93, family: 'process' },
    { x: 50, y: 38, w: 30, h: 5,  text: 'Roast: Light',             conf: 0.91, family: 'roast' },
    { x: 12, y: 52, w: 76, h: 6,  text: 'BLUEBERRY  ·  HONEY',      conf: 0.88, family: 'note' },
    { x: 12, y: 60, w: 76, h: 6,  text: 'STONE FRUIT  ·  FLORAL',   conf: 0.84, family: 'note' },
    { x: 18, y: 76, w: 64, h: 5,  text: '200g · ₩28,000',           conf: 0.99, family: 'price' },
  ];

  return (
    <div className="fade-in">
      <div className="page-head">
        <div className="page-title-block">
          <div className="eyebrow">OCR · Job #4811 · 2.7s</div>
          <h1>컵노트 <em>해독</em>이 끝났습니다.</h1>
          <p className="lede">상세페이지 이미지에서 추출한 텍스트와 그것이 매핑된 메타데이터를 함께 확인하세요. 각 영역을 클릭하면 원본 좌표로 점프합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost">← 후보 목록</button>
          <button className="btn btn-ghost">재처리</button>
          <button className="btn btn-primary">취향 점수 다시 계산</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 22 }}>
        {/* Left: source image with overlays */}
        <div className="card card-pad">
          <div className="section-title">
            <div className="h">원본 <em>이미지</em></div>
            <div className="meta">프릳츠 커피 컴퍼니 · fritz.co.kr</div>
          </div>
          <div className="ocr-canvas paper-grain" style={{ background: 'linear-gradient(180deg, #2a2018, #0f0a06)' }}>
            {/* Fake product detail page */}
            <div style={{ position: 'absolute', inset: '8% 12%', background: 'linear-gradient(180deg, #f4ecd8, #d9c8a0)', borderRadius: 6, padding: '6% 8%', fontFamily: 'serif', color: '#2a1f12' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.3em', opacity: 0.6 }}>프릳츠 커피 컴퍼니</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontStyle: 'italic', marginTop: 8 }}>Ethiopia<br/>Worka Sakaro</div>
              <div style={{ fontSize: 10, marginTop: 6, opacity: 0.7 }}>Yirgacheffe · Gedeb</div>
              <hr style={{ margin: '12px 0', borderColor: 'rgba(0,0,0,0.15)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, opacity: 0.7 }}>
                <span>Process: Natural</span>
                <span>Roast: Light</span>
              </div>
              <div style={{ marginTop: 18, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 12 }}>Cup Notes</div>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', marginTop: 6, lineHeight: 1.8 }}>
                BLUEBERRY · HONEY<br/>
                STONE FRUIT · FLORAL
              </div>
              <hr style={{ margin: '14px 0', borderColor: 'rgba(0,0,0,0.15)' }} />
              <div style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10 }}>200g · ₩28,000</div>
            </div>

            {/* OCR overlays */}
            {regions.map((r, i) => (
              <div key={i} className="ocr-overlay" style={{
                left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`,
                borderColor: r.conf >= 0.9 ? 'var(--gold)' : r.conf >= 0.8 ? 'var(--copper)' : 'var(--terra)',
                background: `rgba(${r.conf >= 0.9 ? '212,165,116' : r.conf >= 0.8 ? '197,139,92' : '184,107,75'}, 0.14)`,
              }}>
                <span style={{ position: 'absolute', top: -14, left: 0, color: 'inherit' }}>{i+1}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-4">
            <span className="eyebrow">7개 영역 검출 · 평균 신뢰도 92%</span>
            <span className="kpi">tesseract + papago</span>
          </div>
        </div>

        {/* Right: extracted structured data */}
        <div className="flex-col gap-4">
          <div className="card card-pad">
            <div className="section-title">
              <div className="h">추출된 <em>필드</em></div>
              <span className="conf">신뢰도 96%</span>
            </div>
            <div className="flex-col gap-3">
              <Field k="상품명" v="Ethiopia Worka Sakaro" conf={0.98} />
              <Field k="원산지" v="Ethiopia · Yirgacheffe · Gedeb" conf={0.95} />
              <Field k="가공방식" v="Natural" conf={0.93} />
              <Field k="배전도" v="Light" conf={0.91} />
              <Field k="용량 / 가격" v="200g · ₩28,000" conf={0.99} />
            </div>
          </div>

          <div className="card card-pad">
            <div className="section-title">
              <div className="h">검출된 <em>컵노트</em></div>
              <span className="meta">4 / 4 매핑됨</span>
            </div>
            <div className="flex-col gap-3">
              <NoteRow raw="BLUEBERRY" mapped="Blueberry" family="berry" liked /> 
              <NoteRow raw="HONEY" mapped="Honey" family="honey" liked /> 
              <NoteRow raw="STONE FRUIT" mapped="Stone Fruit" family="stone" liked /> 
              <NoteRow raw="FLORAL" mapped="Floral" family="floral" liked />
            </div>
            <hr className="hr" />
            <div className="pullquote">
              취향 모델은 4개 노트 모두에서 양의 가중치를 받았습니다.
              내 선호 클러스터 <em>「African Naturals」</em>와 0.91 코사인 유사도.
            </div>
          </div>

          <div className="card card-pad">
            <div className="section-title">
              <div className="h">최종 <em>점수</em></div>
            </div>
            <div className="flex items-center gap-6">
              <CupScore score={92} size={84} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 48, color: 'var(--ink-soft)', lineHeight: 1, fontWeight: 500 }}>
                  92<span style={{ color: 'var(--ink-faint)', fontSize: 18 }}>/100</span>
                </div>
                <div className="eyebrow" style={{ marginTop: 6 }}>Excellent · 알림 발송 대상</div>
                <div className="flex gap-2 mt-3">
                  <span className="kpi">노트 +48</span>
                  <span className="kpi">원산지 +24</span>
                  <span className="kpi">가공 +12</span>
                  <span className="kpi">가격 +8</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ k, v, conf }) {
  const cls = conf >= 0.9 ? '' : conf >= 0.8 ? 'med' : 'low';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 14, alignItems: 'baseline', padding: '8px 0', borderBottom: '1px dashed var(--line-soft)' }}>
      <span className="eyebrow">{k}</span>
      <span style={{ fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--ink-soft)' }}>{v}</span>
      <span className={`conf ${cls}`}>{Math.round(conf*100)}%</span>
    </div>
  );
}

function NoteRow({ raw, mapped, family, liked }) {
  return (
    <div className="flex items-center gap-3" style={{ padding: '6px 0' }}>
      <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', minWidth: 110 }}>"{raw}"</code>
      <span style={{ color: 'var(--ink-dim)' }}>→</span>
      <NoteTag>{mapped}</NoteTag>
      <span className="eyebrow" style={{ marginLeft: 4 }}>{family}</span>
      <span style={{ marginLeft: 'auto' }} className="kpi">+12 ♥</span>
    </div>
  );
}

window.ScreenOCR = ScreenOCR;
