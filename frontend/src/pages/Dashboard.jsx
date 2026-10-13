import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import MarketList from '../components/MarketList.jsx';
import NewsFeed from '../components/NewsFeed.jsx';
import { HISTORY_WINDOWS, sampleBalanceHistory } from '../utils/walletHistory.js';
import { formatCwt } from '../crychain/amounts.js';

const MINER_URL = import.meta.env.VITE_MINER_URL || 'http://localhost:5174';

function BalanceChart({ values }) {
  const low = Math.min(0, ...values); const high = Math.max(1, ...values); const spread = high - low || 1;
  const points = values.map((value, index) => `${index / (values.length - 1) * 400},${145 - (value - low) / spread * 130}`);
  const line = `M${points.join(' L')}`;
  return <svg className="chart" viewBox="0 0 400 150" preserveAspectRatio="none" role="img" aria-label={`Confirmed CWT balance chart with ${values.length} sample points, ranging from ${low.toFixed(2)} to ${high.toFixed(2)} CWT`}>
    <defs><linearGradient id="dashboard-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".34" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
    <path d={`${line} L400,150 L0,150 Z`} fill="url(#dashboard-fill)" /><path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export default function Dashboard() {
  const [range, setRange] = useState('1D');
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const load = useCallback(async () => {
    try {
      const nextWallet = await api.wallet();
      const [txs, history] = await Promise.all([api.transactions(), api.addressHistory(nextWallet.address)]);
      setWallet(nextWallet); setTransactions(txs); setBalanceHistory(history); setError('');
    }
    catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const values = useMemo(() => sampleBalanceHistory(balanceHistory, HISTORY_WINDOWS[range]), [balanceHistory, range]);
  async function copyAddress() {
    if (!wallet) return;
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setError('Could not access the clipboard.'); }
  }
  if (error && !wallet) return <p className="error" role="alert">{error}</p>;
  if (!wallet) return <p className="muted">Loading dashboard…</p>;
  const min = Math.min(...values); const max = Math.max(...values);

  return <>
    <section className="card accounts">
      <div className="accounts-title"><h3>Your wallets</h3><p className="muted small">Two separate networks</p></div>
      <div className="acct learn-acct"><div className="row between"><strong>CryChain</strong><span className="badge confirmed">Primary network</span></div>
        <small>AVAILABLE BALANCE</small><strong>{formatCwt(wallet.available)} CWT</strong><code className="acct-address">{wallet.address}</code>
        <button className="btn ghost small" onClick={copyAddress}>{copied ? 'Address copied' : 'Copy CryChain address'}</button>
      </div>
      <div className="acct web3-acct"><div className="row between"><strong>Web3 mode</strong><span className="badge pending">Sepolia</span></div>
        <small>ETH TESTNET WALLET</small><p className="muted small">Uses a browser wallet kept separate from your Learn account.</p><Link className="btn ghost small" to="/web3">Open Web3 wallet</Link>
      </div>
    </section>

    <div className="row between"><div><h3>CryChain portfolio</h3><p className="muted small">Confirmed CWT balance history · CWT has no monetary value</p></div><Link to="/portfolio">Portfolio details</Link></div>
    <div className="portfolio">
      <section className="card">
        <div className="row between"><h3>Wallet Stats</h3><a className="btn ghost small" href={MINER_URL} target="_blank" rel="noreferrer">Open CryWallet Miner</a></div>
        <div className="tabs" role="group" aria-label="Balance chart time range">{Object.keys(HISTORY_WINDOWS).map((item) => <button key={item} type="button" aria-pressed={item === range} className={item === range ? 'tab on' : 'tab'} onClick={() => setRange(item)}>{item}</button>)}</div>
        <div className="chartwrap"><div className="yaxis"><span>{max.toFixed(2)}</span><span>{((max + min) / 2).toFixed(2)}</span><span>{min.toFixed(2)}</span><span>CWT</span></div><BalanceChart values={values} /></div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      <section className="card"><h3>Crypto News</h3><NewsFeed compact /></section>
    </div>

    <section className="card"><div className="row between"><h3>Market Overview</h3><Link className="small" to="/market">Market details</Link></div><MarketList /></section>
  </>;
}
