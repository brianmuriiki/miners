import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import PaperTradingPanel from './PaperTradingPanel.jsx';

const PERIODS = ['1D', '1W', '1M', '1Y'];
const priceLabel = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
const dateLabel = (time, options = { month: 'short', day: 'numeric' }) => new Date(time).toLocaleDateString(undefined, options);

function PriceChart({ data }) {
  const prices = data.points.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const padding = max === min ? Math.max(max * 0.002, 0.000001) : (max - min) * 0.12;
  const low = Math.max(0, min - padding);
  const high = max + padding;
  const x = (index) => 52 + index / Math.max(prices.length - 1, 1) * 686;
  const y = (price) => 18 + (high - price) / (high - low) * 188;
  const line = data.points.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point.price)}`).join(' ');
  const area = `${line} L${x(prices.length - 1)},220 L${x(0)},220 Z`;
  const ticks = [0, 1, 2, 3].map((step) => high - (high - low) * step / 3);
  const change = prices[0] ? (prices.at(-1) / prices[0] - 1) * 100 : 0;
  const description = `${data.coin.name} price in USDT for ${data.period}. ${data.points.length} observations from ${dateLabel(data.points[0].time, { dateStyle: 'medium' })} at ${priceLabel(prices[0])} to ${dateLabel(data.points.at(-1).time, { dateStyle: 'medium' })} at ${priceLabel(prices.at(-1))}.`;

  return <>
    <div className="coin-chart-summary">
      <div><span className="muted small">Latest reference price</span><strong>{priceLabel(prices.at(-1))} <small>USDT</small></strong></div>
      <div><span className="muted small">Change over period</span><strong className={change >= 0 ? 'pos' : 'negative'}>{change > 0 ? '+' : ''}{change.toFixed(2)}%</strong></div>
      <div><span className="muted small">Period range</span><strong>{priceLabel(min)} – {priceLabel(max)}</strong></div>
    </div>
    <div className="forex-chart-wrap">
      <svg className="forex-chart" viewBox="0 0 760 250" role="img" aria-label={description}>
        <defs><linearGradient id="coin-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={data.coin.color} stopOpacity=".3" /><stop offset="1" stopColor={data.coin.color} stopOpacity="0" /></linearGradient></defs>
        {ticks.map((tick, index) => <g key={index}>
          <line x1="52" x2="738" y1={18 + index * 188 / 3} y2={18 + index * 188 / 3} stroke="var(--border)" strokeDasharray="4 5" />
          <text x="44" y={22 + index * 188 / 3} textAnchor="end" fill="var(--muted)" fontSize="11">{priceLabel(tick)}</text>
        </g>)}
        <path d={area} fill="url(#coin-chart-fill)" />
        <path d={line} fill="none" stroke={data.coin.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <text x="52" y="244" fill="var(--muted)" fontSize="11">{dateLabel(data.points[0].time)}</text>
        <text x="738" y="244" textAnchor="end" fill="var(--muted)" fontSize="11">{dateLabel(data.points.at(-1).time)}</text>
      </svg>
    </div>
    <details className="forex-data"><summary>View chart data</summary>
      <div className="market-scroll"><table className="mkt"><caption className="sr-only">{data.coin.name} prices in USDT</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Price (USDT)</th></tr></thead>
        <tbody>{data.points.map((point) => <tr key={point.time}><td>{new Date(point.time).toLocaleString()}</td><td>{priceLabel(point.price)}</td></tr>)}</tbody>
      </table></div>
    </details>
  </>;
}

export default function CoinChart({ coinId }) {
  const [period, setPeriod] = useState('1W');
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    api.coinHistory(coinId, period)
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [coinId, period, refresh]);

  return <div className="coin-chart-page" aria-labelledby="coin-chart-title">
    <div className="row between"><div><h3 id="coin-chart-title">{data?.coin?.name || 'Coin'} price graph</h3><p className="muted small">Historical reference prices from Binance public market data, quoted in USDT. Prices are informational, not wallet balances or trading quotes.</p></div><Link className="btn ghost" to="/market">All coins</Link></div>
    <div className="forex-controls">
      <div><span className="control-label" id="coin-period-label">History</span><div className="tabs" role="group" aria-labelledby="coin-period-label">
        {PERIODS.map((item) => <button key={item} type="button" aria-pressed={period === item} className={period === item ? 'tab on' : 'tab'} onClick={() => setPeriod(item)}>{item}</button>)}
      </div></div>
      <button type="button" className="btn ghost" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
    </div>
    {loading && <p className="muted" role="status">Loading coin price history…</p>}
    {error && <div><p className="error" role="alert">{error}</p><button type="button" className="btn ghost" onClick={() => setRefresh((value) => value + 1)}>Retry</button></div>}
    {data?.stale && <p className="wallet-locked" role="status">The chart provider is offline. Showing previously loaded chart data from {new Date(data.updatedAt).toLocaleString()}.</p>}
    {data && <><PriceChart data={data} /><p className="muted small">Source: {data.source}. {data.points.length} observations · updated {new Date(data.updatedAt).toLocaleTimeString()}.</p><PaperTradingPanel coinId={coinId} /></>}
  </div>;
}
