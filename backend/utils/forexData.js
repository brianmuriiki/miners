const httpError = require('./httpError');

const CURRENCY_PAIRS = {
  'USD-KES': { base: 'USD', quote: 'KES', label: 'US dollar / Kenyan shilling' },
  'EUR-USD': { base: 'EUR', quote: 'USD', label: 'Euro / US dollar' },
  'GBP-USD': { base: 'GBP', quote: 'USD', label: 'British pound / US dollar' },
  'USD-JPY': { base: 'USD', quote: 'JPY', label: 'US dollar / Japanese yen' },
  'USD-CAD': { base: 'USD', quote: 'CAD', label: 'US dollar / Canadian dollar' },
  'AUD-USD': { base: 'AUD', quote: 'USD', label: 'Australian dollar / US dollar' },
};
const PERIOD_MONTHS = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 };
const cache = new Map();

function dateMonthsAgo(months) {
  const now = new Date();
  const day = now.getUTCDate();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  start.setUTCMonth(start.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  start.setUTCDate(Math.min(day, lastDay));
  return start.toISOString().slice(0, 10);
}

exports.CURRENCY_PAIRS = CURRENCY_PAIRS;

exports.getForexHistory = async (pairId, period) => {
  const pair = CURRENCY_PAIRS[pairId];
  const months = PERIOD_MONTHS[period];
  if (!pair || !months) throw httpError(400, 'Unsupported currency pair or chart period');
  const cacheKey = `${pairId}:${period}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const from = dateMonthsAgo(months);
  const to = new Date().toISOString().slice(0, 10);
  const url = new URL('https://api.frankfurter.dev/v2/rates');
  url.search = new URLSearchParams({ base: pair.base, quotes: pair.quote, from, to }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Forex data provider unavailable');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Forex data response is invalid');
  const points = rows
    .filter((row) => row && row.base === pair.base && row.quote === pair.quote && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.rate) && row.rate > 0)
    .map(({ date, rate }) => ({ date, rate }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) throw new Error('No forex history is available for this pair and period');

  const value = { source: 'Frankfurter', pair: pairId, ...pair, period, points, updatedAt: points.at(-1).date };
  cache.set(cacheKey, { value, expiresAt: Date.now() + 30 * 60 * 1000 });
  return value;
};
