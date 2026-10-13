import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { formatQuantity, PAPER_STARTING_CASH_CENTS, paperAccount, parseCents, parseQuantityAtoms, quantityFromCents, quoteCents, readPaperTrades } from '../utils/paperTrading.js';

const cashLabel = (cents) => `${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
const priceLabel = (price) => `${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 8 : 2 })} USDT`;

export default function PaperTradingPanel({ coinId, buyOnly = false }) {
  const { user } = useAuth();
  const storageKey = `crywallet.paper-trades.${user.id}`;
  const [trades, setTrades] = useState([]);
  const [coin, setCoin] = useState(null);
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([api.market(), Promise.resolve().then(() => readPaperTrades(storageKey))])
      .then(([market, savedTrades]) => {
        if (!active) return;
        const selectedCoin = market.coins.find((item) => item.id === coinId);
        if (!selectedCoin) throw new Error('Reference price for this coin is unavailable. Try again later.');
        setCoin({ ...selectedCoin, updatedAt: market.updatedAt, source: market.source });
        setTrades(savedTrades);
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [coinId, storageKey]);

  const account = useMemo(() => paperAccount(trades, coinId), [trades, coinId]);
  const holdingsValue = coin ? quoteCents(account.heldAtoms, coin.price) || 0 : 0;
  const visibleTrades = trades.filter((trade) => trade.coinId === coinId).slice(-8).reverse();

  function executeTrade(event) {
    event.preventDefault();
    if (!coin || saving) return;
    setError(''); setMessage('');
    const quantityAtoms = side === 'buy' ? quantityFromCents(parseCents(amount), coin.price) : parseQuantityAtoms(amount);
    if (!quantityAtoms) {
      setError(side === 'buy' ? 'Enter a valid USDT amount with up to 2 decimal places.' : 'Enter a valid coin quantity with up to 8 decimal places.');
      return;
    }
    let totalCents = quoteCents(quantityAtoms, coin.price);
    if (side === 'buy' && totalCents > parseCents(amount)) {
      totalCents = quoteCents(quantityAtoms - 1, coin.price);
      if (!totalCents) { setError('The trade amount is too small at the current price.'); return; }
    }
    if (side === 'buy' && totalCents > account.cashCents) { setError('Not enough virtual USDT for this trade.'); return; }
    if (side === 'sell' && quantityAtoms > account.heldAtoms) { setError(`You only hold ${formatQuantity(account.heldAtoms)} ${coin.symbol} in this paper account.`); return; }
    if (!totalCents) { setError('The trade value is too small.'); return; }

    const trade = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      coinId: coin.id,
      symbol: coin.symbol,
      side,
      quantityAtoms,
      priceUsd: coin.price,
      totalCents,
      createdAt: new Date().toISOString(),
    };
    const nextTrades = [...trades, trade].slice(-2_000);
    setSaving(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextTrades));
      setTrades(nextTrades);
      setAmount(side === 'buy' ? '100' : '');
      setMessage(`Paper ${side} recorded: ${formatQuantity(quantityAtoms)} ${coin.symbol} for ${cashLabel(totalCents)}.`);
    } catch {
      setError('Browser storage is unavailable. The paper trade was not recorded.');
    } finally {
      setSaving(false);
    }
  }

  function resetPaperAccount() {
    if (!window.confirm('Reset your paper account to 10,000 virtual USDT? This clears its simulated trade history in this browser.')) return;
    try {
      localStorage.removeItem(storageKey);
      setTrades([]); setAmount('100'); setSide('buy'); setError('');
      setMessage('Paper account reset to 10,000 virtual USDT.');
    } catch {
      setError('Browser storage is unavailable. The paper account was not reset.');
    }
  }

  return <section className="paper-trading" aria-labelledby="paper-trading-title">
    <div className="row between"><div><h3 id="paper-trading-title">Paper trade {coin?.symbol || ''}</h3><p className="muted small">Practice with virtual funds. No exchange account or real order is used. Your trade log is saved in this browser.</p></div><button type="button" className="btn ghost small" onClick={resetPaperAccount} disabled={loading}>Reset account</button></div>
    {loading && <p className="muted" role="status">Loading reference price and paper account…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {coin && <>
      <div className="paper-balances">
        <div><span className="muted small">Virtual cash</span><strong>{cashLabel(account.cashCents)}</strong></div>
        <div><span className="muted small">{coin.symbol} held</span><strong>{formatQuantity(account.heldAtoms)} <small>≈ {cashLabel(holdingsValue)}</small></strong></div>
        <div><span className="muted small">Starting funds</span><strong>{cashLabel(PAPER_STARTING_CASH_CENTS)}</strong></div>
      </div>
      <p className="muted small">Current reference: {priceLabel(coin.price)} · {coin.source} · updated {new Date(coin.updatedAt).toLocaleTimeString()}. The USD reference is treated as USDT at 1:1; simulated fills do not model order-book spreads, fees, or slippage.</p>
      <form className="paper-form" onSubmit={executeTrade}>
        {!buyOnly && <div className="tabs" role="group" aria-label="Paper trade type">
          <button type="button" aria-pressed={side === 'buy'} className={side === 'buy' ? 'tab on' : 'tab'} onClick={() => { setSide('buy'); setAmount('100'); setError(''); setMessage(''); }}>Buy</button>
          <button type="button" aria-pressed={side === 'sell'} className={side === 'sell' ? 'tab on' : 'tab'} onClick={() => { setSide('sell'); setAmount(''); setError(''); setMessage(''); }}>Sell</button>
        </div>}
        <label htmlFor="paper-amount">{side === 'buy' ? 'Spend amount (USDT)' : `Sell quantity (${coin.symbol})`}</label>
        <input id="paper-amount" type="number" min="0" step={side === 'buy' ? '0.01' : '0.00000001'} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={side === 'buy' ? '100.00' : '0.00000000'} required />
        <button className="btn" type="submit" disabled={loading || saving || !coin}>{saving ? 'Recording…' : `Simulate ${side}`}</button>
      </form>
      {message && <p className="success-message" role="status">{message}</p>}
      <div><h4>Recent {coin.symbol} paper trades</h4>{visibleTrades.length ? <div className="market-scroll"><table className="mkt paper-trade-table">
        <thead><tr><th scope="col">Time</th><th scope="col">Action</th><th scope="col">Quantity</th><th scope="col">Reference price</th><th scope="col">Total</th></tr></thead>
        <tbody>{visibleTrades.map((trade) => <tr key={trade.id}><td>{new Date(trade.createdAt).toLocaleString()}</td><td className={trade.side === 'buy' ? 'pos' : 'negative'}>{trade.side}</td><td>{formatQuantity(trade.quantityAtoms)} {trade.symbol}</td><td>{priceLabel(trade.priceUsd)}</td><td>{cashLabel(trade.totalCents)}</td></tr>)}</tbody>
      </table></div> : <p className="muted small">No paper trades for {coin.symbol} yet.</p>}</div>
    </>}
  </section>;
}
