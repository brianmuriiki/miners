import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatCwt } from '../crychain/amounts.js';

export default function ActivityBell() {
  const [open, setOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!open || loaded) return;
    api.transactions().then(setTransactions).catch(() => setTransactions([])).finally(() => setLoaded(true));
  }, [open, loaded]);
  useEffect(() => {
    const refresh = () => setLoaded(false);
    window.addEventListener('cw:refresh', refresh);
    return () => window.removeEventListener('cw:refresh', refresh);
  }, []);
  const pending = transactions.filter((tx) => tx.status === 'pending').length;

  return <div className="activity-wrap">
    <button className="icon-button" aria-label="Toggle wallet activity" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Bell size={18} />{pending > 0 && <span className="notification-count">{pending}</span>}
    </button>
    {open && <section className="activity-popover" aria-label="Wallet activity">
      <div className="row between"><strong>Wallet activity</strong><button className="text-button" onClick={() => { setLoaded(false); setOpen(true); }}>Refresh</button></div>
      {!loaded ? <p className="muted small">Loading activity…</p> : transactions.length === 0 ? <p className="muted small">No transactions yet.</p> : transactions.slice(0, 5).map((tx) => <Link className="activity-item" key={tx.id} to={`/transactions/${encodeURIComponent(tx.id)}`} onClick={() => setOpen(false)}>
        <span><strong>{tx.from === null ? 'Mining reward' : tx.status === 'pending' ? 'Pending transaction' : 'Confirmed transaction'}</strong><small>{new Date(tx.timestamp).toLocaleString()}</small></span>
        <span>{formatCwt(tx.amount)} CWT</span>
      </Link>)}
      <Link className="small" to="/transactions" onClick={() => setOpen(false)}>View all transactions</Link>
    </section>}
  </div>;
}
