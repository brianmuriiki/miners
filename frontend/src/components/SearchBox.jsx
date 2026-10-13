import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api.js';
import { formatCwt } from '../crychain/amounts.js';

const pages = [
  { label: 'Dashboard', path: '/dashboard' }, { label: 'Send CWT', path: '/send' },
  { label: 'Transactions', path: '/transactions' }, { label: 'Blockchain', path: '/blockchain' },
  { label: 'Portfolio', path: '/portfolio' }, { label: 'Market', path: '/market' }, { label: 'Forex', path: '/forex' },
  { label: 'News', path: '/news' }, { label: 'Help', path: '/help' }, { label: 'Settings', path: '/settings' },
];

export default function SearchBox() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [open, setOpen] = useState(false);
  const normalized = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!normalized) return [];
    const pageResults = pages.filter((page) => page.label.toLowerCase().includes(normalized)).map((page) => ({ ...page, type: 'Page' }));
    const txResults = transactions.filter((tx) => [tx.id, tx.from, tx.to, tx.status, String(tx.amount)].some((value) => value?.toLowerCase?.().includes(normalized)))
      .slice(0, 5).map((tx) => ({ label: `${tx.status} · ${formatCwt(tx.amount)} CWT · ${tx.id}`, path: `/transactions/${encodeURIComponent(tx.id)}`, type: 'Transaction' }));
    return [...pageResults, ...txResults].slice(0, 8);
  }, [normalized, transactions]);

  async function loadTransactions() {
    try { setTransactions(await api.transactions()); } catch { setTransactions([]); }
  }
  useEffect(() => {
    const refresh = () => { if (open) loadTransactions(); };
    window.addEventListener('cw:refresh', refresh);
    return () => window.removeEventListener('cw:refresh', refresh);
  }, [open]);

  return <div className="search-wrap">
    <div className="search"><Search size={16} aria-hidden="true" /><input value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
      onFocus={() => { setOpen(true); if (!transactions.length) loadTransactions(); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
        if (event.key === 'Enter' && results[0]) { event.preventDefault(); navigate(results[0].path); setOpen(false); setQuery(''); }
      }} placeholder="Search pages or transactions" aria-label="Search pages or transactions" aria-expanded={open && Boolean(normalized)} />
    </div>
    {open && normalized && <div className="search-results" role="listbox">
      {results.length ? results.map((result) => <Link role="option" key={`${result.type}-${result.path}`} to={result.path} onClick={() => { setOpen(false); setQuery(''); }}>
        <span className="muted small">{result.type}</span><span>{result.label}</span>
      </Link>) : <p className="muted small">No matching page or transaction.</p>}
    </div>}
  </div>;
}
