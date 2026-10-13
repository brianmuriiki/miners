import { useEffect, useState } from 'react';
import { api } from '../api.js';

const MINER_URL = import.meta.env.VITE_MINER_URL || 'http://localhost:5174';

export default function Rewards() {
  const [rewards, setRewards] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.referrals().then(setRewards).catch((err) => setError(err.message));
  }, []);

  async function copyInvite() {
    if (!rewards) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/register?ref=${encodeURIComponent(rewards.referralCode)}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { setError('Could not access the clipboard.'); }
  }

  return <section className="card">
    <h2>Rewards</h2>
    <p className="muted">Earn CWT by mining and invite friends to earn referral rewards.</p>
    <div className="row between"><div><h3>Earn CWT</h3><p>Mine a block to earn the standard block reward. Each verified referral adds 100 CWT to your next mining reward.</p></div><a className="btn" href={MINER_URL} target="_blank" rel="noreferrer">Open CryWallet Miner</a></div>
    <section className="card">
      <h3>Refer a friend</h3>
      <p className="muted small">Share your invite link. When your friend creates an account and verifies their email, mine a block to claim 100 CWT for that referral.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {!rewards && !error && <p className="muted" role="status">Loading referral details…</p>}
      {rewards && <>
        <label>Referral code<input readOnly value={rewards.referralCode} /></label>
        <button type="button" className="btn ghost" onClick={copyInvite}>{copied ? 'Invite link copied' : 'Copy invite link'}</button>
        <div className="paper-balances">
          <div><span className="muted small">Invited</span><strong>{rewards.invitedCount}</strong></div>
          <div><span className="muted small">Verified</span><strong>{rewards.verifiedCount}</strong></div>
          <div><span className="muted small">Rewards claimed</span><strong>{rewards.rewardedCount} · {rewards.rewardedCount * rewards.rewardCwt} CWT</strong></div>
          <div><span className="muted small">Ready to claim</span><strong>{rewards.pendingRewardCount} · {rewards.pendingRewardCount * rewards.rewardCwt} CWT</strong></div>
        </div>
      </>}
    </section>
  </section>;
}
