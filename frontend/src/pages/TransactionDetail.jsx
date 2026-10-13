import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatCwt } from '../crychain/amounts.js';

export default function TransactionDetail() {
  const { id } = useParams();
  const [transaction, setTransaction] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.transaction(id).then(setTransaction).catch((err) => setError(err.message));
  }, [id]);
  if (error) return <section className="card"><p className="error" role="alert">{error}</p><Link to="/transactions">Back to transactions</Link></section>;
  if (!transaction) return <p className="muted">Loading transaction…</p>;
  const reward = transaction.from === null;
  return <section className="card">
    <div className="row between"><h2>Transaction details</h2><span className={`badge ${transaction.status === 'confirmed' ? 'confirmed' : 'pending'}`}>{transaction.status}</span></div>
    <dl className="details">
      <dt>Type</dt><dd>{reward ? 'Mining reward' : 'Transfer'}</dd>
      <dt>Amount</dt><dd>{formatCwt(transaction.amount)} CWT</dd>
      {reward && transaction.referralAddresses?.length > 0 && <><dt>Referral bonus</dt><dd>{transaction.referralAddresses.length * 100} CWT · {transaction.referralAddresses.length} referral{transaction.referralAddresses.length === 1 ? '' : 's'}</dd></>}
      {!reward && <><dt>Fee</dt><dd>{formatCwt(transaction.fee)} CWT</dd></>}
      <dt>From</dt><dd>{reward ? 'Mining reward' : transaction.from}</dd>
      <dt>To</dt><dd>{transaction.to}</dd>
      <dt>Transaction ID</dt><dd><code className="hash">{transaction.id}</code></dd>
      <dt>Date</dt><dd>{new Date(transaction.timestamp).toLocaleString()}</dd>
      {transaction.blockIndex !== undefined && <><dt>Block</dt><dd><Link to="/blockchain">{transaction.blockIndex} · {transaction.blockHash}</Link></dd></>}
      {transaction.merkleRoot && <><dt>Merkle root</dt><dd><code className="hash">{transaction.merkleRoot}</code></dd><dt>Inclusion proof</dt><dd>{transaction.proofValid ? `Verified · ${transaction.proof.length} proof steps` : 'Invalid'}</dd></>}
    </dl>
    <Link to="/transactions">Back to transactions</Link>
  </section>;
}
