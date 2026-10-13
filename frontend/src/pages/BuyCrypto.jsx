import { useEffect, useState } from 'react';
import { api } from '../api.js';
import PaperTradingPanel from '../components/PaperTradingPanel.jsx';

export default function BuyCrypto() {
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
    <h2>Buy Crypto</h2>
    <p className="muted small">Practice buying supported market coins with virtual USDT. This is a simulator only: no payment is collected, no real order is placed, and your CryChain wallet is not affected.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {coins.length > 0 && <div className="forex-controls">
      <label htmlFor="buy-coin" className="control-label">Asset</label>
      <select id="buy-coin" value={coinId} onChange={(event) => setCoinId(event.target.value)}>
        {coins.map((coin) => <option key={coin.id} value={coin.id}>{coin.name} ({coin.symbol})</option>)}
      </select>
    </div>}
    {!coins.length && !error && <p className="muted" role="status">Loading market assets…</p>}
    {coinId && <PaperTradingPanel key={coinId} coinId={coinId} buyOnly />}
  </section>;
}
