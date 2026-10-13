import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { short } from '../components/TxRow.jsx';
import { formatCwt, parseCwt, parseCwtFee } from '../crychain/amounts.js';
import { hasCryChainKeystore, isCryChainWalletUnlocked, restoreCryChainWallet, signCryChainTransaction, unlockCryChainWallet } from '../crychain/keys.js';
import QrScanner from '../components/QrScanner.jsx';

const ADDRESS = /^CW[0-9a-f]{40}$/;

export default function Send() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [feePresets, setFeePresets] = useState(null);
  const [form, setForm] = useState({ to: '', amount: '', fee: '1' });
  const [review, setReview] = useState(false);
  const [reviewAmount, setReviewAmount] = useState(0);
  const [reviewFee, setReviewFee] = useState(0);
  const [keyPassword, setKeyPassword] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  useEffect(() => {
    Promise.all([api.wallet(), api.fees()]).then(([nextWallet, presets]) => { setWallet(nextWallet); setFeePresets(presets); }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const handleQrScan = useCallback((decoded) => {
    const value = decoded.trim();
    if (ADDRESS.test(value)) {
      setForm((current) => ({ ...current, to: value }));
      setScanning(false); setScanMessage('Recipient address added. Review the transaction before sending.'); setError('');
      return;
    }
    try {
      const request = new URL(value);
      const address = request.searchParams.get('address');
      const network = request.searchParams.get('network');
      const amount = request.searchParams.get('amount') || '';
      if (request.protocol !== 'crywallet:' || request.hostname !== 'send' || network !== 'crychain' || !ADDRESS.test(address || '')) throw new Error();
      if (amount) parseCwt(amount);
      setForm((current) => ({ ...current, to: address, ...(amount ? { amount } : {}) }));
      setScanning(false); setScanMessage('Payment request added. Review the transaction before sending.'); setError('');
    } catch {
      setScanning(false); setError('This QR code is not a valid CryWallet CryChain payment request.');
    }
  }, []);

  function prepare(event) {
    event.preventDefault(); setError('');
    if (!ADDRESS.test(form.to.trim())) return setError('Enter a valid CWT address (CW followed by 40 lowercase hexadecimal characters).');
    let amount; let fee;
    try { amount = parseCwt(form.amount); fee = parseCwtFee(form.fee || '0'); }
    catch (err) { return setError(err.message || 'Enter valid CWT amounts with at most 8 decimal places.'); }
    if (!Number.isSafeInteger(amount + fee)) return setError('Amount plus fee exceeds the safe integer limit.');
    if (wallet && BigInt(amount) + BigInt(fee) > BigInt(wallet.available)) return setError(`Not enough funds. Available balance is ${formatCwt(wallet.available)} CWT.`);
    setReviewAmount(amount); setReviewFee(fee); setReview(true);
  }

  async function confirm() {
    setBusy(true); setError('');
    try {
      if (!isCryChainWalletUnlocked()) {
        if (hasCryChainKeystore()) await unlockCryChainWallet(keyPassword);
        else await restoreCryChainWallet(recoveryPhrase, keyPassword, wallet.publicKey);
        setKeyPassword('');
        setRecoveryPhrase('');
      }
      const transaction = signCryChainTransaction({ to: form.to.trim(), amount: reviewAmount, fee: reviewFee, nonce: wallet.nextNonce });
      await api.send(transaction); navigate('/transactions');
    }
    catch (err) { setError(err.message); setReview(false); }
    finally { setBusy(false); }
  }

  if (review) return <section className="card narrow">
    <h2>Review CWT transaction</h2><dl className="details">
      <dt>Amount</dt><dd>{formatCwt(reviewAmount)} CWT</dd><dt>Recipient</dt><dd>{short(form.to.trim())}</dd>
      <dt>Network</dt><dd>CryChain</dd><dt>Fee</dt><dd>{formatCwt(reviewFee)} CWT</dd><dt>Total</dt><dd><strong>{formatCwt(reviewAmount + reviewFee)} CWT</strong></dd>
    </dl><p className="muted small">The transaction remains pending until a block is mined.</p>
    {!isCryChainWalletUnlocked() && <>
      {!hasCryChainKeystore() && <label>CryChain recovery phrase<textarea autoComplete="off" value={recoveryPhrase} onChange={(event) => setRecoveryPhrase(event.target.value)} required /></label>}
      <label>Wallet password<input type="password" autoComplete="current-password" value={keyPassword} onChange={(event) => setKeyPassword(event.target.value)} required /></label>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button className="btn ghost" onClick={() => setReview(false)} disabled={busy}>Back</button><button className="btn" onClick={confirm} disabled={busy}>{busy ? 'Sending…' : 'Confirm send'}</button></div>
  </section>;

  return <form className="card narrow" onSubmit={prepare}>
    <h2>Send CWT</h2><p className="muted small">Available balance: {wallet ? formatCwt(wallet.available) : loading ? 'Loading…' : 'Unavailable'} CWT</p>
    {!isCryChainWalletUnlocked() && <p className="wallet-locked" role="status">Your CryChain wallet is locked. After reviewing this transfer, unlock it with the wallet password; Google sign-in does not unlock wallet keys.</p>}
    {wallet?.available === 0 && <p className="muted small">There are no available funds to send. Mine CWT or wait for an incoming transaction to confirm.</p>}
    <label>Recipient address<input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="CW…" autoComplete="off" required /></label>
    <button className="btn ghost" type="button" onClick={() => { setScanning((open) => !open); setError(''); setScanMessage(''); }}>{scanning ? 'Close QR scanner' : 'Scan payment QR'}</button>
    {scanning && <QrScanner onScan={handleQrScan} />}
    {scanMessage && <p className="success-message" role="status">{scanMessage}</p>}
    <label>Amount (up to 8 decimal places)<input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label>
    <label>Fee (up to 8 decimal places)<input inputMode="decimal" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} required /></label>
    {feePresets && <div className="row" aria-label="Fee presets">{Object.entries(feePresets).map(([speed, value]) => <button className="btn ghost small" type="button" key={speed} onClick={() => setForm({ ...form, fee: formatCwt(value) })}>{speed}: {formatCwt(value)} CWT</button>)}</div>}
    {error && <p className="error" role="alert">{error}</p>}<button className="btn" disabled={loading || !wallet || busy}>Review transaction</button>
  </form>;
}
