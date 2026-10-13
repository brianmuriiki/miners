import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import TxRow from '../components/TxRow.jsx';

export default function Transactions() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [w, txs] = await Promise.all([api.wallet(), api.transactions()]); setWallet(w); setTransactions(txs); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!transactions || !wallet) return <section className="card"><h2>Transactions</h2>
    {loading ? <p className="muted" role="status">Loading transactions…</p> : <div className="inline-error" role="alert"><p>{error || 'Transaction history is unavailable.'}</p><button className="btn ghost" onClick={load}>Try again</button></div>}
  </section>;
  return <section className="card"><h2>Transactions</h2>
    {error && <div className="inline-error" role="alert"><p>{error}</p><button className="btn ghost" onClick={load} disabled={loading}>Try again</button></div>}
    {transactions.length === 0 ? <p className="muted">Nothing here yet. Send or mine to create your first transaction.</p> : transactions.map((tx) => <TxRow key={tx.id} tx={tx} address={wallet.address} />)}
  </section>;
}
