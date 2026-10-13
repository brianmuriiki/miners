import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { LogOut } from 'lucide-react';

export default function Settings() {
  const { user, updateCurrentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [pendingEmail, setPendingEmail] = useState(user?.pendingEmail || '');
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState('');
  const [revokingOthers, setRevokingOthers] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setSessions(await api.sessions()); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function revoke(sessionId) {
    setRevoking(sessionId); setError('');
    try { await api.revokeSession(sessionId); await load(); }
    catch (err) { setError(err.message); }
    finally { setRevoking(''); }
  }

  async function revokeOthers() {
    if (!window.confirm('Sign out every other CryWallet session?')) return;
    setRevokingOthers(true); setError('');
    try { await api.revokeOtherSessions(); await load(); }
    catch (err) { setError(err.message); }
    finally { setRevokingOthers(false); }
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  async function saveProfile(event) {
    event.preventDefault(); setProfileBusy(true); setProfileError(''); setProfileMessage('');
    const body = { username: username.trim() };
    if (email.trim().toLowerCase() !== user?.email?.toLowerCase()) {
      body.email = email.trim();
      if (currentPassword) body.currentPassword = currentPassword;
    }
    try {
      const result = await api.updateProfile(body);
      updateCurrentUser(result.user);
      setUsername(result.user.username);
      setEmail(result.user.email);
      setPendingEmail(result.user.pendingEmail || '');
      setCurrentPassword('');
      setProfileMessage(result.emailChangePending
        ? result.verificationSent ? `Confirmation sent to ${result.user.pendingEmail}. Your current email remains active until you verify it.` : 'Your email change is pending, but the confirmation email could not be sent. Check mail settings and submit again to resend.'
        : 'Profile updated.');
    } catch (err) { setProfileError(err.message); }
    finally { setProfileBusy(false); }
  }

  return <>
    <section className="card"><h2>Profile</h2>
      <form className="profile-form" onSubmit={saveProfile}>
        <label>Username<input autoComplete="username" minLength={3} maxLength={30} value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
        <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        {email.trim().toLowerCase() !== user?.email?.toLowerCase() && <>
          <p className="muted small">We’ll send a confirmation link to the new address. Your current email remains active until you confirm it.</p>
          <label>Current CryWallet password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
          <p className="muted small">Google-only accounts need to set a CryWallet password through <Link to="/forgot-password">password reset</Link> before changing email.</p>
        </>}
        {pendingEmail && <p className="warn" role="status">Email change waiting for confirmation: {pendingEmail}</p>}
        {profileError && <p className="error" role="alert">{profileError}</p>}
        {profileMessage && <p className="success-message" role="status">{profileMessage}</p>}
        <button className="btn" disabled={profileBusy}>{profileBusy ? 'Saving…' : 'Save profile'}</button>
      </form>
      <p className="muted small">To change your password, request a reset link for {user?.email}.</p><Link className="btn ghost" to="/forgot-password">Change password</Link>
    </section>
    <section className="card"><div className="row between"><h2>Active sessions</h2><div className="row"><button className="btn ghost" onClick={revokeOthers} disabled={loading || revokingOthers}>{revokingOthers ? 'Signing out…' : 'Revoke other sessions'}</button><button className="btn ghost" onClick={load} disabled={loading}>Refresh</button></div></div>
      <p className="muted small">Revoke sessions you no longer use. The current session stays active here.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p className="muted" role="status">Loading sessions…</p> : sessions.length === 0 ? <p className="muted">No active sessions found.</p> : sessions.map((session) => <div className="session-row" key={session._id}>
        <div><strong>{session.current ? 'This session' : 'Other session'}</strong><div className="session-device">{session.userAgent || 'Unknown browser or device'}</div><div className="muted small">Signed in {new Date(session.createdAt).toLocaleString()}{session.ipAddress ? ` · IP ${session.ipAddress}` : ''} · expires {new Date(session.expiresAt).toLocaleString()}</div></div>
        {session.current ? <span className="badge confirmed">Current</span> : <button className="btn ghost" onClick={() => revoke(session._id)} disabled={revoking === session._id}>{revoking === session._id ? 'Revoking…' : 'Revoke'}</button>}
      </div>)}</section>
    <section className="card"><div className="row between"><div><h2>Log out</h2><p className="muted small">Sign out of this CryWallet session.</p></div><button className="btn ghost" onClick={handleLogout}><LogOut size={16} /> Log out</button></div></section>
  </>;
}
