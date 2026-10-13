import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatCwt } from '../crychain/amounts.js';
import { short } from '../components/TxRow.jsx';

const PAGE_SIZE = 10;
const MINER_URL = import.meta.env.VITE_MINER_URL || 'http://localhost:5174';

export default function Blockchain() {
  const [info, setInfo] = useState(null);
  const [page, setPage] = useState(1);
  const [blocks, setBlocks] = useState(null);
  const [mempool, setMempool] = useState(null);
  const [lookup, setLookup] = useState('');
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const [chainInfo, blockPage, pending] = await Promise.all([api.chainInfo(), api.blocks(page, PAGE_SIZE), api.mempool()]);
      setInfo(chainInfo); setBlocks(blockPage); setMempool(pending); setError('');
    } catch (err) { setError(err.message); }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  async function findBlock(event) {
    event.preventDefault(); setError(''); setSelectedBlock(null);
    try { setSelectedBlock(await api.block(lookup.trim())); }
    catch (err) { setError(err.message); }
  }

  if (!info || !blocks || !mempool) return error ? <p className="error" role="alert">{error}</p> : <p className="muted">Loading CryChain explorer…</p>;
  const pages = Math.max(1, Math.ceil(blocks.total / PAGE_SIZE));
  return <>
    <section className="card"><div className="row between"><div><h2>CryChain explorer</h2><p className="muted small">Height {info.height} · {info.pending} pending · next difficulty {info.difficulty}</p></div><a className="btn" href={MINER_URL} target="_blank" rel="noreferrer">Open CryWallet Miner</a></div>
      <p>Reward {formatCwt(info.reward)} CWT · limit {info.maxTxsPerBlock} user transactions per block · target {info.targetBlockMs / 1000}s · <span className={`badge ${info.valid ? 'confirmed' : 'invalid'}`}>{info.valid ? 'Chain valid' : 'Chain tampered'}</span></p>
      <code className="hash">Tip {info.tipHash}</code>
      {error && <p className="error" role="alert">{error}</p>}
      <form className="row" onSubmit={findBlock}><input aria-label="Block height or hash" placeholder="Block height or hash" value={lookup} onChange={(event) => setLookup(event.target.value)} required /><button className="btn ghost">Find block</button></form>
    </section>
    {selectedBlock && <section className="card block"><div className="row between"><strong>Block {selectedBlock.index}</strong><button className="btn ghost small" onClick={() => setSelectedBlock(null)}>Close</button></div>
      <p>{selectedBlock.transactions.length} transactions · difficulty {selectedBlock.difficulty} · nonce {selectedBlock.nonce}</p><code className="hash">Hash {selectedBlock.hash}</code><code className="hash">Merkle root {selectedBlock.merkleRoot}</code>
      {selectedBlock.transactions.map((tx) => <p key={tx.id}><Link to={`/transactions/${encodeURIComponent(tx.id)}`}>{tx.from === null ? 'Mining reward' : `${formatCwt(tx.amount)} CWT`} · {short(tx.id)}</Link></p>)}
    </section>}
    <section className="card"><div className="row between"><h3>Blocks</h3><div className="row"><button className="btn ghost small" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages}>Older</button><span className="muted small">Page {page} / {pages}</span><button className="btn ghost small" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>Newer</button></div></div>
      {blocks.items.map((block) => <article className="block" key={block.hash}><div className="row between"><strong>Block {block.index}</strong><button className="text-button" onClick={() => setSelectedBlock(block)}>Details</button></div>
        <span className="muted small">{new Date(block.timestamp).toLocaleString()} · {block.transactions.length} transactions · difficulty {block.difficulty}</span>
        <code className="hash">Hash {block.hash}</code><code className="hash muted">Merkle root {block.merkleRoot}</code>
      </article>)}
    </section>
    <section className="card"><h3>Fee ordered mempool</h3>{mempool.items.length === 0 ? <p className="muted">No pending transactions.</p> : mempool.items.slice(0, 10).map((tx) => <p key={tx.id}><Link to={`/transactions/${encodeURIComponent(tx.id)}`}>{formatCwt(tx.fee)} CWT fee · {short(tx.from)} · nonce {tx.nonce}</Link></p>)}</section>
  </>;
}
