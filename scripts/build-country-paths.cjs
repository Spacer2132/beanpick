#!/usr/bin/env node
/**
 * Natural Earth 110m 국가 경계(GeoJSON)를 지도 SVG용 path 문자열로 변환한다.
 * 결과는 src/components/worldCountryPaths.js 로 저장되며, 이 파일은 직접 고치지 않는다.
 *
 *   node scripts/build-country-paths.cjs <ne_110m_admin_0_countries.geojson>
 *
 * 투영식은 src/services/mapCoordinates.js 의 핀 좌표와 반드시 같아야 한다(등장방형).
 *   x = ((lng + 180) / 360) * 1000
 *   y = ((90 - lat) / 180) * 500
 */
const fs = require('fs');
const path = require('path');

const COFFEE_ISO = [
  'COL', 'BRA', 'GTM', 'CRI', 'PAN', 'HND', 'PER', 'SLV', 'NIC', 'MEX', 'ECU', 'BOL',
  'ETH', 'KEN', 'RWA', 'BDI', 'TZA', 'UGA', 'YEM', 'IDN', 'IND', 'PNG', 'MMR',
];

const DECIMALS = 1;

const projX = (lng) => ((lng + 180) / 360) * 1000;
const projY = (lat) => ((90 - lat) / 180) * 500;
const round = (n) => Number(n.toFixed(DECIMALS));

function ringToPath(ring) {
  const pts = [];
  let prev = null;
  for (const [lng, lat] of ring) {
    const x = round(projX(lng));
    const y = round(projY(lat));
    if (prev && prev[0] === x && prev[1] === y) continue; // 반올림 후 중복점 제거
    pts.push([x, y]);
    prev = [x, y];
  }
  if (pts.length < 3) return '';
  return `M${pts.map((p) => `${p[0]} ${p[1]}`).join('L')}Z`;
}

function featureToPath(feature) {
  const geom = feature.geometry;
  if (!geom) return '';
  const polys = geom.type === 'Polygon' ? [geom.coordinates]
    : geom.type === 'MultiPolygon' ? geom.coordinates
      : [];
  const parts = [];
  for (const poly of polys) {
    for (const ring of poly) {
      const d = ringToPath(ring);
      if (d) parts.push(d);
    }
  }
  return parts.join('');
}

function main() {
  const src = process.argv[2];
  if (!src || !fs.existsSync(src)) {
    console.error('사용법: node scripts/build-country-paths.cjs <ne_110m_admin_0_countries.geojson>');
    process.exit(1);
  }
  const geo = JSON.parse(fs.readFileSync(src, 'utf8'));

  const coffee = {};
  const others = [];
  let dropped = 0;

  for (const f of geo.features) {
    const iso = f.properties.ISO_A3 && f.properties.ISO_A3 !== '-99'
      ? f.properties.ISO_A3
      : f.properties.ADM0_A3;
    const d = featureToPath(f);
    if (!d) { dropped += 1; continue; }
    if (COFFEE_ISO.includes(iso)) coffee[iso] = d;
    else others.push(d);
  }

  const missing = COFFEE_ISO.filter((c) => !coffee[c]);
  if (missing.length) {
    console.error('커피 생산국 경계 누락:', missing.join(', '));
    process.exit(1);
  }

  const out = [
    '// 자동 생성 파일 — scripts/build-country-paths.cjs 로 다시 만든다. 직접 고치지 말 것.',
    '// 출처: Natural Earth 110m admin_0 countries (public domain)',
    '',
    'export const COFFEE_COUNTRY_PATHS = {',
    ...COFFEE_ISO.map((c) => `  ${c}: "${coffee[c]}",`),
    '};',
    '',
    'export const OTHER_COUNTRY_PATHS = [',
    ...others.map((d) => `  "${d}",`),
    '];',
    '',
  ].join('\n');

  const dest = path.resolve(__dirname, '../src/components/worldCountryPaths.js');
  fs.writeFileSync(dest, out.replace(/\n/g, '\r\n'));

  const bytes = fs.statSync(dest).size;
  console.log(`생성 완료: ${dest}`);
  console.log(`  커피 생산국 ${Object.keys(coffee).length}개 / 그 밖의 나라 ${others.length}개 / 링 없어 제외 ${dropped}개`);
  console.log(`  파일 크기 ${(bytes / 1024).toFixed(1)} KB (좌표 소수점 ${DECIMALS}자리)`);
}

main();
