import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const money = (value) => Number.isFinite(value) ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 6 : 2 }).format(value) : '—';
const compactMoney = (value) => Number.isFinite(value) ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(value) : '—';

export default function MarketList() {
  const [market, setMarket] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setMarket(await api.market()); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading && !market) return <p className="muted">Loading live market data…</p>;
  if (error && !market) return <div><p className="error" role="alert">{error}</p><button className="btn ghost" onClick={load}>Retry</button></div>;
  const coins = market.coins;
  return <div className="market-list">
    <div className="row between"><span className="muted small">Live data · {market.source} · updated {new Date(market.updatedAt).toLocaleTimeString()}</span><button className="btn ghost small" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    <div className="market-scroll"><table className="mkt"><thead><tr><th>Asset</th><th>Price</th><th>Market cap</th><th>24h volume</th><th>24h change</th></tr></thead>
      <tbody>{coins.map((coin) => <tr key={coin.id}><td><Link className="coin coin-link" to={`/market/${coin.id}`} aria-label={`View ${coin.name} (${coin.symbol}) price graph`}><span className="dot" style={{ background: coin.color }}>{coin.symbol[0]}</span>{coin.name} <span className="muted">{coin.symbol}</span></Link></td>
        <td>{money(coin.price)}</td><td>{compactMoney(coin.marketCap)}</td><td>{compactMoney(coin.volume24h)}</td>
        <td className={coin.change24h >= 0 ? 'pos' : 'negative'}>{Number.isFinite(coin.change24h) ? `${coin.change24h > 0 ? '+' : ''}${coin.change24h.toFixed(2)}%` : '—'}</td></tr>)}</tbody>
    </table></div>
    {market.unavailable?.length > 0 && <p className="muted small" role="status">Prices temporarily unavailable for {market.unavailable.join(', ')}.</p>}
    {error && <p className="error small" role="alert">Refresh failed: {error}</p>}
  </div>;
}
