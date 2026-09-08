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

async function geocode(query, iso2, cacheDir) {
  const key = `${iso2}_${query}`.replace(/[^\w가-힣-]/g, '_');
  const cacheFile = path.join(cacheDir, `${key}.json`);
  if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}`
    + `&countrycodes=${iso2}&format=json&limit=1`;
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

  for (const country of COFFEE_COUNTRIES) {
    const table = REGION_QUERY[country.code];
    if (!table) continue;
    const names = (country.famousRegions || '')
      .split('·')
      .map((s) => s.trim().replace(/\(.*\)/, '').trim())
      .filter(Boolean);

    const regions = [];
    for (const ko of names) {
      const query = table[ko];
      if (!query) { failed.push(`${country.label}/${ko}: 영문 검색어 없음`); continue; }
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
      regions.push({ name: ko, en: query, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
      ok += 1;
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
}

main();
