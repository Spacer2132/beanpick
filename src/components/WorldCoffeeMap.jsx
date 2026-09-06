import React, { useMemo, useState } from 'react';
import {
  COFFEE_BELT_BOUNDS,
  COFFEE_COUNTRIES,
  extractProductCountries,
} from '../services/mapCoordinates.js';

// 1000 x 500 Equirectangular 뷰박스 기준 세계지도 대륙 윤곽선 벡터
const CONTINENT_PATHS = [
  // 1. 북아메리카 (알래스카 ~ 캐나다 ~ 미국 ~ 멕시코)
  'M 120 65 Q 160 45 230 50 Q 280 60 295 90 Q 280 120 250 145 Q 235 170 215 195 L 205 185 Q 185 145 160 135 Q 130 115 120 65 Z M 215 195 L 245 208 L 265 218 L 255 224 L 230 210 Z',
  
  // 2. 중앙아메리카 & 카리브해 연결
  'M 245 208 Q 260 215 275 225 L 285 228 L 280 234 L 265 224 Z',

  // 3. 남아메리카 (콜롬비아 ~ 브라질 ~ 칠레/아르헨티나)
  'M 275 225 Q 310 215 345 230 Q 395 260 395 295 Q 380 345 350 400 Q 320 445 305 465 Q 295 440 290 390 Q 280 330 268 280 Q 265 245 275 225 Z',

  // 4. 유럽
  'M 470 65 Q 510 50 550 65 Q 560 95 530 125 Q 500 145 470 140 Q 455 105 470 65 Z',

  // 5. 아프리카 & 마다가스카르
  'M 465 155 Q 545 150 585 175 Q 635 205 640 235 Q 625 295 590 350 Q 555 390 525 390 Q 485 345 465 265 Q 445 215 465 155 Z M 645 315 Q 660 335 650 375 Q 635 365 638 335 Z',

  // 6. 유라시아 (중동, 인도 아대륙, 동남아, 중국, 러시아)
  'M 545 150 Q 640 95 760 85 Q 860 95 895 135 Q 875 195 825 225 Q 785 220 765 235 Q 745 265 725 265 Q 710 240 685 215 Q 645 205 615 215 Q 585 190 545 150 Z',

  // 7. 아라비아 반도
  'M 615 205 Q 650 200 660 225 Q 645 255 625 250 Q 610 230 615 205 Z',

  // 8. 인도 아대륙 (커피 주요 생산지)
  'M 700 215 Q 730 215 735 240 Q 720 275 705 270 Q 695 245 700 215 Z',

  // 9. 동남아 인도차이나 & 말레이 반도
  'M 765 225 Q 790 235 780 270 Q 765 265 765 225 Z',

  // 10. 인도네시아 제도 (수마트라, 자바, 보르네오, 술라웨시)
  'M 765 275 Q 790 290 775 305 Q 755 295 765 275 Z M 800 270 Q 830 275 825 300 Q 800 295 800 270 Z M 785 310 Q 830 315 820 325 Q 780 320 785 310 Z',

  // 11. 파푸아뉴기니 및 오세아니아 (호주)
  'M 885 265 Q 925 270 910 295 Q 875 285 885 265 Z M 830 345 Q 920 335 930 405 Q 850 435 830 345 Z',
];

export default function WorldCoffeeMap({
  products = [],
  selectedCountry = null,
  highlightedCountries = [],
  onSelectCountry,
}) {
  const [hoveredCountry, setHoveredCountry] = useState(null);

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

  return (
    <div className="coffee-map-container" style={{ touchAction: 'pan-y' }}>
      <div className="coffee-map-header">
        <div className="coffee-map-title-row">
          <div className="coffee-map-title">
            <span className="coffee-belt-indicator" />
            <span>Coffee Belt 세계지도 탐색</span>
          </div>
          {selectedCountry && (
            <button
              type="button"
              className="coffee-map-reset-btn"
              onClick={() => onSelectCountry?.(null)}
            >
              전체 보기 취소 ✕
            </button>
          )}
        </div>
        <div className="coffee-map-subtitle">
          {selectedCountry ? (
            <span>
              선택된 국가: <strong>{selectedCountry}</strong> ({activeCount}개 원두)
            </span>
          ) : highlightedCountries.length > 0 ? (
            <span>
              원두 생산지: <strong>{highlightedCountries.join(', ')}</strong>
            </span>
          ) : (
            <span>원두나 지도 핀을 클릭하면 생산지가 강조 표시됩니다.</span>
          )}
        </div>
      </div>

      <div className="coffee-map-svg-wrap">
        <svg
          viewBox="0 0 1000 500"
          className="coffee-world-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* 바다 그라데이션 */}
            <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f7f3ec" />
              <stop offset="50%" stopColor="#f3ede3" />
              <stop offset="100%" stopColor="#ece3d5" />
            </linearGradient>

            {/* 커피 벨트 그라데이션 */}
            <linearGradient id="coffeeBeltGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#c78a3b" stopOpacity="0.04" />
              <stop offset="50%" stopColor="#8f4f2e" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#c78a3b" stopOpacity="0.04" />
            </linearGradient>

            {/* 활성 핀 펄스 필터 */}
            <filter id="pinGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#8f4f2e" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* 1. 바다 배경 */}
          <rect width="1000" height="500" rx="14" fill="url(#oceanGrad)" />

          {/* 2. 커피 벨트 (남위 25° ~ 북위 25°) 하이라이트 밴드 */}
          <rect
            x="0"
            y={COFFEE_BELT_BOUNDS.topY}
            width="1000"
            height={COFFEE_BELT_BOUNDS.height}
            fill="url(#coffeeBeltGrad)"
          />
          {/* 커피 벨트 한계선 점선 */}
          <line
            x1="0"
            y1={COFFEE_BELT_BOUNDS.topY}
            x2="1000"
            y2={COFFEE_BELT_BOUNDS.topY}
            stroke="#d4c3ae"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1={COFFEE_BELT_BOUNDS.bottomY}
            x2="1000"
            y2={COFFEE_BELT_BOUNDS.bottomY}
            stroke="#d4c3ae"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <text
            x="20"
            y={COFFEE_BELT_BOUNDS.topY + 16}
            fill="#b9aa99"
            fontSize="10"
            fontWeight="600"
            letterSpacing="1"
          >
            TROPIC OF CANCER (23.5°N)
          </text>
          <text
            x="20"
            y={COFFEE_BELT_BOUNDS.bottomY - 8}
            fill="#b9aa99"
            fontSize="10"
            fontWeight="600"
            letterSpacing="1"
          >
            TROPIC OF CAPRICORN (23.5°S)
          </text>
          <text
            x="980"
            y="254"
            textAnchor="end"
            fill="#a69482"
            fontSize="11"
            fontWeight="700"
            letterSpacing="2"
            opacity="0.6"
          >
            COFFEE BELT
          </text>

          {/* 3. 대륙 실루엣 */}
          <g className="map-continents">
            {CONTINENT_PATHS.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="#e4d8c8"
                stroke="#d2c0ad"
                strokeWidth="1.2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </g>

          {/* 4. 생산국 핀 마커 */}
          <g className="map-pins">
            {COFFEE_COUNTRIES.map((country) => {
              const count = countryCounts.get(country.label) || 0;
              const isSelected = selectedCountry === country.label;
              const isHighlighted = highlightedCountries.includes(country.label);
              const isHovered = hoveredCountry === country.label;
              const hasBeans = count > 0;

              // 시각적 강조 우선순위
              const isActive = isSelected || isHighlighted || isHovered;

              return (
                <g
                  key={country.code}
                  className={`coffee-pin-group ${isActive ? 'is-active' : ''} ${hasBeans ? 'has-beans' : 'no-beans'}`}
                  transform={`translate(${country.x}, ${country.y})`}
                  onClick={() => onSelectCountry?.(isSelected ? null : country.label)}
                  onMouseEnter={() => setHoveredCountry(country.label)}
                  onMouseLeave={() => setHoveredCountry(null)}
                  style={{ cursor: hasBeans ? 'pointer' : 'default' }}
                >
                  {/* 선택/하이라이트 시 펄스 링 */}
                  {isActive && (
                    <circle
                      r="16"
                      fill="none"
                      stroke="#8f4f2e"
                      strokeWidth="2"
                      opacity="0.6"
                      className="coffee-pin-pulse"
                    />
                  )}

                  {/* 외부 원 */}
                  <circle
                    r={isActive ? 11 : hasBeans ? 8 : 4}
                    fill={isActive ? '#8f4f2e' : hasBeans ? '#64351f' : '#b9aa99'}
                    stroke="#ffffff"
                    strokeWidth={isActive ? 2.5 : 1.5}
                    filter={isActive ? 'url(#pinGlow)' : undefined}
                    style={{ transition: 'all 0.2s ease-out' }}
                  />

                  {/* 원두 개수 표시 (있을 때만) */}
                  {hasBeans && (
                    <text
                      textAnchor="middle"
                      dy={isActive ? 3.5 : 3}
                      fill="#ffffff"
                      fontSize={isActive ? 9 : 7}
                      fontWeight="700"
                    >
                      {count}
                    </text>
                  )}

                  {/* 국가 라벨 (활성화되었거나 원두 수가 많은 대표 국가) */}
                  {(isActive || count >= 10) && (
                    <text
                      textAnchor="middle"
                      y={isActive ? 22 : 18}
                      fill={isActive ? '#64351f' : '#7d6f63'}
                      fontSize={isActive ? 11 : 9}
                      fontWeight={isActive ? '700' : '600'}
                      className="coffee-pin-label"
                    >
                      {country.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* 5. 툴팁 팝업 (호버 또는 선택 시) */}
          {activeCountryInfo && (
            <g
              className="coffee-map-tooltip"
              transform={`translate(${activeCountryInfo.x}, ${activeCountryInfo.y - 28})`}
              pointerEvents="none"
            >
              <rect
                x="-55"
                y="-24"
                width="110"
                height="26"
                rx="6"
                fill="#231b16"
                opacity="0.92"
              />
              <text
                x="0"
                y="-7"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10.5"
                fontWeight="600"
              >
                {activeCountryInfo.label} · {activeCount}개 원두
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
