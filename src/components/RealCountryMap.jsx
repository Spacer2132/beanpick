import React, { useEffect, useRef, useState } from 'react';

// 나라를 고르면 세계지도 대신 보여 주는 실제 지도. 손가락으로 확대·이동하고, 산지 점을 누르면 그 산지를 고른다.
// 지도 그림 주소. 다른 지도(CARTO 등)로 바꿀 때는 이 두 값만 바꾼다.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// 지도 데이터 좌표(1000 x 500 등장방형)를 위도·경도로 바꾼다.
const toLatLng = (x, y) => [90 - y * 0.36, x * 0.36 - 180];

export default function RealCountryMap({ bounds, regions, selectedRegion, onSelectRegion }) {
  const containerRef = useRef(null);
  const leafletRef = useRef(null);
  const onSelectRef = useRef(onSelectRegion);
  onSelectRef.current = onSelectRegion;
  const [ready, setReady] = useState(false);

  // 지도 라이브러리는 이 화면을 처음 열 때만 불러와 첫 화면 로딩을 무겁게 하지 않는다.
  useEffect(() => {
    let cancelled = false;
    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([{ default: L }]) => {
      if (cancelled) return;
      const map = L.map(containerRef.current, { zoomSnap: 0.5 });
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);
      map.fitBounds([toLatLng(bounds.minX, bounds.maxY), toLatLng(bounds.maxX, bounds.minY)], { padding: [16, 16] });
      leafletRef.current = { L, map, dots: L.layerGroup().addTo(map) };
      setReady(true);
    });
    return () => {
      cancelled = true;
      leafletRef.current?.map.remove();
      leafletRef.current = null;
      setReady(false);
    };
  }, [bounds]);

  // 산지 점과 한국어 이름표. 고른 산지는 강조한다.
  useEffect(() => {
    if (!ready) return;
    const { L, dots } = leafletRef.current;
    dots.clearLayers();
    regions.forEach((region) => {
      const active = region.name === selectedRegion;
      L.circleMarker(toLatLng(region.x, region.y), { radius: active ? 9 : 7, className: `real-map-dot ${active ? 'is-active' : ''}` })
        .bindTooltip(region.name, { permanent: true, direction: 'top', offset: [0, -8], className: `real-map-label ${active ? 'is-active' : ''}` })
        .on('click', () => onSelectRef.current(region.name))
        .addTo(dots);
    });
  }, [ready, regions, selectedRegion]);

  return <div ref={containerRef} className="real-country-map" role="region" aria-label="실제 지도" />;
}
