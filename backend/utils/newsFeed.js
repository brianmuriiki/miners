const FEED_URL = 'https://www.coindesk.com/arc/outboundfeeds/rss/';
let cache = { expiresAt: 0, value: null };

function decodeText(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").trim();
}

function getTag(item, tag) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'));
  return match ? decodeText(match[1]) : '';
}

function parseItems(xml) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi)].map(([, item]) => {
    const title = getTag(item, 'title');
    const rawUrl = getTag(item, 'link');
    const publishedAt = getTag(item, 'pubDate');
    let url;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'https:' && parsed.hostname === 'www.coindesk.com') url = parsed.href;
    } catch { /* Skip invalid publisher URLs. */ }
    return { title, url, publishedAt };
  }).filter((item) => item.title && item.url && Number.isFinite(Date.parse(item.publishedAt))).slice(0, 12);
}

exports.getNews = async () => {
  if (cache.value && cache.expiresAt > Date.now()) return cache.value;
  const response = await fetch(FEED_URL, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
  if (!response.ok) throw new Error('News provider unavailable');
  const xml = await response.text();
  if (xml.length > 1_000_000) throw new Error('News feed response is too large');
  const articles = parseItems(xml);
  if (!articles.length) throw new Error('News provider returned no readable articles');
  cache = { value: { source: 'CoinDesk', updatedAt: new Date().toISOString(), articles }, expiresAt: Date.now() + 300_000 };
  return cache.value;
};
