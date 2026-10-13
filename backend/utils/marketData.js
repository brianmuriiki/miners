const COINS = [
  { id: 'btc-bitcoin', name: 'Bitcoin', symbol: 'BTC', color: '#f7931a' },
  { id: 'eth-ethereum', name: 'Ethereum', symbol: 'ETH', color: '#627eea' },
  { id: 'sol-solana', name: 'Solana', symbol: 'SOL', color: '#8b5cf6' },
  { id: 'bnb-binance-coin', name: 'Binance Coin', symbol: 'BNB', color: '#f0b90b' },
  { id: 'xrp-xrp', name: 'XRP', symbol: 'XRP', color: '#30343b' },
  { id: 'ada-cardano', name: 'Cardano', symbol: 'ADA', color: '#1769ff' },
  { id: 'doge-dogecoin', name: 'Dogecoin', symbol: 'DOGE', color: '#c2a633' },
];
let cache = { expiresAt: 0, value: null };
const historyCache = new Map();
const HISTORY_PERIODS = {
  '1D': { interval: '5m', limit: 288 },
  '1W': { interval: '1h', limit: 168 },
  '1M': { interval: '4h', limit: 180 },
  '1Y': { interval: '1d', limit: 365 },
};
const BINANCE_PUBLIC_HOSTS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api-gcp.binance.com',
];

async function fetchTicker(coin) {
  const response = await fetch(`https://api.coinpaprika.com/v1/tickers/${coin.id}?quotes=USD`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Market data provider unavailable');
  const ticker = await response.json();
  const quote = ticker.quotes?.USD;
  if (!quote || !Number.isFinite(quote.price)) throw new Error('Market data response is invalid');
  return {
    ...coin,
    price: quote.price,
    marketCap: quote.market_cap,
    volume24h: quote.volume_24h,
    change24h: quote.percent_change_24h,
    rank: ticker.rank,
  };
}

exports.getMarket = async () => {
  if (cache.value && cache.expiresAt > Date.now()) return cache.value;
  const results = await Promise.allSettled(COINS.map(fetchTicker));
  const coins = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  if (coins.length === 0) throw new Error('Market data provider unavailable');
  const unavailable = results.flatMap((result, index) => result.status === 'rejected' ? [COINS[index].symbol] : []);
  cache = { value: { source: 'CoinPaprika', updatedAt: new Date().toISOString(), coins, unavailable }, expiresAt: Date.now() + 60_000 };
  return cache.value;
};

exports.getCoinHistory = async (coinId, period) => {
  const coin = COINS.find((item) => item.id === coinId);
  const range = HISTORY_PERIODS[period];
  if (!coin || !range) return null;
  const key = `${coinId}:${period}`;
  const cached = historyCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached && cached.retryAt > Date.now() && cached.staleUntil > Date.now()) return { ...cached.value, stale: true };

  let lastError;
  for (const host of BINANCE_PUBLIC_HOSTS) {
    const url = new URL('/api/v3/klines', host);
    url.searchParams.set('symbol', `${coin.symbol}USDT`);
    url.searchParams.set('interval', range.interval);
    url.searchParams.set('limit', String(range.limit));
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
      const candles = await response.json();
      if (!Array.isArray(candles)) throw new Error('Provider returned an invalid chart');
      const points = candles.flatMap((candle) => {
        const time = Number(candle?.[0]);
        const price = Number(candle?.[4]);
        if (!Array.isArray(candle) || !Number.isFinite(time) || !Number.isFinite(price) || price <= 0) return [];
        return [{ time, price }];
      });
      if (points.length < 2) throw new Error('Provider returned too few chart points');
      const value = { coin, period, quote: 'USDT', source: 'Binance public market data', updatedAt: new Date().toISOString(), points };
      const now = Date.now();
      historyCache.set(key, { value, expiresAt: now + 5 * 60_000, staleUntil: now + 24 * 60 * 60_000, retryAt: 0 });
      return value;
    } catch (error) {
      lastError = error;
    }
  }

  if (cached && cached.staleUntil > Date.now()) {
    cached.retryAt = Date.now() + 30_000;
    return { ...cached.value, stale: true };
  }
  throw lastError || new Error('Coin history provider unavailable');
};
