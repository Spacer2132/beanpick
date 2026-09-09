import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  COFFEE_BELT_BOUNDS,
  COFFEE_COUNTRIES,
  extractProductCountries,
} from '../services/mapCoordinates.js';
import { COFFEE_COUNTRY_PATHS, OTHER_COUNTRY_PATHS } from './worldCountryPaths.js';
import { COFFEE_REGION_POINTS } from '../services/coffeeRegions.js';

// 화면 폭에 맞춘 비율은 대륙을 전환해도 유지한다.
const DEFAULT_VIEW = { x: 182, y: 70, w: 760 };
const MAP_RATIO = 760 / 345;
const MIN_W = 90;
const MAX_W = DEFAULT_VIEW.w;

// 기본 화면은 커피 생산국 23개가 모두 들어가는 영역(x 225~900, y 189~295)에 여백을 준 값.
// 북극·남극 빈 바다를 잘라내 같은 화면 폭에서 지도가 더 크게 보인다.
const ZOOM_PRESETS = [
  { id: 'all', label: '전 세계', view: DEFAULT_VIEW },
  { id: 'latin', label: '중남미', view: { x: 125, y: 171, w: 330 } },
  { id: 'africa', label: '아프리카', view: { x: 486, y: 182, w: 245 } },
  { id: 'asia', label: '아시아', view: { x: 663, y: 164, w: 285 } },
];

// 원두 보유 수량 구간. fill은 나라 영역 색, r은 개수 뱃지 반지름(화면 픽셀).
const COUNT_TIERS = [
  { min: 20, r: 12, fill: '#af805b', label: '20개 이상' },
  { min: 5, r: 11, fill: '#c8a17c', label: '5~19개' },
  { min: 1, r: 10, fill: '#dfc7a6', label: '1~4개' },
  { min: 0, r: 0, fill: null, label: '없음' },
];

const OTHER_LAND_FILL = '#f3ecdd';
const LAND_STROKE = '#b5b1a0';
const PIN_FILL = '#573f30';
const ACTIVE_FILL = '#a96543';

function getCountTier(count) {
  return COUNT_TIERS.find((t) => count >= t.min) || COUNT_TIERS[COUNT_TIERS.length - 1];
}

function clampView({ x, y, w }, ratio = MAP_RATIO) {
  const cw = Math.min(MAX_W, Math.max(MIN_W, w));
  const ch = cw / ratio;
  return {
    w: cw,
    x: Math.max(0, Math.min(1000 - cw, x)),
    y: ch > 500 ? (500 - ch) / 2 : Math.max(0, Math.min(500 - ch, y)),
  };
}

// px/py는 확대 기준점의 화면 내 상대 위치(0~1). 커서·두 손가락 중심을 고정한 채 확대한다.
function zoomAt(prev, factor, px, py, ratio = MAP_RATIO) {
  const w = Math.min(MAX_W, Math.max(MIN_W, prev.w * factor));
  return clampView({
    w,
    x: prev.x + (prev.w - w) * px,
    y: prev.y + (prev.w - w) / ratio * py,
  }, ratio);
}

function touchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

export default function WorldCoffeeMap({
  products = [],
  selectedCountry = null,
  highlightedCountries = [],
  discountCountries = [],
  unmappedCount = 0,
  onSelectCountry,
  onShowList,
}) {
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [viewBox, setViewBox] = useState(DEFAULT_VIEW);
  const [activePreset, setActivePreset] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  const [renderedWidth, setRenderedWidth] = useState(0);

  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const prevViewRef = useRef(null);
  const hoverLeaveTimerRef = useRef(null);
  const pinchRef = useRef(null);
  const dragRef = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    startVbX: 0,
    startVbY: 0,
    hasMoved: false,
  });

  const isCompact = renderedWidth > 0 && renderedWidth < 640;
  const mapRatio = isCompact ? 1.18 : MAP_RATIO;
  const previousRatioRef = useRef(MAP_RATIO);
  const vbH = viewBox.w / mapRatio;
  // 화면 1픽셀이 viewBox 몇 단위인지. 핀·글자에 이 값을 곱하면 확대 배율·화면 크기와
  // 무관하게 항상 같은 픽셀 크기로 보인다. (폰에서 핀이 3px로 뭉개지던 문제 해결)
  const pxScale = viewBox.w / (renderedWidth || 900);

  // 렌더 폭 추적 (핀을 화면 기준 크기로 유지하기 위해 필요).
  // ResizeObserver의 첫 관측값만 믿으면 레이아웃이 늦게 잡힐 때 옛 폭에 고정되므로
  // 마운트 직후 한 번 직접 재고, 이후 변화만 관찰한다.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setRenderedWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const oldRatio = previousRatioRef.current;
    setViewBox((prev) => clampView({
      ...prev, y: prev.y + prev.w / oldRatio / 2 - prev.w / mapRatio / 2,
    }, mapRatio));
    previousRatioRef.current = mapRatio;
  }, [mapRatio]);

  useEffect(() => () => clearTimeout(hoverLeaveTimerRef.current), []);

  // 휠 줌. React의 onWheel은 passive라 preventDefault가 먹지 않아 직접 등록한다.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      setActivePreset(null);
      setViewBox((prev) => zoomAt(prev, e.deltaY < 0 ? 1 / 1.18 : 1.18, px, py, mapRatio));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [mapRatio]);

  const handlePinMouseEnter = (countryLabel) => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    setHoveredCountry(countryLabel);
  };

  const handlePinMouseLeave = (countryLabel) => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
    }
    hoverLeaveTimerRef.current = setTimeout(() => {
      setHoveredCountry((curr) => (curr === countryLabel ? null : curr));
      hoverLeaveTimerRef.current = null;
    }, 50);
  };

  // 전체 원두 데이터에서 국가별 원두 개수 집계
  const countryCounts = useMemo(() => {
    const counts = new Map();
    for (const p of products) {
      const countries = extractProductCountries(p);
      for (const c of countries) {
        counts.set(c, (counts.get(c) || 0) + 1);
      }
    }
    return counts;
  }, [products]);

  const activeCountry = hoveredCountry || selectedCountry;
  const activeCountryInfo = COFFEE_COUNTRIES.find((c) => c.label === activeCountry);
  const activeCount = activeCountry ? countryCounts.get(activeCountry) || 0 : 0;

  // 중미처럼 나라가 붙어 있는 곳은 핀이 서로 겹쳐 숫자를 읽을 수 없다.
  // 겹치는 핀만 화면 기준 최소 간격까지 서로 밀어내고, 원래 위치와는 실선으로 이어 둔다.
  const pinLayout = useMemo(() => {
    const pins = [];
    for (const c of COFFEE_COUNTRIES) {
      const count = countryCounts.get(c.label) || 0;
      if (count <= 0) continue;
      pins.push({ country: c, count, tier: getCountTier(count), x: c.x, y: c.y });
    }
    for (let iter = 0; iter < 60; iter += 1) {
      let moved = false;
      for (let i = 0; i < pins.length; i += 1) {
        for (let j = i + 1; j < pins.length; j += 1) {
          const a = pins[i];
          const b = pins[j];
          const minDist = (a.tier.r + b.tier.r + 3) * pxScale;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          if (d >= minDist) continue;
          if (d < 0.001) { dx = (i % 2 ? 1 : -1) * 0.01; dy = 0.01; d = 0.014; }
          const push = (minDist - d) / 2;
          const ux = (dx / d) * push;
          const uy = (dy / d) * push;
          a.x -= ux; a.y -= uy;
          b.x += ux; b.y += uy;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return pins;
  }, [countryCounts, pxScale]);

  // 나라를 클릭했을 때 이동할 화면. 국경 좌표의 최소·최대에 여백을 주고 지도 비율에 맞춘다.
  const countryViews = useMemo(() => {
    const out = {};
    for (const [code, d] of Object.entries(COFFEE_COUNTRY_PATHS)) {
      const nums = d.match(/-?\d+(?:\.\d+)?/g) || [];
      let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = Number(nums[i]);
        const y = Number(nums[i + 1]);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (!Number.isFinite(minX)) continue;
      const padX = Math.max(5, (maxX - minX) * 0.2);
      const padY = Math.max(4, (maxY - minY) * 0.2);
      const boxW = (maxX - minX) + padX * 2;
      const boxH = (maxY - minY) + padY * 2;
      const w = Math.min(MAX_W, Math.max(MIN_W, boxW, boxH * mapRatio));
      out[code] = clampView({
        w,
        x: (minX + maxX) / 2 - w / 2,
        y: (minY + maxY) / 2 - (w / mapRatio) / 2,
      }, mapRatio);
    }
    return out;
  }, [mapRatio]);

  // 지도 밖의 국가 선택도 같은 확대 흐름으로 연결한다.
  useEffect(() => {
    const info = COFFEE_COUNTRIES.find((c) => c.label === selectedCountry);
    if (info && countryViews[info.code]) {
      setViewBox((prev) => {
        if (!prevViewRef.current) prevViewRef.current = prev;
        return countryViews[info.code];
      });
      setActivePreset(null);
    } else if (prevViewRef.current) {
      setViewBox(clampView(prevViewRef.current, mapRatio));
      prevViewRef.current = null;
      setActivePreset(null);
    }
    setHoveredCountry(null);
  }, [selectedCountry, countryViews, mapRatio]);

  // 커피와 무관한 154개국은 상태와 무관하게 늘 같으므로 한 번만 만들어 재사용한다.
  const otherLandLayer = useMemo(() => (
    <g className="map-other-lands" fill={OTHER_LAND_FILL} stroke={LAND_STROKE} strokeWidth="0.6" strokeLinejoin="round">
      {OTHER_COUNTRY_PATHS.map((d, i) => (
        <path key={i} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  ), []);

  const isZoomed = viewBox.w < MAX_W - 20;
  // 선택한 나라로 확대했을 때만 주요 산지를 보여 준다(세계 화면에서는 너무 빽빽해진다).
  const selectedInfo = COFFEE_COUNTRIES.find((c) => c.label === selectedCountry);
  const shownRegions = (selectedInfo && isZoomed && COFFEE_REGION_POINTS[selectedInfo.code]) || [];

  // 가까운 산지끼리 라벨이 겹치므로, 겹치면 위/아래로 번갈아 밀어 놓는다.
  const regionLabels = useMemo(() => {
    // 점 위/아래로 시도해 볼 위치. 무한정 밀어내면 지도 밖으로 나가므로 후보를 한정한다.
    const CANDIDATES = [17, -19, 32, -34, 47, -49];
    const labelW = (name) => name.length * 10 + 16;
    // 화면에 실제로 보이는 위아래 범위(픽셀). 이 밖에 놓으면 라벨이 잘린다.
    const viewTop = viewBox.y / pxScale;
    const viewBottom = (viewBox.y + vbH) / pxScale;
    // 선택한 나라의 개수 뱃지가 이미 차지한 자리도 피한다.
    const selPin = pinLayout.find((p) => p.country.label === selectedCountry);
    const placed = selPin ? [{
      l: selPin.x / pxScale - 17, r: selPin.x / pxScale + 17,
      t: selPin.y / pxScale - 17, b: selPin.y / pxScale + 17,
    }] : [];
    return shownRegions.map((r) => {
      const w = labelW(r.name);
      const sx = r.x / pxScale;
      const sy = r.y / pxScale;
      const boxAt = (dy) => ({ l: sx - w / 2, r: sx + w / 2, t: sy + dy - 8.5, b: sy + dy + 8.5 });
      const overlapWith = (box) => placed.reduce((sum, p) => {
        const ox = Math.min(box.r, p.r) - Math.max(box.l, p.l);
        const oy = Math.min(box.b, p.b) - Math.max(box.t, p.t);
        return sum + (ox > 0 && oy > 0 ? ox * oy : 0);
      }, 0);

      let best = null;
      for (const dy of CANDIDATES) {
        const box = boxAt(dy);
        if (box.t < viewTop + 2 || box.b > viewBottom - 2) continue; // 잘리는 자리는 후보에서 제외
        const area = overlapWith(box);
        if (area === 0) { best = { dy, box, area }; break; }
        if (!best || area < best.area) best = { dy, box, area };
      }
      if (!best) {
        // 화면 안에 들어가는 후보가 없으면 여유가 더 많은 쪽에 붙인다(잘리는 것보다는 낫다).
        const dy = (sy - viewTop) > (viewBottom - sy) ? -19 : 17;
        best = { dy, box: boxAt(dy), area: 0 };
      }
      placed.push(best.box);
      return { ...r, dy: best.dy };
    });
  }, [shownRegions, pxScale, viewBox, vbH, pinLayout, selectedCountry]);
  // 폰처럼 좁은 화면에서는 라벨 칩·영문 안내가 서로 겹쳐 읽을 수 없으므로 줄인다.

  const handleZoomIn = () => {
    setActivePreset(null);
    setViewBox((prev) => zoomAt(prev, 0.72, 0.5, 0.5, mapRatio));
  };

  const handleZoomOut = () => {
    setViewBox((prev) => {
      const next = zoomAt(prev, 1.38, 0.5, 0.5, mapRatio);
      if (next.w >= MAX_W - 20) setActivePreset('all');
      else setActivePreset(null);
      return next;
    });
  };

  const handleResetZoom = () => {
    prevViewRef.current = null;
    onSelectCountry?.(null);
    setActivePreset('all');
    setViewBox(clampView({ ...DEFAULT_VIEW, y: 250 - MAX_W / mapRatio / 2 }, mapRatio));
  };

  const handlePresetClick = (preset) => {
    prevViewRef.current = null;
    onSelectCountry?.(null);
    setActivePreset(preset.id);
    setViewBox(clampView({ ...preset.view,
      y: preset.view.y + preset.view.w / MAP_RATIO / 2 - preset.view.w / mapRatio / 2,
    }, mapRatio));
  };

  // 마우스 드래그 (Pan)
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    dragRef.current = {
      isDown: true,
      startX: e.clientX,
      startY: e.clientY,
      startVbX: viewBox.x,
      startVbY: viewBox.y,
      hasMoved: false,
    };
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!dragRef.current.isDown || !svgRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.hasMoved = true;
    }
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = vbH / rect.height;

    const nextX = dragRef.current.startVbX - dx * scaleX;
    const nextY = dragRef.current.startVbY - dy * scaleY;
    setViewBox((prev) => clampView({ ...prev, x: nextX, y: nextY }, mapRatio));
  };

  const handleMouseUp = () => {
    dragRef.current.isDown = false;
    setIsDragging(false);
  };

  // 모바일 터치: 한 손가락 Pan, 두 손가락 핀치 줌
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      dragRef.current.isDown = false;
      dragRef.current.hasMoved = true;
      pinchRef.current = {
        dist: touchDistance(e.touches),
        cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        cy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        startView: viewBox,
      };
      setIsDragging(false);
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragRef.current = {
        isDown: true,
        startX: t.clientX,
        startY: t.clientY,
        startVbX: viewBox.x,
        startVbY: viewBox.y,
        hasMoved: false,
      };
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!svgRef.current) return;

    if (e.touches.length === 2 && pinchRef.current) {
      const dist = touchDistance(e.touches);
      if (!dist || !pinchRef.current.dist) return;
      const rect = svgRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (pinchRef.current.cx - rect.left) / rect.width;
      const py = (pinchRef.current.cy - rect.top) / rect.height;
      // 손가락 간격이 벌어지면 확대. 시작 상태 기준으로 계산해 누적 오차를 없앤다.
      setActivePreset(null);
      setViewBox(zoomAt(pinchRef.current.startView, pinchRef.current.dist / dist, px, py, mapRatio));
      return;
    }

    if (!dragRef.current.isDown || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - dragRef.current.startX;
    const dy = t.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.hasMoved = true;
    }
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = vbH / rect.height;

    const nextX = dragRef.current.startVbX - dx * scaleX;
    const nextY = dragRef.current.startVbY - dy * scaleY;
    setViewBox((prev) => clampView({ ...prev, x: nextX, y: nextY }, mapRatio));
  };

  const handleTouchEnd = (e) => {
    if (!e.touches || e.touches.length < 2) {
      pinchRef.current = null;
    }
    dragRef.current.isDown = false;
    setIsDragging(false);
  };

  const handlePinClick = (countryLabel) => {
    if (dragRef.current.hasMoved) return;
    const next = selectedCountry === countryLabel ? null : countryLabel;
    onSelectCountry?.(next);
  };

  return (
    <section className="coffee-map-container" aria-labelledby="atlas-title">
      <div className="coffee-map-header">
        <div className="atlas-heading">
          <div>
            <span className="atlas-eyebrow">THE COFFEE ATLAS</span>
            <h1 id="atlas-title">한 잔의 시작, <span>산지에서.</span></h1>
            <p>지도를 따라, 나의 취향에 가까운 커피를 만나보세요.</p>
          </div>
          <div className="atlas-edition"><strong>{countryCounts.size}</strong><span>개의 생산국<br />서로 다른 커피 이야기</span></div>
        </div>
        <div className="atlas-toolbar">
          <div className="map-zoom-presets" role="group" aria-label="대륙 확대">
            {ZOOM_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`map-preset-btn ${activePreset === p.id ? 'is-active' : ''}`}
                onClick={() => handlePresetClick(p)}
                aria-pressed={activePreset === p.id}
                title={`${p.label} 영역 확대`}
              >
                <span className="map-preset-label">{p.label}</span>
              </button>
            ))}
          </div>
          <select className="atlas-country-select" aria-label="생산국 선택"
            value={selectedCountry || ''} onChange={(e) => onSelectCountry?.(e.target.value || null)}>
            <option value="">생산국 찾아보기</option>
            {COFFEE_COUNTRIES.filter((c) => countryCounts.has(c.label)).map((c) => (
              <option key={c.code} value={c.label}>{c.label} · {countryCounts.get(c.label)}종</option>
            ))}
          </select>
        </div>
      </div>

      <div className="coffee-map-svg-wrap" ref={wrapRef}>
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${vbH}`}
          className={`coffee-world-svg ${isDragging ? 'is-dragging' : ''} ${isZoomed ? 'is-zoomed' : ''}`}
          role="group"
          aria-label="세계 커피 산지 지도"
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <defs>
            {/* 바다 그라데이션 (육지와 명암 대비를 확보하기 위한 슬레이트 블루) */}
            <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#b8ccca" />
              <stop offset="50%" stopColor="#b8ccca" />
              <stop offset="100%" stopColor="#b8ccca" />
            </linearGradient>

            {/* 커피 벨트 앰버 골드 그라데이션 */}
            <linearGradient id="coffeeBeltGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f0c07a" stopOpacity="0.05" />
              <stop offset="30%" stopColor="#f3ecdd" stopOpacity="0.04" />
              <stop offset="50%" stopColor="#f3ecdd" stopOpacity="0.06" />
              <stop offset="70%" stopColor="#f3ecdd" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#f0c07a" stopOpacity="0.05" />
            </linearGradient>

            {/* 핀 글로우 필터 */}
            <filter id="pinGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#2c1a0e" floodOpacity="0.6" />
            </filter>

            {/* 대륙 부드러운 그림자 */}
            <filter id="landShadow" x="-2%" y="-2%" width="104%" height="104%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#2b3d49" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* 배경 레이어 (바다, 그리디큘, 커피벨트, 해안선 - 이벤트 가로채기 원천 방지) */}
          <g style={{ pointerEvents: 'none' }}>
            {/* 1. 바다 배경 */}
            <rect x="-1000" y="-1000" width="3000" height="2500" fill="url(#oceanGrad)" />

            {/* 2. 위도/경도 가이드 격자선 */}
            <g className="map-grid" opacity="0.14">
              {[125, 250, 375, 500, 625, 750, 875].map((x) => (
                <line
                  key={`lng-${x}`}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="500"
                  stroke="#dceaf2"
                  strokeWidth={0.6 * pxScale}
                  strokeDasharray={`${3 * pxScale} ${4 * pxScale}`}
                />
              ))}
              {[83, 166, 250, 333, 416].map((y) => (
                <line
                  key={`lat-${y}`}
                  x1="0"
                  y1={y}
                  x2="1000"
                  y2={y}
                  stroke="#dceaf2"
                  strokeWidth={0.6 * pxScale}
                  strokeDasharray={`${3 * pxScale} ${4 * pxScale}`}
                />
              ))}
            </g>

            {/* 3. 커피 벨트 (남위 25° ~ 북위 25°) 하이라이트 대역 */}
            <rect
              x="0"
              y={COFFEE_BELT_BOUNDS.topY}
              width="1000"
              height={COFFEE_BELT_BOUNDS.height}
              fill="url(#coffeeBeltGrad)"
            />
            {/* 북회귀선 (23.5°N) */}
            <line
              x1="0"
              y1={COFFEE_BELT_BOUNDS.topY}
              x2="1000"
              y2={COFFEE_BELT_BOUNDS.topY}
              stroke="#7d9390"
              strokeDasharray={`${4 * pxScale} ${4 * pxScale}`}
              strokeWidth={1.2 * pxScale}
            />
            {/* 남회귀선 (23.5°S) */}
            <line
              x1="0"
              y1={COFFEE_BELT_BOUNDS.bottomY}
              x2="1000"
              y2={COFFEE_BELT_BOUNDS.bottomY}
              stroke="#7d9390"
              strokeDasharray={`${4 * pxScale} ${4 * pxScale}`}
              strokeWidth={1.2 * pxScale}
            />
            {/* 적도선 (0° Equator) */}
            <line
              x1="0"
              y1="250"
              x2="1000"
              y2="250"
              stroke="#7d9390"
              strokeDasharray={`${6 * pxScale} ${6 * pxScale}`}
              strokeWidth={0.8 * pxScale}
              opacity="0.6"
            />

            {/* 라벨 텍스트 (확대·이동해도 화면 왼쪽 위에 붙어 있도록 viewBox 기준으로 배치) */}
            <text
              x={viewBox.x + 10 * pxScale}
              y={COFFEE_BELT_BOUNDS.topY - 6 * pxScale}
              className="atlas-tropic-label"
              fill="#4a6663"
              fontSize={9 * pxScale}
              fontWeight="700"
              letterSpacing={pxScale}
              opacity="0.85"
            >
              {!isCompact && !isZoomed ? '23.5° N' : ''}
            </text>
            <text
              x={viewBox.x + 10 * pxScale}
              y={COFFEE_BELT_BOUNDS.bottomY + 14 * pxScale}
              className="atlas-tropic-label"
              fill="#4a6663"
              fontSize={9 * pxScale}
              fontWeight="700"
              letterSpacing={pxScale}
              opacity="0.85"
            >
              {!isCompact && !isZoomed ? '23.5° S' : ''}
            </text>
            {!isCompact && (
              <text
                x={viewBox.x + viewBox.w - 14 * pxScale}
                y={250 + 4 * pxScale}
                textAnchor="end"
                fill="#4a6663"
                fontSize={11 * pxScale}
                fontWeight="800"
                letterSpacing={3 * pxScale}
                opacity="0.7"
              >
                COFFEE BELT
              </text>
            )}

            {/* 4-1. 커피를 생산하지 않는 나라 (국경선만, 클릭 대상 아님) */}
            {otherLandLayer}
          </g>

          {/* 4-2. 커피 생산국 영역 — 색 농도가 원두 수, 영역 자체가 클릭 대상 */}
          <g className="map-coffee-lands" strokeLinejoin="round">
            {COFFEE_COUNTRIES.map((country) => {
              const d = COFFEE_COUNTRY_PATHS[country.code];
              if (!d) return null;
              const count = countryCounts.get(country.label) || 0;
              const isActive = selectedCountry === country.label
                || highlightedCountries.includes(country.label)
                || hoveredCountry === country.label;
              const tier = getCountTier(count);
              return (
                <path
                  key={country.code}
                  d={d}
                  fill={isActive ? ACTIVE_FILL : (tier.fill || OTHER_LAND_FILL)}
                  stroke={isActive ? '#5d351e' : LAND_STROKE}
                  strokeWidth={isActive ? 1.4 : 0.6}
                  vectorEffect="non-scaling-stroke"
                  role={count > 0 ? 'button' : undefined}
                  tabIndex={count > 0 ? 0 : undefined}
                  aria-label={count > 0 ? `${country.label} 원두 ${count}종 보기` : undefined}
                  aria-pressed={count > 0 ? selectedCountry === country.label : undefined}
                  style={{ cursor: count > 0 ? 'pointer' : 'default', transition: 'fill 0.15s ease' }}
                  onClick={() => count > 0 && handlePinClick(country.label)}
                  onKeyDown={(e) => {
                    if (count > 0 && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onSelectCountry?.(selectedCountry === country.label ? null : country.label);
                    }
                  }}
                  onFocus={() => handlePinMouseEnter(country.label)}
                  onBlur={() => handlePinMouseLeave(country.label)}
                  onMouseEnter={() => handlePinMouseEnter(country.label)}
                  onMouseLeave={() => handlePinMouseLeave(country.label)}
                />
              );
            })}
          </g>

          {/* 4-3. 선택한 나라의 주요 산지 */}
          {shownRegions.length > 0 && (
            <g className="map-regions" style={{ pointerEvents: 'none' }}>
              {regionLabels.map((r) => (
                <g key={r.name} transform={`translate(${r.x}, ${r.y}) scale(${pxScale})`}>
                  <line x1="0" y1="0" x2="0" y2={r.dy > 0 ? r.dy - 9 : r.dy + 9} stroke="#5d351e" strokeWidth="0.9" opacity="0.5" />
                  <circle r="5" fill="#fffaf2" stroke="#5d351e" strokeWidth="1.8" />
                  <circle r="1.8" fill="#5d351e" />
                  <g transform={`translate(0, ${r.dy})`}>
                    <rect
                      x={-(r.name.length * 5 + 8)}
                      y="-8.5"
                      width={r.name.length * 10 + 16}
                      height="17"
                      rx="5"
                      fill="rgba(255, 250, 242, 0.96)"
                      stroke="rgba(93, 53, 30, 0.5)"
                      strokeWidth="0.9"
                    />
                    <text textAnchor="middle" y="3.5" fontSize="9.5" fontWeight="700" fill="#4a3423">
                      {r.name}
                    </text>
                  </g>
                </g>
              ))}
            </g>
          )}

          {/* 5. 생산국 핀 마커 (원두가 있는 나라만) */}
          <g className="map-pins">
            {pinLayout.map(({ country, count, tier, x, y }) => {
              const isSelected = selectedCountry === country.label;
              const isHighlighted = highlightedCountries.includes(country.label);
              const isHovered = hoveredCountry === country.label;

              const isActive = isSelected || isHighlighted || isHovered;
              const showCount = isZoomed || !isCompact || isActive;
              // 겹침을 피해 밀려난 핀은 실제 나라 위치와 가는 선으로 이어 둔다.
              const shifted = Math.hypot(x - country.x, y - country.y) > 1.5 * pxScale;

              return (
                <g key={country.code}>
                  {shifted && (
                    <line
                      x1={country.x}
                      y1={country.y}
                      x2={x}
                      y2={y}
                      stroke="#6b4326"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                      opacity="0.55"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                <g
                  className={`coffee-pin-group ${isActive ? 'is-active' : ''} has-beans`}
                  transform={`translate(${x}, ${y}) scale(${pxScale})`}
                >
                  {/* 선택/하이라이트 시 글로우 링 (DOM 언마운트 없이 투명도로만 부드럽게 토글) */}
                  <circle
                    r={tier.r + 5.5}
                    fill="none"
                    stroke="#ffe2b8"
                    strokeWidth="2.2"
                    opacity={isActive ? 0.9 : 0}
                    className="coffee-pin-glow-ring"
                    style={{
                      pointerEvents: 'none',
                      transition: 'opacity 0.15s ease',
                    }}
                  />

                  {/* 핀 그림자 */}
                  <ellipse
                    cx="0"
                    cy={isActive ? 3 : 2}
                    rx={isActive ? tier.r + 1 : tier.r - 1}
                    ry={isActive ? 3.5 : 2}
                    fill="rgba(24, 34, 41, 0.35)"
                    style={{ pointerEvents: 'none' }}
                  />

                  {/* 외부 원 뱃지 (크기 진동 방지를 위해 r 고정, 색상만 전환) */}
                  <circle
                    r={showCount ? tier.r : 5}
                    fill={isActive ? '#231b16' : PIN_FILL}
                    stroke="#ffffff"
                    strokeWidth={isActive ? 2.2 : 1.5}
                    filter={isActive ? 'url(#pinGlow)' : undefined}
                    style={{
                      transition: 'fill 0.15s ease, stroke-width 0.15s ease',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* 할인 중인 원두가 있는 나라 표시 */}
                  {showCount && discountCountries.includes(country.label) && (
                    <circle
                      cx={tier.r * 0.78}
                      cy={-tier.r * 0.78}
                      r="3.6"
                      fill="#d94f2b"
                      stroke="#ffffff"
                      strokeWidth="1.3"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}

                  {/* 원두 개수 */}
                  {showCount && <text
                    textAnchor="middle"
                    dy="3.7"
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="800"
                    style={{ pointerEvents: 'none' }}
                  >
                    {count}
                  </text>}

                  {/* 국가 라벨 칩 (시각 전용, pointer-events none) */}
                  {!(isCompact && shownRegions.length > 0)
                    && isActive && (
                    <g transform={`translate(0, ${tier.r + 12})`} style={{ pointerEvents: 'none' }}>
                      <rect
                        x={-(country.label.length * 6 + String(count).length * 4 + 14)}
                        y="-9"
                        width={(country.label.length * 12 + String(count).length * 8 + 28)}
                        height="18"
                        rx="5"
                        fill={isActive ? '#231b16' : 'rgba(255, 252, 247, 0.95)'}
                        stroke={isActive ? '#ffe2b8' : 'rgba(120, 96, 72, 0.55)'}
                        strokeWidth="0.9"
                        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.25))"
                        style={{ pointerEvents: 'none' }}
                      />
                      <text
                        textAnchor="middle"
                        y="4"
                        fill={isActive ? '#ffffff' : '#3f332a'}
                        fontSize="9.5"
                        fontWeight={isActive ? '700' : '600'}
                        className="coffee-pin-label"
                        style={{ pointerEvents: 'none' }}
                      >
                        {country.label} · {count}
                      </text>
                    </g>
                  )}

                  {/* 호버 깜빡임 방지 히트 영역: 물리적 fill 부여, 화면 기준 고정 크기 */}
                  <circle
                    r="18"
                    fill="rgba(0, 0, 0, 0.001)"
                    style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onClick={() => handlePinClick(country.label)}
                    onMouseEnter={() => handlePinMouseEnter(country.label)}
                    onMouseLeave={() => handlePinMouseLeave(country.label)}
                  />
                </g>
                </g>
              );
            })}
          </g>

          {/* 6. 호버 / 선택 툴팁 팝업 (국기, 원두 수, 대표 산지)
              산지를 표시 중일 때는 툴팁이 지도를 가리므로 마우스를 올렸을 때만 띄운다. */}
          {!isCompact && activeCountryInfo && hoveredCountry && shownRegions.length === 0 && (() => {
            const laid = pinLayout.find((p) => p.country.label === activeCountryInfo.label);
            const ax = laid ? laid.x : activeCountryInfo.x;
            const ay = laid ? laid.y : activeCountryInfo.y;
            const isNearTop = (ay - 45 * pxScale) < viewBox.y;
            const tooltipY = isNearTop ? (ay + 26 * pxScale) : (ay - 40 * pxScale);
            return (
              <g
                className="coffee-map-tooltip"
                transform={`translate(${ax}, ${tooltipY}) scale(${pxScale})`}
                style={{ pointerEvents: 'none' }}
              >
                <rect
                  x="-105"
                  y={isNearTop ? '0' : '-36'}
                  width="210"
                  height="38"
                  rx="8"
                  fill="#231b16"
                  stroke="#e6b877"
                  strokeWidth="1.2"
                  filter="url(#pinGlow)"
                  style={{ pointerEvents: 'none' }}
                />
                <polygon
                  points={isNearTop ? '-6,-1 6,-1 0,-7' : '-6,2 6,2 0,8'}
                  fill="#231b16"
                  style={{ pointerEvents: 'none' }}
                />
                <text
                  x="0"
                  y={isNearTop ? '16' : '-20'}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="700"
                  style={{ pointerEvents: 'none' }}
                >
                  {activeCountryInfo.flag} {activeCountryInfo.label} ({activeCountryInfo.enName}) · {activeCount}개 원두
                </text>
                <text
                  x="0"
                  y={isNearTop ? '30' : '-6'}
                  textAnchor="middle"
                  fill="#d8c1ab"
                  fontSize="8.5"
                  fontWeight="500"
                  style={{ pointerEvents: 'none' }}
                >
                  산지: {activeCountryInfo.famousRegions || activeCountryInfo.region}
                </text>
              </g>
            );
          })()}
        </svg>

        {/* 7. 플로팅 줌 컨트롤러 (+ / - / 리셋) */}
        <div className="map-floating-controls">
          <button
            type="button"
            className="map-zoom-btn"
            onClick={handleZoomIn}
            title="지도 확대 (+)"
            aria-label="지도 확대"
          >
            +
          </button>
          <button
            type="button"
            className="map-zoom-btn"
            onClick={handleZoomOut}
            title="지도 축소 (-)"
            aria-label="지도 축소"
          >
            −
          </button>
          <button
            type="button"
            className={`map-zoom-btn map-zoom-reset ${isZoomed ? 'is-active' : ''}`}
            onClick={handleResetZoom}
            title="원래 배율로 초기화 (⟲)"
            aria-label="초기화"
            disabled={!isZoomed}
          >
            ⟲
          </button>
        </div>
      </div>

      <div className="atlas-map-caption">
        <span aria-live="polite">{activeCountryInfo
          ? `${activeCountryInfo.label} · 원두 ${activeCount}종${shownRegions.length ? ` · 주요 산지 ${shownRegions.length}곳` : ''}`
          : countryCounts.size ? '나라를 선택해 커피 이야기를 펼쳐보세요' : '표시할 생산국 정보가 없습니다'}</span>
        <span className="atlas-gesture-hint">{isCompact ? '두 손가락으로 확대' : '휠로 확대 · 드래그로 이동'}</span>
      </div>

      <div className="atlas-origin-pane">
        <div className="atlas-origin-copy" aria-live="polite">
          <span className="atlas-eyebrow">{selectedInfo ? selectedInfo.enName : 'A WORLD OF COFFEE'}</span>
          <h2>{selectedInfo ? selectedInfo.label : '어디에서 온 커피를 좋아하세요?'}</h2>
          <p>{selectedInfo ? selectedInfo.flavorNote : '산지마다 다른 향과 맛. 익숙한 한 잔에서 새로운 취향까지.'}</p>
          <div className="atlas-origin-regions">{selectedInfo ? selectedInfo.famousRegions : `${countryCounts.size}개 생산국 · ${products.length}종의 원두`}</div>
        </div>
        {selectedInfo && countryViews[selectedInfo.code] && (
          <svg className="atlas-origin-silhouette" aria-hidden="true"
            viewBox={`${countryViews[selectedInfo.code].x} ${countryViews[selectedInfo.code].y} ${countryViews[selectedInfo.code].w} ${countryViews[selectedInfo.code].w / mapRatio}`}>
            <path d={COFFEE_COUNTRY_PATHS[selectedInfo.code]} fill={ACTIVE_FILL} />
          </svg>
        )}
        <div className="atlas-origin-actions">
          {onShowList && <button type="button" className="coffee-map-list-btn" onClick={onShowList}>
            {selectedInfo ? `원두 ${countryCounts.get(selectedCountry) || 0}종 보기` : `전체 원두 ${products.length}종 보기`}
          </button>}
          {selectedInfo && <button type="button" className="coffee-map-reset-btn" onClick={handleResetZoom}>선택 해제</button>}
        </div>
      </div>

      <details className="atlas-map-guide">
        <summary>지도 읽는 법 <span>색상과 데이터 안내</span></summary>
        <div className="coffee-map-legend">
        <span className="legend-caption">나라 색 = 원두 수</span>
        {COUNT_TIERS.slice().reverse().map((t) => (
          <span key={t.label} className="legend-item">
            <span
              className="legend-swatch"
              style={{ background: t.fill || OTHER_LAND_FILL }}
            />
            {t.label}
          </span>
        ))}
        <span className="legend-item">
          <span className="legend-sale-dot" />
          할인 중 있음
        </span>
        <span className="legend-item">
          <span className="legend-line" />
          북·남회귀선 (커피 벨트)
        </span>
        {unmappedCount > 0 && (
          <span className="legend-item legend-note">
            생산국 미표기 {unmappedCount}개는 지도에 표시되지 않습니다
          </span>
        )}
        </div>
        <p>지도 색은 등록 원두 수를 나타냅니다. 여러 생산국이 있는 원두는 각 나라에 함께 집계됩니다.</p>
        <p>주요 산지는 대표 지역 안내이며 개별 원두의 정확한 농장 위치를 뜻하지 않습니다.</p>
        <p className="atlas-map-credit">지도: Natural Earth · 산지 좌표: © OpenStreetMap contributors (ODbL)</p>
      </details>
    </section>
  );
}
