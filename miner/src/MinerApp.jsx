import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

const WALLET_URL = import.meta.env.VITE_WALLET_URL || 'http://localhost:5173';
const asCwt = (units) => (Number(units || 0) / 100_000_000).toLocaleString(undefined, { maximumFractionDigits: 8 });

export default function MinerApp() {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [chain, setChain] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [mining, setMining] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadMinerData = useCallback(async () => {
    const [nextWallet, nextChain, nextReferrals] = await Promise.all([api.wallet(), api.chain(), api.referrals()]);
    setWallet(nextWallet);
    setChain(nextChain);
    setReferrals(nextReferrals);
  }, []);

  useEffect(() => {
    api.session()
      .then(async (result) => {
        if (result.user) {
          setUser(result.user);
          await loadMinerData();
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [loadMinerData]);

  async function signIn(event) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const result = await api.login(email, password);
      setUser(result.user);
      setPassword('');
      await loadMinerData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function mineBlock() {
    setMining(true); setError(''); setNotice('');
    try {
      const block = await api.mine();
      const bonus = (block.transactions[0]?.referralAddresses?.length || 0) * 100;
      setNotice(`Block ${block.index} mined. Reward: ${asCwt(block.transactions[0]?.amount)} CWT${bonus ? `, including ${bonus} CWT in referral bonuses` : ''}.`);
      await loadMinerData();
    } catch (err) { setError(err.message); }
    finally { setMining(false); }
  }

  async function signOut() {
    try { await api.logout(); } catch { /* Clear local state even when the API is unavailable. */ }
    setUser(null); setWallet(null); setChain(null); setReferrals(null);
  }

  return <main className="miner-shell">
    <header className="miner-header"><a href={WALLET_URL} className="brand"><span className="brand-mark">C</span><span>CryWallet <small>MINER</small></span></a>{user && <button className="quiet-button" onClick={signOut}>Log out</button>}</header>
    <section className="hero"><p className="eyebrow">CRYCHAIN · EDUCATIONAL NETWORK</p><h1>Mine CWT</h1><p>Mine blocks and earn CryChain test coins. CWT has no monetary value.</p></section>
    {error && <p className="error" role="alert">{error}</p>}
    {loading && <p className="muted" role="status">Loading your miner…</p>}
    {!loading && !user && <form className="panel login-panel" onSubmit={signIn}>
      <h2>Sign in to your CryWallet account</h2>
      <p className="muted">Mining uses the CryChain wallet linked to your account.</p>
      <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <button className="primary-button" disabled={loading}>Sign in</button>
      <a href={WALLET_URL}>Create or manage an account in CryWallet</a>
    </form>}
    {user && wallet && chain && <>
      <section className="panel account-panel">
        <div className="row"><div><p className="eyebrow">SIGNED IN</p><h2>{user.username}</h2></div><span className="network-pill">CryChain</span></div>
        <div className="stats-grid"><article><span>Available balance</span><strong>{asCwt(wallet.available)} CWT</strong></article><article><span>Chain height</span><strong>{chain.height}</strong></article><article><span>Next difficulty</span><strong>{chain.difficulty}</strong></article><article><span>Pending transactions</span><strong>{chain.pending}</strong></article></div>
        <p className="wallet-address">{wallet.address}</p>
        <button className="primary-button mine-button" onClick={mineBlock} disabled={mining}>{mining ? 'Mining block…' : 'Mine a block'}</button>
        <p className="muted small">Standard reward: {asCwt(chain.reward)} CWT plus transaction fees.</p>
        {referrals?.pendingRewardCount > 0 && <p className="bonus-note">{referrals.pendingRewardCount} verified referral{referrals.pendingRewardCount === 1 ? '' : 's'} ready to add {referrals.pendingRewardCount * referrals.rewardCwt} CWT to your block reward.</p>}
        {notice && <p className="success" role="status">{notice}</p>}
      </section>
      <section className="miner-footer"><a href={WALLET_URL}>Back to CryWallet</a><span>Balances come from confirmed CryChain blocks.</span></section>
    </>}
  </main>;
}
