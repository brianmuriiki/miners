import { formatCwt } from '../crychain/amounts.js';

export const short = (value) => value ? `${value.slice(0, 8)}…${value.slice(-6)}` : 'Mining reward';

export default function TxRow({ tx, address }) {
  const incoming = tx.to === address;
  const label = tx.from === null ? 'Mining reward' : incoming ? 'Received' : 'Sent';
  const amount = tx.from === null ? tx.amount : incoming ? tx.amount : -(tx.amount + tx.fee);
  return <div className="txrow">
    <div><strong>{label}</strong><div className="muted small">{incoming ? 'From' : 'To'} {short(incoming ? tx.from : tx.to)}</div>
      <div className="muted small">{new Date(tx.timestamp).toLocaleString()}</div></div>
    <div className="right"><strong className={amount > 0 ? 'pos' : 'negative'}>{amount > 0 ? '+' : ''}{formatCwt(Math.abs(amount))} CWT</strong>
      <div><span className={`badge ${tx.status === 'confirmed' ? 'confirmed' : 'pending'}`}>{tx.status === 'confirmed' ? 'Confirmed' : 'Pending'}</span>
        {tx.blockIndex !== undefined && <span className="muted small"> · Block {tx.blockIndex}</span>}</div></div>
  </div>;
}
