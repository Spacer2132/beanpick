function stripHtmlText(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildLabelPattern(label) {
  return label
    .replace(/\s+/g, '')
    .split('')
    .map((ch) => `${ch}\\s*`)
    .join('');
}

function readDetailRow(html, labels) {
  for (const label of labels) {
    const pattern = buildLabelPattern(label);
    const re = new RegExp(
      `<th[^>]*>[^<]*(?:<span[^>]*>)?\\s*${pattern}\\s*(?:</span>)?[^<]*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`,
      'i',
    );
    const m = html.match(re);
    if (m) return stripHtmlText(m[1]);
  }
  return '';
}

function htmlToLines(html) {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|p|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .split(/\n+/)
    .map((line) => line.replace(/^[*\-•·]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// 라벨이 줄 앞에 오고 "라벨 [영문라벨] : 값" 패턴이면 값을 뽑아낸다.
function findLabeledLine(lines, labels) {
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    for (const label of labels) {
      if (!lowerLine.startsWith(label.toLowerCase())) continue;
      const rest = line.slice(label.length);
      const match = rest.match(/^\s*(?:[A-Za-z]+(?:\s+[A-Za-z]+){0,3}\s*)?[:：]\s*(.+)$/);
      if (match) {
        const value = match[1].trim();
        if (value) return value;
      }
    }
  }
  return '';
}

function parseWeightText(value) {
  const text = String(value || '');
  const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  if (kgMatch) return Math.round(Number(kgMatch[1]) * 1000);

  const gramMatch = text.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (!gramMatch) return 0;

  const grams = Math.round(Number(gramMatch[1]));
  return grams >= 30 && grams <= 5000 ? grams : 0;
}

function extractDetailWeight(html) {
  const candidates = [];
  const pushWeight = (value) => {
    const weight = parseWeightText(stripHtmlText(value));
    if (weight > 0) candidates.push(weight);
  };

  for (const match of String(html || '').matchAll(/(?:\\")?option_value_orginal(?:\\")?\s*:\s*\[\s*(?:\\")?([^"\\,\]]+)/gi)) {
    pushWeight(match[1]);
  }

  for (const match of String(html || '').matchAll(/<option\b[^>]*value=["']([^"']*(?:kg|g)[^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi)) {
    pushWeight(match[1] || match[2]);
  }

  pushWeight(readDetailRow(html, ['중량', '용량', 'NET WT', 'Net WT', 'weight']));

  return candidates[0] || 0;
}

function extractMetaDescription(html) {
  const m = String(html || '').match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    || String(html || '').match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  return m ? stripHtmlText(m[1]) : '';
}

function parseCafe24DetailInfo(html) {
  const lines = htmlToLines(html);
  return {
    origin: readDetailRow(html, ['원산지', 'origin'])
      || findLabeledLine(lines, ['원산지', '국가', 'Origin', 'Nation', 'Country']),
    variety: readDetailRow(html, ['품종', 'variety'])
      || findLabeledLine(lines, ['품종', 'Variety', 'Vriety']),
    process: readDetailRow(html, ['가공법', '가공', 'process'])
      || findLabeledLine(lines, ['가공방식', '가공법', '가공', 'Processing Method', 'Processing', 'Process']),
    tastingNotes: readDetailRow(html, ['향미', '컵노트', 'cup notes', 'tasting notes'])
      || findLabeledLine(lines, ['향미', '컵노트', '테이스팅 노트', '테이스팅노트', 'Flavor Notes', 'Tasting Notes', 'Cup Notes']),
    region: readDetailRow(html, ['지역', 'region'])
      || findLabeledLine(lines, ['지역', 'Region', 'Reigon']),
    farm: readDetailRow(html, ['농장', 'farm'])
      || findLabeledLine(lines, ['농장', 'Farm']),
    weight: extractDetailWeight(html),
    description: extractMetaDescription(html),
  };
}

function encodeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildDetailInfoMarker(info) {
  return `<span data-beanpick-detail="${encodeHtmlAttribute(JSON.stringify(info))}"></span>`;
}

function extractDetailContentImageUrls(html) {
  const text = String(html || '');
  const patterns = [
    /<img[^>]+(?:src|ec-data-src)=["']([^"']*\/web\/upload\/NNEditor\/[^"']+\.(?:jpg|jpeg|png|webp))["']/gi,
    /ec-data-src=["']([^"']*\/ec\/[^"']+\.(?:jpg|jpeg|png|webp))["']/gi,
    /ec-data-src=["']([^"']*\/web\/upload\/[^"']+\.(?:jpg|jpeg|png|webp))["']/gi,
  ];
  const urls = [];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) urls.push(m[1]);
  }
  // 중복 제거 + 로고/푸터/아이콘류 배제
  return [...new Set(urls)]
    .filter((u) => !/icon|logo|footer|btn|arrow|cafe24|ini|gong|favicon|csm|directtrade/i.test(u))
    .slice(0, 2);
}

// OCR/설명 텍스트에서 블렌딩 구성 추출. 예: "인도네시아 / Indonesia 40%", "ETHIOPIA NATURAL 60%"
function extractBlendComposition(text) {
  if (!text) return [];
  const COUNTRY_ALIASES = [
    ['에티오피아', /ethiopia|에티오피아/i],
    ['콜롬비아', /colombia|콜롬비아/i],
    ['브라질', /brazil|브라질/i],
    ['과테말라', /guatemala|과테말라/i],
    ['파나마', /panama|파나마/i],
    ['케냐', /kenya|케냐/i],
    ['코스타리카', /costa\s*rica|코스타리카/i],
    ['엘살바도르', /el\s*salvador|엘살바도르/i],
    ['온두라스', /honduras|온두라스/i],
    ['르완다', /rwanda|르완다/i],
    ['니카라과', /nicaragua|니카라과/i],
    ['멕시코', /mexico|멕시코/i],
    ['예멘', /yemen|예멘/i],
    ['페루', /peru|페루/i],
    ['볼리비아', /bolivia|볼리비아/i],
    ['인도네시아', /indonesia|인도네시아/i],
    ['인도', /\bindia\b|인도/i],
    ['파푸아뉴기니', /papua|파푸아/i],
    ['에콰도르', /ecuador|에콰도르/i],
    ['태국', /thailand|태국/i],
  ];
  const grouped = new Map();
  // 라인 단위로 훑고, "% 앞쪽 텍스트"에서 국가 별칭을 찾는다.
  const lines = text.split(/\n|<br\s*\/?>/i);
  for (const rawLine of lines) {
    const line = rawLine.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const pctMatch = line.match(/(\d{1,3})\s*%/);
    if (!pctMatch) continue;
    const percent = Number(pctMatch[1]);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) continue;
    const head = line.slice(0, line.indexOf(pctMatch[0]));
    const country = COUNTRY_ALIASES.find(([, re]) => re.test(head))?.[0];
    if (!country) continue;
    // 같은 국가가 여러 번 나오면 합산 (예: ETHIOPIA NATURAL 60% + ETHIOPIA WASHED 20%)
    grouped.set(country, (grouped.get(country) || 0) + percent);
  }
  const results = [...grouped.entries()].map(([country, percent]) => ({ country, percent }));
  if (results.length < 2) return [];
  const total = results.reduce((s, c) => s + c.percent, 0);
  if (total < 80 || total > 120) return [];
  return results;
}

module.exports = {
  parseCafe24DetailInfo,
  buildDetailInfoMarker,
  extractDetailContentImageUrls,
  extractBlendComposition,
};
