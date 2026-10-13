import { useEffect, useState } from 'react';
import { api } from '../api.js';
import PaperTradingPanel from '../components/PaperTradingPanel.jsx';

export default function Trade() {
  const [coins, setCoins] = useState([]);
  const [coinId, setCoinId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.market()
      .then((market) => {
        if (!active) return;
        setCoins(market.coins);
        setCoinId((selected) => selected || market.coins[0]?.id || '');
      })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  return <section className="card">
    <h2>Trade</h2>
    <p className="muted small">Practice buying and selling supported market coins with virtual USDT. Trades are simulated in this browser and do not use an exchange or your CryChain wallet.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {coins.length > 0 && <div className="forex-controls">
      <label htmlFor="trade-coin" className="control-label">Asset</label>
      <select id="trade-coin" value={coinId} onChange={(event) => setCoinId(event.target.value)}>
        {coins.map((coin) => <option key={coin.id} value={coin.id}>{coin.name} ({coin.symbol})</option>)}
      </select>
    </div>}
    {!coins.length && !error && <p className="muted" role="status">Loading market assets…</p>}
    {coinId && <PaperTradingPanel key={coinId} coinId={coinId} />}
  </section>;
}
