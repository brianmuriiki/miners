import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function AccountRecovery({ mode }) {
  const { updateCurrentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(mode === 'verify');

  useEffect(() => {
    if (mode !== 'verify') return;
    if (!token) { setError('This verification link has no token. Request a new link.'); setBusy(false); return; }
    api.verifyEmail(token).then(async (result) => {
      setMessage(result.message);
      try { updateCurrentUser((await api.me()).user); } catch { /* Email confirmation also works when signed out. */ }
    }).catch((err) => setError(err.message)).finally(() => setBusy(false));
  }, [mode, token, updateCurrentUser]);

  async function submit(event) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true);
    try {
      if (mode === 'forgot') setMessage((await api.forgotPassword(email)).message);
      else {
        if (!token) throw new Error('This reset link has no token. Request a new one.');
        if (password !== confirmation) throw new Error('Passwords do not match.');
        setMessage((await api.resetPassword(token, password)).message);
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (mode === 'verify') return <main className="authwrap"><section className="card authcard" aria-labelledby="verify-title">
    <h1 id="verify-title">Email verification</h1>
    {busy && <p role="status" className="muted">Verifying your email…</p>}
    {message && <p role="status" className="success-message">{message}</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {!busy && <Link className="btn" to="/login">Go to sign in</Link>}
  </section></main>;

  return <main className="authwrap"><form className="card authcard" onSubmit={submit}>
    <h1>{mode === 'forgot' ? 'Reset your password' : 'Choose a new password'}</h1>
    {mode === 'forgot' ? <>
      <p className="muted small">If an account uses that address, we’ll email you a one-time reset link.</p>
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    </> : <>
      <label>New password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
    </>}
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status" className="success-message">{message}</p>}
    <button className="btn" disabled={busy || Boolean(message)}>{busy ? 'Please wait…' : mode === 'forgot' ? 'Send reset link' : 'Update password'}</button>
    <Link to="/login">Return to sign in</Link>
  </form></main>;
}
