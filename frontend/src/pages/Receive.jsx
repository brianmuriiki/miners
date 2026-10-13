import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api.js';
import { parseCwt } from '../crychain/amounts.js';

export default function Receive() {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState('');
  const canvasRef = useRef(null);

  const qrValue = useMemo(() => {
    if (!address) return '';
    const params = new URLSearchParams({ network: 'crychain', address });
    if (amount.trim()) {
      try {
        if (parseCwt(amount) <= 0) return '';
      } catch { return ''; }
      params.set('amount', amount.trim());
    }
    return `crywallet://send?${params.toString()}`;
  }, [address, amount]);

  useEffect(() => {
    if (canvasRef.current && qrValue) QRCode.toCanvas(canvasRef.current, qrValue, { width: 220, margin: 1, errorCorrectionLevel: 'M' }).catch((err) => setError(err.message));
  }, [qrValue]);

  useEffect(() => {
    api.wallet().then((wallet) => setAddress(wallet.address)).catch((err) => setError(err.message));
  }, []);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Could not access the clipboard. Select and copy the address above.');
    }
  }

  return <section className="card receive-card" aria-labelledby="receive-title">
    <h2 id="receive-title">Receive CWT</h2>
    <p className="muted">Share this CryChain address to receive CWT. Only send CWT on CryChain.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {address ? <>
      <label htmlFor="receive-address">Your CryChain address</label>
      <code id="receive-address" className="receive-address" tabIndex="0">{address}</code>
      <button type="button" className="btn" onClick={copyAddress}>{copied ? 'Address copied' : 'Copy address'}</button>
      <label htmlFor="receive-amount">Requested amount (optional, CWT)</label>
      <input id="receive-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Any amount" />
      {amount.trim() && !qrValue && <p className="error" role="alert">Enter a valid amount greater than zero, with up to 8 decimal places.</p>}
      {qrValue && <div className="receive-qr"><canvas ref={canvasRef} aria-label="QR code for your CryChain payment request" /><p className="muted small">Scan to prefill a CryChain transfer. The sender reviews and signs it.</p></div>}
      <p className="muted small" role="status" aria-live="polite">{copied ? 'Address copied to clipboard.' : 'Check the network before sharing or sending funds.'}</p>
    </> : !error && <p className="muted" role="status">Loading your CryChain address…</p>}
  </section>;
}
