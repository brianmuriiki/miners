import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import TxRow from '../components/TxRow.jsx';
import { HISTORY_WINDOWS, sampleBalanceHistory } from '../utils/walletHistory.js';
import { formatCwt } from '../crychain/amounts.js';

const MINER_URL = import.meta.env.VITE_MINER_URL || 'http://localhost:5174';

function Chart({ values }) {
  const low = Math.min(0, ...values);
  const high = Math.max(1, ...values);
  const spread = high - low || 1;
  const points = values.map((value, index) => `${index / (values.length - 1) * 400},${145 - ((value - low) / spread) * 130}`);
  const line = `M${points.join(' L')}`;
  const minValue = Math.min(...values); const maxValue = Math.max(...values);
  return <svg className="chart" viewBox="0 0 400 150" preserveAspectRatio="none" role="img" aria-label={`Confirmed CWT balance chart with ${values.length} sample points, ranging from ${minValue.toFixed(2)} to ${maxValue.toFixed(2)} CWT`}>
    <defs><linearGradient id="portfolio-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".34" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
    <path d={`${line} L400,150 L0,150 Z`} fill="url(#portfolio-fill)" /><path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export default function Portfolio() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [range, setRange] = useState('1D');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const nextWallet = await api.wallet();
      const [nextTransactions, history] = await Promise.all([api.transactions(), api.addressHistory(nextWallet.address)]);
      setWallet(nextWallet); setTransactions(nextTransactions); setBalanceHistory(history); setError('');
    }
    catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const values = useMemo(() => sampleBalanceHistory(balanceHistory, HISTORY_WINDOWS[range]), [balanceHistory, range]);
  if (error && !wallet) return <p className="error" role="alert">{error}</p>;
  if (!wallet) return <p className="muted">Loading portfolio…</p>;
  const min = Math.min(...values); const max = Math.max(...values);
  return <>
    <section className="card"><div className="row between"><div><h2>CryChain portfolio</h2><p className="muted small">Based on confirmed CWT activity · no market valuation</p></div><div className="row"><Link className="btn ghost" to="/send">Send</Link><a className="btn" href={MINER_URL} target="_blank" rel="noreferrer">Open Miner</a></div></div>
      <div className="portfolio-balance">{formatCwt(wallet.balance)} <small>CWT</small></div><p className="muted small">Available: {formatCwt(wallet.available)} CWT</p>
      <div className="tabs" role="group" aria-label="Balance chart time range">{Object.keys(HISTORY_WINDOWS).map((item) => <button key={item} type="button" aria-pressed={range === item} className={range === item ? 'tab on' : 'tab'} onClick={() => setRange(item)}>{item}</button>)}</div>
      <div className="chartwrap"><div className="yaxis"><span>{max.toFixed(2)}</span><span>{((max + min) / 2).toFixed(2)}</span><span>{min.toFixed(2)}</span><span>CWT</span></div><Chart values={values} /></div>
    </section>
    <section className="card"><div className="row between"><h2>Activity</h2><Link to="/transactions">All transactions</Link></div>
      {transactions.length ? transactions.slice(0, 10).map((tx) => <TxRow key={tx.id} tx={tx} address={wallet.address} />) : <p className="muted">No activity yet. <a href={MINER_URL}>Open the miner</a> to earn CWT.</p>}
    </section>
  </>;
}
