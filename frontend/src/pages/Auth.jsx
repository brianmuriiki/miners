import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';

export default function Auth({ mode }) {
  const isRegister = mode === 'register';
  const { login, loginGoogle, register, registerGoogle, completeRegistration } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', referralCode: new URLSearchParams(window.location.search).get('ref') || '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [registeredUser, setRegisteredUser] = useState(null);
  const [storageWarning, setStorageWarning] = useState('');
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [canResendVerification, setCanResendVerification] = useState(false);
  const googleButton = useRef(null);
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  useEffect(() => {
    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID || !googleButton.current) return undefined;
    let active = true;
    const render = () => {
      if (!active || !window.google?.accounts?.id || !googleButton.current) return;
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setError(''); setBusy(true);
          try {
            if (isRegister) {
              const currentForm = formRef.current;
              const result = await registerGoogle({ credential, username: currentForm.username, walletPassword: currentForm.password, referralCode: currentForm.referralCode });
              setRecoveryPhrase(result.mnemonic); setRegisteredUser(result.user); setStorageWarning(result.storageWarning || '');
            } else {
              await loginGoogle(credential); navigate('/dashboard', { replace: true });
            }
          }
          catch (err) { setError(err.message); }
          finally { setBusy(false); }
        },
      });
      window.google.accounts.id.renderButton(googleButton.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 320 });
    };
    if (window.google?.accounts?.id) render();
    else {
      let script = document.querySelector('script[data-google-identity]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true;
        script.dataset.googleIdentity = 'true'; script.onload = render; document.head.appendChild(script);
      } else script.addEventListener('load', render, { once: true });
    }
    return () => { active = false; };
  }, [isRegister, loginGoogle, navigate, registerGoogle]);

  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (isRegister) {
        const result = await register(form);
        setRecoveryPhrase(result.mnemonic); setVerificationPending(Boolean(result.emailVerificationRequired)); setVerificationSent(Boolean(result.verificationSent));
        setRegisteredUser(result.user);
        return;
      }
      else await login(form.email, form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) { setError(err.message); setCanResendVerification(err.status === 403); } finally { setBusy(false); }
  }

  async function resendVerification() {
    setBusy(true); setError('');
    try { const result = await api.resendVerification(form.email); setVerificationMessage(result.message); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (recoveryPhrase) return <main className="authwrap"><section className="card authcard" aria-labelledby="backup-title">
    <h1 id="backup-title">Back up your CryChain recovery phrase</h1>
    <p className="warn">This phrase is shown once. Anyone with these words can control your CWT. Write it down and store it offline; never share it.</p>
    {storageWarning && <p className="error" role="alert">{storageWarning}</p>}
    <ol className="phrase-grid" aria-label="Recovery phrase words">{recoveryPhrase.split(' ').map((word, index) => <li key={`${word}-${index}`}><span>{index + 1}</span>{word}</li>)}</ol>
    <label className="backup-confirm"><input type="checkbox" checked={backupConfirmed} onChange={(event) => setBackupConfirmed(event.target.checked)} aria-describedby="backup-help" />I wrote down my recovery phrase</label>
    <p id="backup-help" className="muted small">You need this phrase to restore your CryChain wallet if you lose access to this browser.</p>
    <button className="btn" disabled={!backupConfirmed} onClick={() => {
      if (verificationPending) setRecoveryPhrase('');
      else { completeRegistration(registeredUser); navigate('/dashboard', { replace: true }); }
    }}>{verificationPending ? 'Continue to email verification' : 'Continue to wallet'}</button>
  </section></main>;

  if (verificationPending && !recoveryPhrase) return <main className="authwrap"><section className="card authcard">
    <h1>Verify your email</h1>
    <p>We created your account and wallet. {verificationSent ? 'Check your inbox for a verification link before signing in.' : 'Email delivery is not configured yet; ask the site administrator to configure SMTP, then request a new link.'}</p>
    <button className="btn ghost" onClick={resendVerification} disabled={busy}>{busy ? 'Sending…' : 'Resend verification email'}</button>
    {verificationMessage && <p role="status" className="success-message">{verificationMessage}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <Link to="/login">Return to sign in</Link>
  </section></main>;

  return <main className="authwrap"><form className="card authcard" onSubmit={submit}>
    <div><p className="muted small">CryWallet · CryChain</p><h1>{isRegister ? 'Create account' : 'Welcome back'}</h1></div>
    {isRegister && <label>Username<input autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} minLength={3} maxLength={30} required /></label>}
    {isRegister && <label>Referral code (optional)<input value={form.referralCode} onChange={(e) => setForm({ ...form, referralCode: e.target.value.toUpperCase() })} maxLength={12} autoComplete="off" /></label>}
    <label>Email<input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
    <label>Password<input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="btn" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Register' : 'Log in'}</button>
    {canResendVerification && <button type="button" className="text-button" onClick={resendVerification} disabled={busy}>Resend verification email</button>}
    {verificationMessage && <p role="status" className="success-message">{verificationMessage}</p>}
    {!isRegister && <Link className="muted small" to="/forgot-password">Forgot your password?</Link>}
    {isRegister && <p className="muted small">For email registration, this password is also used to encrypt your browser wallet. With Google, it only encrypts the wallet and is never sent to the server.</p>}
    {import.meta.env.VITE_GOOGLE_CLIENT_ID && <><div className="auth-divider"><span>or {isRegister ? 'sign up' : 'continue'} with Google</span></div><div ref={googleButton} className="google-button" /></>}
    {!isRegister && import.meta.env.VITE_GOOGLE_CLIENT_ID && <p className="muted small">Google signs you in; it does not unlock your encrypted CryChain wallet. You’ll unlock it separately before sending CWT.</p>}
    <p className="muted small">{isRegister ? 'Already registered?' : 'New to CryWallet?'}{' '}
      <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Create an account'}</Link></p>
    <p className="muted small"><Link to="/web3">Open Web3 mode · Sepolia</Link></p>
  </form></main>;
}
