import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatEther, isAddress, parseEther } from 'ethers';
import { provider, explorer } from '../web3/provider.js';
import { createWallet, importWallet, unlock, forget, hasKeystore } from '../web3/keystore.js';

const short = (address) => `${address.slice(0, 8)}…${address.slice(-6)}`;
function displayWei(wei, decimals = 5) {
  const [whole, fraction = ''] = formatEther(wei).split('.');
  const trimmed = fraction.slice(0, decimals).replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

function Setup({ onReady }) {
  const [mode, setMode] = useState('create');
  const [secret, setSecret] = useState('');
  const [password, setPassword] = useState('');
  const [backup, setBackup] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault(); setError('');
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    setBusy(true);
    try {
      if (mode === 'create') setBackup(await createWallet(password));
      else onReady(await importWallet(secret, password));
    } catch { setError('Could not create or import the wallet. Check the recovery phrase or private key and browser storage.'); }
    finally { setBusy(false); }
  }

  if (backup) return <section className="card">
    <h2>Back up your recovery phrase</h2>
    <p className="warn">This phrase is the wallet backup. Anyone with these words controls the wallet. CryWallet cannot recover it. It is shown once; write it down and keep it private.</p>
    <code className="addr">{backup.mnemonic}</code>
    <button className="btn" onClick={() => onReady(backup.wallet)}>I saved it · Open wallet</button>
  </section>;

  return <form className="card" onSubmit={submit}>
    <input className="sr-only" type="text" name="username" autoComplete="username" tabIndex={-1} aria-hidden="true" value="" readOnly />
    <div className="row">
      <button type="button" className={`btn ${mode === 'create' ? '' : 'ghost'}`} onClick={() => { setMode('create'); setError(''); }}>Create wallet</button>
      <button type="button" className={`btn ${mode === 'import' ? '' : 'ghost'}`} onClick={() => { setMode('import'); setError(''); }}>Import wallet</button>
    </div>
    {mode === 'import' && <label>Recovery phrase or private key<input value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="off" spellCheck="false" required /></label>}
    <label>Password for this browser<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
    <p className="warn">Sepolia testnet only. Never import a key that holds real funds.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="btn" disabled={busy}>{busy ? 'Encrypting wallet…' : mode === 'create' ? 'Create wallet' : 'Import wallet'}</button>
  </form>;
}

function Locked({ onUnlock, onForget }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { onUnlock(await unlock(password)); }
    catch { setError('Could not unlock the wallet. Check the password or remove the stored keystore.'); }
    finally { setBusy(false); }
  }
  return <form className="card" onSubmit={submit}>
    <input className="sr-only" type="text" name="username" autoComplete="username" tabIndex={-1} aria-hidden="true" value="" readOnly />
    <h2>Unlock wallet</h2>
    <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="btn" disabled={busy}>{busy ? 'Unlocking…' : 'Unlock'}</button>
    <button type="button" className="btn ghost" onClick={onForget}>Remove encrypted wallet from this browser</button>
  </form>;
}

function Wallet({ wallet, onLock }) {
  const [balance, setBalance] = useState(null);
  const [rpcConnected, setRpcConnected] = useState(false);
  const [form, setForm] = useState({ to: '', amount: '' });
  const [review, setReview] = useState(null);
  const [sent, setSent] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try { setBalance(await provider.getBalance(wallet.address)); setRpcConnected(true); setError(''); }
    catch { setRpcConnected(false); setBalance(null); setError('Could not connect to the Sepolia RPC. Check your connection or RPC setting, then retry.'); }
  }, [wallet.address]);
  useEffect(() => { refresh(); }, [refresh]);

  async function prepare(event) {
    event.preventDefault(); setError('');
    const to = form.to.trim();
    if (!isAddress(to)) { setError('Enter a valid Ethereum address.'); return; }
    let value;
    try { value = parseEther(form.amount); }
    catch { setError('Enter a valid ETH amount with no more than 18 decimal places.'); return; }
    if (value <= 0n) { setError('Amount must be greater than zero.'); return; }
    try {
      const [currentBalance, gasLimit, feeData] = await Promise.all([
        provider.getBalance(wallet.address),
        provider.estimateGas({ from: wallet.address, to, value }),
        provider.getFeeData(),
      ]);
      const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
      if (feePerGas === null) throw new Error('Gas price unavailable');
      const fee = gasLimit * feePerGas;
      if (value + fee > currentBalance) { setError('Not enough Sepolia ETH for the amount and estimated network fee.'); return; }
      setBalance(currentBalance);
      setReview({ to, value, gasLimit, fee, total: value + fee });
    } catch { setError('Could not estimate the transfer fee. Check the RPC connection and try again.'); }
  }

  async function confirm() {
    setBusy(true); setError('');
    let tx;
    try { tx = await wallet.connect(provider).sendTransaction({ to: review.to, value: review.value, gasLimit: review.gasLimit }); }
    catch (err) { setError(err.shortMessage || 'Transaction was not sent.'); setBusy(false); return; }
    const entry = { hash: tx.hash, to: review.to, value: review.value, status: 'pending' };
    setSent((items) => [entry, ...items]); setReview(null); setForm({ to: '', amount: '' });
    try {
      const receipt = await tx.wait();
      setSent((items) => items.map((item) => item.hash === tx.hash ? { ...item, status: receipt?.status === 1 ? 'confirmed' : 'failed' } : item));
      await refresh();
    } catch {
      // A wait timeout does not mean the broadcast transaction failed; retain Pending and its explorer link.
      setError('Transaction broadcast. Confirmation is taking longer than expected; check its Sepolia Etherscan link.');
    } finally { setBusy(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setError('Could not access the clipboard.'); }
  }

  return <>
    <section className="card">
      <div className="row between"><span className="muted">Sepolia balance</span><span className={`badge ${rpcConnected ? 'confirmed' : 'pending'}`}>{rpcConnected ? 'RPC connected' : 'RPC offline'}</span></div>
      <div className="bignum">{balance === null ? '…' : displayWei(balance)} <small>ETH</small></div>
      {!rpcConnected && !error && <p className="muted" role="status">Connecting to Sepolia RPC…</p>}
      <code className="addr">{wallet.address}</code>
      <div className="row">
        <button className="btn ghost" onClick={copy}>{copied ? 'Copied' : 'Copy address'}</button>
        <button className="btn ghost" onClick={refresh}>{rpcConnected ? 'Refresh balance' : 'Retry connection'}</button>
        <a className="btn ghost" href={`${explorer}/address/${wallet.address}`} target="_blank" rel="noreferrer">View on Etherscan</a>
        <button className="btn ghost" onClick={onLock}>Lock</button>
      </div>
      {balance === 0n && <p className="muted small">Your balance is zero. Send this address to a Sepolia faucet to get test ETH.</p>}
    </section>

    {review ? <section className="card">
      <h2>Review Sepolia transaction</h2>
      <dl className="details"><dt>Amount</dt><dd>{displayWei(review.value, 18)} ETH</dd>
        <dt>Recipient</dt><dd>{short(review.to)}</dd><dt>Network</dt><dd>Ethereum Sepolia</dd>
        <dt>Estimated max fee</dt><dd>{displayWei(review.fee, 8)} ETH</dd><dt>Total</dt><dd><strong>{displayWei(review.total, 8)} ETH</strong></dd></dl>
      <p className="muted small">Gas used and the final fee may be lower than this estimate.</p>
      <div className="row"><button className="btn ghost" onClick={() => setReview(null)} disabled={busy}>Cancel</button>
        <button className="btn" onClick={confirm} disabled={busy}>{busy ? 'Sending…' : 'Confirm send'}</button></div>
    </section> : <form className="card" onSubmit={prepare}>
      <h2>Send test ETH</h2>
      <label>Recipient address<input value={form.to} onChange={(event) => setForm({ ...form, to: event.target.value })} placeholder="0x…" autoComplete="off" required /></label>
      <label>Amount (ETH)<input value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} inputMode="decimal" placeholder="0.001" required /></label>
      <button className="btn" disabled={!rpcConnected}>Review transfer</button>
    </form>}
    {error && <p className="error" role="alert">{error}</p>}

    <section className="card"><h2>Sent this session</h2>
      <p className="muted small">This list clears when you reload. View the address on Etherscan for complete network history.</p>
      {sent.length === 0 ? <p className="muted">No transactions sent this session.</p> : sent.map((item) => <div className="txrow" key={item.hash}>
        <div><strong>Sent</strong><div className="muted small">To {short(item.to)}</div></div>
        <div className="right"><strong>-{displayWei(item.value, 18)} ETH</strong><div>
          <span className={`badge ${item.status === 'confirmed' ? 'confirmed' : item.status === 'failed' ? 'invalid' : 'pending'}`}>{item.status}</span>{' '}
          <a className="small" href={`${explorer}/tx/${item.hash}`} target="_blank" rel="noreferrer">View on Etherscan</a>
        </div></div>
      </div>)}</section>
  </>;
}

export default function Web3Wallet() {
  const [wallet, setWallet] = useState(null);
  const [stored, setStored] = useState(hasKeystore);
  return <div className="web3">
    <header className="row between"><div className="row"><span className="brand">CryWallet</span><span className="badge pending">Sepolia testnet</span></div><Link to="/dashboard">CryChain</Link></header>
    <p className="muted small">Testnet only. Keys stay in this browser; they are never sent to CryWallet's backend.</p>
    {wallet ? <Wallet wallet={wallet} onLock={() => setWallet(null)} /> : stored
      ? <Locked onUnlock={setWallet} onForget={() => { forget(); setStored(false); }} />
      : <Setup onReady={(nextWallet) => { setStored(true); setWallet(nextWallet); }} />}
  </div>;
}
