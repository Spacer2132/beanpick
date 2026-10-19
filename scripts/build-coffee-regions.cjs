#!/usr/bin/env node
/**
 * 커피 주요 산지의 좌표를 OpenStreetMap Nominatim으로 조회해
 * src/services/coffeeRegions.js 를 만든다. 결과 파일은 직접 고치지 않는다.
 *
 *   node scripts/build-coffee-regions.cjs [캐시디렉터리]
 *
 * 좌표를 임의로 적지 않는다. 조회 결과가 그 나라 국경(worldCountryPaths.js) 안에
 * 있는지 점-다각형 검사로 확인하고, 통과한 산지만 파일에 넣는다.
 * 투영식은 mapCoordinates.js와 동일하다.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const UA = 'beanpick-map-builder/1.0 (personal coffee app; contact via repo)';
const THROTTLE_MS = 1100; // Nominatim 이용 정책: 초당 1회 이하
// 110m 국경은 거칠어서 국경 마을이 몇 km 밖으로 계산된다. 그만큼만 허용한다(약 10km).
const BORDER_TOLERANCE = 0.25;

// 한국어 산지 이름 → 지오코더 조회용 영문 이름. 좌표가 아니라 "검색어"만 사람이 정한다.
const REGION_QUERY = {
  COL: { 후일라: 'Huila', 나리뇨: 'Nariño', 카우카: 'Cauca', 톨리마: 'Tolima' },
  BRA: { 미나스제라이스: 'Minas Gerais', 세하도: 'Patrocínio, Minas Gerais', 모지아나: 'Mogiana' },
  GTM: { 안티구아: 'Antigua Guatemala', 우에우에테낭고: 'Huehuetenango', 코반: 'Cobán' },
  CRI: { 따라주: 'Tarrazú', 센트럴밸리: 'Valle Central', 브룬카: 'Pérez Zeledón' },
  PAN: { 보케테: 'Boquete', 볼칸: 'Volcán' },
  HND: { 산타바바라: 'Santa Bárbara', 코판: 'Copán', 마르칼라: 'Marcala' },
  PER: { 카하마르카: 'Cajamarca', 쿠스코: 'Cusco', 후닌: 'Junín' },
  SLV: { 아파네카: 'Apaneca', 찰라테낭고: 'Chalatenango' },
  NIC: { 히노테가: 'Jinotega', 마타갈파: 'Matagalpa', 누에바세고비아: 'Nueva Segovia' },
  MEX: { 치아파스: 'Chiapas', 오아하카: 'Oaxaca', 베라크루스: 'Veracruz' },
  ECU: { 피친차: 'Pichincha', 로하: 'Loja', 갈라파고스: 'Galápagos' },
  BOL: { 카라나비: 'Caranavi', 라파스: 'La Paz' },
  ETH: { 예가체프: 'Yirgacheffe', 시다모: 'Sidama', 구지: 'Guji', 하라: 'Harar' },
  KEN: { 니에리: 'Nyeri', 키린야가: 'Kirinyaga', 엠부: 'Embu' },
  RWA: { 후예: 'Huye', 기센이: 'Gisenyi', 냐마셰케: 'Nyamasheke' },
  BDI: { 카얀자: 'Kayanza', 은고지: 'Ngozi', 기테가: 'Gitega' },
  TZA: { 킬리만자로: 'Kilimanjaro Region', 아루샤: 'Arusha', 음베야: 'Mbeya' },
  UGA: { 엘곤산: 'Mount Elgon', 르웬조리: 'Rwenzori Mountains' },
  YEM: { 베니마타르: 'Bani Matar', 하라즈: 'Haraz' },
  IDN: { 수마트라: 'Sumatra', 자바: 'Java', 발리: 'Bali', 술라웨시: 'Sulawesi' },
  IND: { 카르나타카: 'Karnataka', 케랄라: 'Kerala' },
  PNG: { 와기밸리: 'Wahgi Valley', 이스턴하일랜드: 'Eastern Highlands Province' },
  MMR: { 샨주: 'Shan State', 만달레이: 'Mandalay Region' },
};

// 넓은 지역 이름은 지오코더가 그 땅 한가운데(커피를 안 심는 곳)를 돌려준다.
// 그런 산지만 대표점 검색어를 실제 커피 재배 도시로 바꾼다. 영문 이름(en)은 위 표 그대로 쓴다.
const POINT_QUERY = {
  PER: { 쿠스코: 'Quillabamba' },
  ETH: { 구지: 'Shakiso' },
  YEM: { 하라즈: 'Manakhah' },
  IDN: { 수마트라: 'Takengon', 자바: 'Bondowoso', 술라웨시: 'Rantepao' },
  IND: { 카르나타카: 'Chikkamagaluru', 케랄라: 'Kalpetta' },
  MMR: { 샨주: 'Ywangan', 만달레이: 'Pyin Oo Lwin' },
};

// 산지를 고르면 칠할 행정구역 경계의 검색어. 없으면 대표점 검색어로 찾는다.
// 커피 산지가 일부 군에만 몰린 넓은 지역은 그 군들만 적는다.
const AREA_QUERY = {
  GTM: { 안티구아: 'Sacatepéquez' },
  PAN: { 볼칸: 'Tierras Altas' },
  PER: { 쿠스코: 'La Convención' },
  BDI: { 기테가: 'Province de Gitega' },
  TZA: { 아루샤: 'Arusha Region' },
  UGA: { 엘곤산: ['Bududa', 'Manafwa', 'Sironko', 'Bulambuli', 'Kapchorwa', 'Kween'] },
  PNG: { 와기밸리: ['Jiwaka', 'Western Highlands Province'] },
  RWA: { 기센이: 'Rubavu', 후예: 'Huye District' },
  ETH: { 예가체프: 'Gedeo', 구지: 'Guji', 하라: ['Harari', 'East Harerghe', 'West Harerghe'] },
  YEM: { 하라즈: 'Manakhah District' },
  IDN: {
    수마트라: ['Aceh Tengah', 'Bener Meriah', 'Humbang Hasundutan'],
    자바: ['Kabupaten Bondowoso'],
    술라웨시: ['Toraja Utara', 'Tana Toraja'],
  },
  IND: { 카르나타카: ['Chikkamagaluru district', 'Kodagu district', 'Hassan district'], 케랄라: ['Wayanad district', 'Idukki district'] },
  MMR: { 샨주: 'Ywangan Township', 만달레이: 'Pyin Oo Lwin District' },
};
// 경계를 단순하게 줄이는 정도(도 단위, 0.01 ≈ 1km). 클수록 파일이 작아진다.
const AREA_SIMPLIFY = 0.01;

const ISO2 = {
  COL: 'co', BRA: 'br', GTM: 'gt', CRI: 'cr', PAN: 'pa', HND: 'hn', PER: 'pe', SLV: 'sv',
  NIC: 'ni', MEX: 'mx', ECU: 'ec', BOL: 'bo', ETH: 'et', KEN: 'ke', RWA: 'rw', BDI: 'bi',
  TZA: 'tz', UGA: 'ug', YEM: 'ye', IDN: 'id', IND: 'in', PNG: 'pg', MMR: 'mm',
};

const projX = (lng) => ((lng + 180) / 360) * 1000;
const projY = (lat) => ((90 - lat) / 180) * 500;

function loadJsModule(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const out = esbuild.transformSync(code, { loader: 'js', format: 'cjs', target: 'es2020' }).code;
  const mod = { exports: {} };
  new Function('exports', 'module', 'require', out)(mod.exports, mod, require);
  return mod.exports;
}

// "M x y L x y ... Z" 문자열을 링 배열로 되돌린다.
function parseRings(d) {
  return d.split('M').filter(Boolean).map((chunk) => {
    const nums = chunk.replace(/Z/g, '').match(/-?\d+(\.\d+)?/g) || [];
    const ring = [];
    for (let i = 0; i + 1 < nums.length; i += 2) ring.push([Number(nums[i]), Number(nums[i + 1])]);
    return ring;
  });
}

// 점에서 다각형 변까지의 최단 거리 (투영 단위, 1단위 ≈ 40km)
function distanceToRings(px, py, rings) {
  let min = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j];
      const b = ring[i];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      let t = len2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      min = Math.min(min, Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy)));
    }
  }
  return min;
}

function pointInRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(query, iso2, cacheDir, withArea = false) {
  const key = `${withArea ? 'area_' : ''}${iso2}_${query}`.replace(/[^\w가-힣-]/g, '_');
  const cacheFile = path.join(cacheDir, `${key}.json`);
  if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}`
    + `&countrycodes=${iso2}&format=json&limit=1`
    + (withArea ? `&polygon_geojson=1&polygon_threshold=${AREA_SIMPLIFY}` : '');
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${query}`);
  const json = await res.json();
  fs.writeFileSync(cacheFile, JSON.stringify(json));
  await sleep(THROTTLE_MS);
  return json;
}

async function main() {
  const cacheDir = process.argv[2] || path.resolve(__dirname, '../.geocode-cache');
  fs.mkdirSync(cacheDir, { recursive: true });

  const { COFFEE_COUNTRIES } = loadJsModule(path.resolve(__dirname, '../src/services/mapCoordinates.js'));
  const { COFFEE_COUNTRY_PATHS } = loadJsModule(path.resolve(__dirname, '../src/components/worldCountryPaths.js'));
  const ringsByCode = Object.fromEntries(
    Object.entries(COFFEE_COUNTRY_PATHS).map(([code, d]) => [code, parseRings(d)]),
  );

  const result = {};
  const failed = [];
  let ok = 0;
  const areas = {};
  const areaFailed = [];
  let areaOk = 0;

  for (const country of COFFEE_COUNTRIES) {
    const table = REGION_QUERY[country.code];
    if (!table) continue;
    const names = (country.famousRegions || '')
      .split('·')
      .map((s) => s.trim().replace(/\(.*\)/, '').trim())
      .filter(Boolean);

    const regions = [];
    for (const ko of names) {
      const en = table[ko];
      if (!en) { failed.push(`${country.label}/${ko}: 영문 검색어 없음`); continue; }
      const query = POINT_QUERY[country.code]?.[ko] || en;
      let hits;
      try {
        hits = await geocode(query, ISO2[country.code], cacheDir);
      } catch (e) {
        failed.push(`${country.label}/${ko}: 조회 실패 (${e.message})`);
        continue;
      }
      if (!hits || !hits.length) { failed.push(`${country.label}/${ko}: 결과 없음 (${query})`); continue; }

      const lat = Number(hits[0].lat);
      const lng = Number(hits[0].lon);
      const x = projX(lng);
      const y = projY(lat);
      const rings = ringsByCode[country.code] || [];
      const inside = rings.filter((r) => pointInRing(x, y, r)).length % 2 === 1;
      const gap = inside ? 0 : distanceToRings(x, y, rings);
      if (!inside && gap > BORDER_TOLERANCE) {
        failed.push(`${country.label}/${ko}: 국경에서 ${(gap * 40.075).toFixed(0)}km 밖 (${lat.toFixed(3)}, ${lng.toFixed(3)})`);
        continue;
      }
      regions.push({ name: ko, en, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
      ok += 1;

      // 행정구역 경계: 바깥 테두리만 남기고, 대표점이 그 안에 있어야 쓴다(엉뚱한 동명 지역 거르기).
      const areaRings = [];
      for (const areaQuery of [].concat(AREA_QUERY[country.code]?.[ko] || query)) {
        let areaHits;
        try {
          areaHits = await geocode(areaQuery, ISO2[country.code], cacheDir, true);
        } catch (e) {
          areaFailed.push(`${country.label}/${ko}: 경계 조회 실패 ${areaQuery} (${e.message})`);
          continue;
        }
        const geo = areaHits?.[0]?.geojson;
        const polys = geo?.type === 'Polygon' ? [geo.coordinates] : geo?.type === 'MultiPolygon' ? geo.coordinates : [];
        if (!polys.length) { areaFailed.push(`${country.label}/${ko}: 경계 없음 ${areaQuery} (${geo?.type || '결과 없음'})`); continue; }
        polys.forEach((poly) => areaRings.push(poly[0].map(([a, b]) => [Number(a.toFixed(3)), Number(b.toFixed(3))])));
      }
      if (!areaRings.length) continue;
      if (!areaRings.some((ring) => pointInRing(lng, lat, ring))) {
        areaFailed.push(`${country.label}/${ko}: 대표점이 경계 밖이라 제외`);
        continue;
      }
      areas[country.code] = { ...areas[country.code], [ko]: areaRings };
      areaOk += 1;
    }
    if (regions.length) result[country.code] = regions;
  }

  const lines = [
    '// 자동 생성 파일 — scripts/build-coffee-regions.cjs 로 다시 만든다. 직접 고치지 말 것.',
    '// 좌표 출처: OpenStreetMap Nominatim (ODbL). 각 좌표는 해당 국가 국경 안에 있는지 검사를 통과한 것만 담겨 있다.',
    '// x, y는 mapCoordinates.js와 같은 등장방형 투영(1000 x 500) 값이다.',
    '',
    'export const COFFEE_REGION_POINTS = {',
    ...Object.entries(result).map(([code, rs]) => `  ${code}: [\n${rs
      .map((r) => `    { name: '${r.name}', en: '${r.en}', x: ${r.x}, y: ${r.y} },`)
      .join('\n')}\n  ],`),
    '};',
    '',
  ].join('\n');

  const dest = path.resolve(__dirname, '../src/services/coffeeRegions.js');
  fs.writeFileSync(dest, lines.replace(/\n/g, '\r\n'));

  console.log(`생성 완료: ${dest}`);
  console.log(`  국경 검사 통과 ${ok}개 / 나라 ${Object.keys(result).length}개`);
  if (failed.length) {
    console.log(`  제외 ${failed.length}개:`);
    failed.forEach((f) => console.log(`    - ${f}`));
  }

  const areaLines = [
    '// 자동 생성 파일 — scripts/build-coffee-regions.cjs 로 다시 만든다. 직접 고치지 말 것.',
    '// 경계 출처: OpenStreetMap Nominatim (ODbL). 산지의 행정구역 경계이며 실제 재배지 전체와 같지는 않다.',
    '// 나라 코드 → 산지 이름 → 바깥 테두리 목록([경도, 위도] 배열). 대표점이 경계 안에 있는 것만 담았다.',
    '',
    'export const COFFEE_REGION_AREAS = {',
    ...Object.entries(areas).map(([code, byName]) => `  ${code}: {\n${Object.entries(byName)
      .map(([ko, rings]) => `    '${ko}': ${JSON.stringify(rings)},`)
      .join('\n')}\n  },`),
    '};',
    '',
  ].join('\n');
  const areaDest = path.resolve(__dirname, '../src/services/coffeeRegionAreas.js');
  fs.writeFileSync(areaDest, areaLines.replace(/\n/g, '\r\n'));
  console.log(`경계 생성: ${areaDest} — ${areaOk}개 산지`);
  if (areaFailed.length) {
    console.log(`  경계 제외 ${areaFailed.length}개:`);
    areaFailed.forEach((f) => console.log(`    - ${f}`));
  }
}

main();
