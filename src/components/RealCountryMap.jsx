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

export default function RealCountryMap({ bounds, regions, selectedRegion, onSelectRegion }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const onSelectRef = useRef(onSelectRegion);
  onSelectRef.current = onSelectRegion;
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
    ]).then(([maplibregl, { default: workerUrl }, , style]) => {
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
      mapRef.current = { maplibregl, map };
      setReady(true);
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
    if (!ready) return;
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
  }, [ready, regions, selectedRegion]);

  return <div ref={containerRef} className="real-country-map" role="region" aria-label="실제 지도" />;
}
