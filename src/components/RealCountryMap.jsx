import React, { useEffect, useRef, useState } from 'react';

// 나라를 고르면 세계지도 대신 보여 주는 실제 지도. 손가락으로 확대·이동하고, 산지 점을 누르면 그 산지를 고른다.
// 지도 스타일 주소(OpenFreeMap, 무료·키 없음). 다른 지도로 바꿀 때는 이 값만 바꾼다.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// 지도 데이터 좌표(1000 x 500 등장방형)를 경도·위도로 바꾼다.
const toLngLat = (x, y) => [x * 0.36 - 180, 90 - y * 0.36];

// 바탕 지도의 지명을 한국어 이름이 있으면 한국어로, 없으면 원래 이름으로 보여 준다.
function applyKoreanLabels(style) {
  style.layers.forEach((layer) => {
    if (layer.layout?.['text-field']) {
      layer.layout['text-field'] = ['coalesce', ['get', 'name:ko'], ['get', 'name']];
    }
  });
  return style;
}

const EMPTY_AREA = { type: 'FeatureCollection', features: [] };

// 행정 경계가 없는 산지는 대표점 둘레 반지름 20km 원을 대략적인 영역으로 쓴다(실제 경계 아님).
function circleRing([lng, lat], km = 20) {
  const dLat = km / 111;
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  return Array.from({ length: 33 }, (_, i) => {
    const t = (i / 32) * 2 * Math.PI;
    return [lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)];
  });
}

export default function RealCountryMap({ countryCode, bounds, regions, otherRegions, selectedRegion, onSelectRegion, onSelectOtherRegion }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const onSelectRef = useRef(onSelectRegion);
  onSelectRef.current = onSelectRegion;
  const onSelectOtherRef = useRef(onSelectOtherRegion);
  onSelectOtherRef.current = onSelectOtherRegion;
  const [ready, setReady] = useState(false);

  // 지도 라이브러리는 이 화면을 처음 열 때만 불러와 첫 화면 로딩을 무겁게 하지 않는다.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import('maplibre-gl'),
      // 지도 계산용 워커는 Vite가 따로 묶은 파일 주소를 알려 줘야 한다(기본값은 번들 옆 파일을 찾는다).
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
      import('maplibre-gl/dist/maplibre-gl.css'),
      fetch(STYLE_URL).then((response) => response.json()),
      import('../services/coffeeRegionAreas.js'),
    ]).then(([maplibregl, { default: workerUrl }, , style, { COFFEE_REGION_AREAS }]) => {
      if (cancelled) return;
      maplibregl.setWorkerUrl(workerUrl);
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: applyKoreanLabels(style),
        bounds: [toLngLat(bounds.minX, bounds.maxY), toLngLat(bounds.maxX, bounds.minY)],
        fitBoundsOptions: { padding: 16 },
        dragRotate: false,
        pitchWithRotate: false,
        // 출처는 접는 버튼 없이 작은 한 줄로 늘 보이게 한다.
        attributionControl: { compact: false },
      });
      map.touchZoomRotate.disableRotation();
      mapRef.current = { maplibregl, map, areas: COFFEE_REGION_AREAS };
      // 고른 산지의 행정구역 경계를 반투명으로 칠한다. 지명이 가려지지 않게 글자 층 아래에 넣는다.
      map.on('load', () => {
        const accent = getComputedStyle(containerRef.current).getPropertyValue('--accent').trim() || '#7a4a2a';
        const beforeId = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
        map.addSource('region-area', { type: 'geojson', data: EMPTY_AREA });
        map.addLayer({ id: 'region-area-fill', type: 'fill', source: 'region-area', paint: { 'fill-color': accent, 'fill-opacity': 0.2 } }, beforeId);
        map.addLayer({ id: 'region-area-line', type: 'line', source: 'region-area', paint: { 'line-color': accent, 'line-width': 1.5, 'line-opacity': 0.7 } }, beforeId);
        setReady(true);
      });
    });
    return () => {
      cancelled = true;
      mapRef.current?.map.remove();
      mapRef.current = null;
      markersRef.current = [];
      setReady(false);
    };
  }, [bounds]);

  // 산지 점과 한국어 이름표. 고른 산지는 강조한다.
  useEffect(() => {
    // 나라가 바뀌는 순간에는 이전 지도가 이미 정리돼 있으므로 새 지도가 준비될 때까지 기다린다.
    if (!ready || !mapRef.current) return;
    const { maplibregl, map } = mapRef.current;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = regions.map((region) => {
      const active = region.name === selectedRegion;
      const element = document.createElement('button');
      element.type = 'button';
      element.className = `real-map-marker ${active ? 'is-active' : ''}`;
      element.innerHTML = '<span class="real-map-label"></span><span class="real-map-dot"></span>';
      element.firstChild.textContent = region.name;
      element.setAttribute('aria-label', region.name);
      element.addEventListener('click', () => onSelectRef.current(region.name));
      return new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat(toLngLat(region.x, region.y)).addTo(map);
    });
    // 이웃 나라 산지는 흐리게 찍고, 누르면 그 나라로 넘어가 그 산지를 고른다.
    otherRegions.forEach((region) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'real-map-marker is-other';
      element.innerHTML = '<span class="real-map-label"></span><span class="real-map-dot"></span>';
      element.firstChild.textContent = region.name;
      element.setAttribute('aria-label', `${region.country} ${region.name}`);
      element.addEventListener('click', () => onSelectOtherRef.current(region.country, region.name));
      markersRef.current.push(new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat(toLngLat(region.x, region.y)).addTo(map));
    });
    const point = regions.find((region) => region.name === selectedRegion);
    const rings = mapRef.current.areas[countryCode]?.[selectedRegion] || (point && [circleRing(toLngLat(point.x, point.y))]);
    map.getSource('region-area').setData(rings
      ? { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: rings.map((ring) => [ring]) } }
      : EMPTY_AREA);
    // 고른 산지 영역이 화면에 차게 확대하고, 선택을 풀면 나라 전체로 돌아간다.
    if (rings) {
      const lngs = rings.flat().map(([lng]) => lng);
      const lats = rings.flat().map(([, lat]) => lat);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 48, maxZoom: 9 });
    } else {
      map.fitBounds([toLngLat(bounds.minX, bounds.maxY), toLngLat(bounds.maxX, bounds.minY)], { padding: 16 });
    }
  }, [ready, regions, otherRegions, selectedRegion, countryCode, bounds]);

  return <div ref={containerRef} className="real-country-map" role="region" aria-label="실제 지도" />;
}
