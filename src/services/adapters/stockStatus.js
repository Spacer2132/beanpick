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

export {
  isSoldOutFromHtml,
  stripHiddenStockMarkup,
};
