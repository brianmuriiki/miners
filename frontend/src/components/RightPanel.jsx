import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { api } from '../api.js';
import { formatCwt } from '../crychain/amounts.js';
import { useAuth } from '../auth.jsx';
import ActivityBell from './ActivityBell.jsx';

const MINER_URL = import.meta.env.VITE_MINER_URL || 'http://localhost:5174';

function relativeTime(timestamp) {
  const date = new Date(timestamp);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(date); day.setHours(0, 0, 0, 0);
  const daysAgo = Math.round((today - day) / 864e5);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : date.toLocaleDateString()} ${time}`;
}

export default function RightPanel() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextWallet, nextTransactions] = await Promise.all([api.wallet(), api.transactions()]);
      setWallet(nextWallet); setTransactions(nextTransactions);
    } catch { /* Keep the panel quiet; page-level API errors are shown in the main content. */ }
  }, []);
  useEffect(() => { load(); }, [load, pathname]);
  useEffect(() => {
    window.addEventListener('cw:refresh', load);
    return () => window.removeEventListener('cw:refresh', load);
  }, [load]);

  async function copyAddress() {
    if (!wallet) return;
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setCopied(false); }
  }

  function txKind(tx) {
    if (tx.from === null) return { label: 'Mined', icon: '+', color: 'var(--accent)', incoming: true };
    if (tx.from === wallet?.address) return { label: 'Sent', icon: '↑', color: 'var(--danger)', incoming: false };
    return { label: 'Received', icon: '↓', color: 'var(--success)', incoming: true };
  }

  return <aside className="right-panel">
    <div className="me"><ActivityBell />
      <div className="row" style={{ gap: 10 }}><span className="avatar">{user?.username?.[0]?.toUpperCase()}</span><span style={{ color: 'var(--text)' }}>{user?.username}</span><ChevronDown size={16} /></div>
    </div>
    <div><span className="muted">Total Balance</span><div className="bignum">{wallet ? formatCwt(wallet.balance) : '…'} <small>CWT</small></div><span className="muted small">Available: {wallet ? formatCwt(wallet.available) : '…'} CWT</span></div>
    <div className="vcard"><span className="small">CryWallet Card · educational wallet</span>
      <div className="num">{wallet ? `${wallet.address.slice(0, 16).match(/.{1,4}/g).join(' ')} …` : '…'}</div>
      <div className="row between"><div className="row" style={{ gap: 22 }}><div><small>Holder Name</small><span className="small">{user?.username}</span></div><div><small>Network</small><span className="small">CryChain</span></div></div><div className="circles" aria-hidden="true"><span /><span /></div></div>
    </div>
    <div className="actions"><button className="btn ghost" onClick={copyAddress}>{copied ? 'Address copied' : 'Deposit · copy address'}</button><button className="btn ghost" onClick={() => navigate('/send')}>Withdraw · send CWT</button></div>
    <div className="row between"><h3>Transactions</h3><Link className="small" to="/transactions">See More</Link></div>
    {transactions.length === 0 && <p className="muted small">No transactions yet. <a href={MINER_URL}>Open the miner</a> to earn CWT.</p>}
    {transactions.slice(0, 4).map((tx) => {
      const kind = txKind(tx);
      return <div className="sidetx" key={tx.id}><span className="dot" style={{ background: kind.color }}>{kind.icon}</span>
        <div><strong>CWT</strong><div className="muted small">{kind.label}{tx.status === 'pending' ? ' · Pending' : ''}</div></div>
        <div className="right"><strong className={kind.incoming ? 'pos' : ''}>{kind.incoming ? '+' : '-'}{formatCwt(tx.amount)}</strong><div className="muted small">{relativeTime(tx.timestamp)}</div></div>
      </div>;
    })}
  </aside>;
}
