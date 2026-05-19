function stripHiddenStockMarkup(html) {
  let next = String(html || '');
  let previous = '';
  const hiddenElementPatterns = [
    /<a\b(?=[^>]*(?:\bdisplaynone\b|display\s*:\s*none|visibility\s*:\s*hidden))[^>]*>[\s\S]*?<\/a>/gi,
    /<div\b(?=[^>]*(?:\bdisplaynone\b|display\s*:\s*none|visibility\s*:\s*hidden))[^>]*>[\s\S]*?<\/div>/gi,
    /<span\b(?=[^>]*(?:\bdisplaynone\b|display\s*:\s*none|visibility\s*:\s*hidden))[^>]*>[\s\S]*?<\/span>/gi,
    /<p\b(?=[^>]*(?:\bdisplaynone\b|display\s*:\s*none|visibility\s*:\s*hidden))[^>]*>[\s\S]*?<\/p>/gi,
    /<li\b(?=[^>]*(?:\bdisplaynone\b|display\s*:\s*none|visibility\s*:\s*hidden))[^>]*>[\s\S]*?<\/li>/gi,
  ];

  while (next !== previous) {
    previous = next;
    hiddenElementPatterns.forEach((pattern) => {
      next = next.replace(pattern, ' ');
    });
  }

  return next.replace(/<[^>]+\b(?:displaynone\b|display\s*:\s*none|visibility\s*:\s*hidden)[^>]*\/?>/gi, ' ');
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSoldOutFromHtml(html) {
  const visibleHtml = stripHiddenStockMarkup(html);
  const visibleText = stripHtml(visibleHtml);

  return /<img[^>]+(?:alt|title)=["'][^"']*(?:품절|일시품절|sold\s*out|soldout)[^"']*["']/i.test(visibleHtml)
    || /(?:품절|일시품절|\bsold\s*out\b|\bsoldout\b)/i.test(visibleText);
}

function extractCafe24ListItemLinks(html, origin) {
  const blocks = [...String(html || '').matchAll(/<li\s+id=["']anchorBoxId_([^"']+)["'][\s\S]*?(?=<li\s+id=["']anchorBoxId_|<\/ul>)/gi)];
  const seen = new Set();
  const items = [];
  for (const match of blocks) {
    const productNo = match[1];
    if (seen.has(productNo)) continue;
    const block = match[0];
    const href = block.match(/<a[^>]+href=["']([^"']*\/product\/[^"']+)["']/i)?.[1] || '';
    if (!href) continue;
    const detailUrl = href.startsWith('http')
      ? href
      : href.startsWith('//')
        ? `https:${href}`
        : `${origin}${href.startsWith('/') ? '' : '/'}${href}`;
    items.push({ productNo, detailUrl });
    seen.add(productNo);
  }
  return items;
}

function stripCafe24FalseSoldOutMarkup(html, soldOutByProductNo) {
  if (!html) return html;
  const map = soldOutByProductNo instanceof Map
    ? soldOutByProductNo
    : new Map(Object.entries(soldOutByProductNo || {}));
  return String(html).replace(
    /(<li\s+id=["']anchorBoxId_([^"']+)["'][\s\S]*?)(?=<li\s+id=["']anchorBoxId_|<\/ul>)/gi,
    (block, _prefix, productNo) => {
      if (!map.has(productNo)) return block;
      if (map.get(productNo) === true) return block;
      return block.replace(/<div\s+class=["']sold["'][^>]*>[\s\S]*?<\/div>/i, '<!-- soldout-stripped -->');
    },
  );
}

module.exports = {
  isSoldOutFromHtml,
  stripHiddenStockMarkup,
  extractCafe24ListItemLinks,
  stripCafe24FalseSoldOutMarkup,
};
