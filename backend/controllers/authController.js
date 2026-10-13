const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Session = require('../models/Session');
const EmailToken = require('../models/EmailToken');
const blockchain = require('../blockchain/blockchain');
const httpError = require('../utils/httpError');
const { sendAccountEmail, isEmailConfigured } = require('../utils/mailer');
const { addressFromPublicKey, PUBLIC_KEY } = require('../utils/crypto');
const {
  REFRESH_COOKIE, REFRESH_TTL_SECONDS, createAccessToken, createRefreshToken,
  hashToken, setAuthCookies, clearAuthCookies, verifyRefreshToken,
} = require('../utils/sessionTokens');

const publicUser = (user) => ({ id: user._id, username: user.username, email: user.email, pendingEmail: user.pendingEmail || null, emailVerified: Boolean(user.emailVerifiedAt) });
const googleClient = new OAuth2Client();

async function referralAttributes(referralCode) {
  if (referralCode === undefined || referralCode === '') return {};
  if (typeof referralCode !== 'string' || !/^[A-Fa-f0-9]{12}$/.test(referralCode)) throw httpError(400, 'Invalid referral code');
  const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() }).select('_id');
  if (!referrer) throw httpError(400, 'Referral code is invalid');
  return { referredBy: referrer._id };
}

async function verifiedGooglePayload(credential) {
  if (typeof credential !== 'string' || credential.length > 10_000) throw httpError(400, 'A valid Google credential is required');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw httpError(503, 'Google sign-in is not configured');
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || typeof payload.email !== 'string' || payload.email_verified !== true) throw new Error('Google email is not verified');
    return payload;
  } catch {
    throw httpError(401, 'Google credential is invalid or does not contain a verified email');
  }
}

function maskedIp(ip = '') {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return `${ip.split('.').slice(0, 2).join('.')}.x.x`;
  if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}:…`;
  return '';
}

async function createSession(user, res, req) {
  const session = new Session({
    userId: user._id,
    refreshTokenHash: 'pending',
    userAgent: typeof req?.get('user-agent') === 'string' ? req.get('user-agent').slice(0, 300) : '',
    ipAddress: maskedIp(req?.ip),
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
  });
  const refreshToken = createRefreshToken(user._id, session._id);
  session.refreshTokenHash = hashToken(refreshToken);
  await session.save();
  setAuthCookies(res, createAccessToken(user, session._id), refreshToken);
}

async function issueEmailToken(user, purpose, targetEmail = user.email) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresIn = purpose === 'verify-email' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  await EmailToken.deleteMany({ userId: user._id, purpose });
  await EmailToken.create({ userId: user._id, tokenHash: hashToken(token), purpose, targetEmail, expiresAt: new Date(Date.now() + expiresIn) });
  const route = purpose === 'reset-password' ? '/reset-password' : '/verify-email';
  const link = new URL(route, process.env.CLIENT_URL);
  link.searchParams.set('token', token);
  const subject = purpose === 'reset-password' ? 'Reset your CryWallet password' : purpose === 'change-email' ? 'Confirm your new CryWallet email' : 'Verify your CryWallet email';
  const instruction = purpose === 'reset-password' ? 'Reset your password' : purpose === 'change-email' ? 'Confirm your new email address' : 'Verify your email address';
  try {
    return await sendAccountEmail({ to: targetEmail, subject, text: `${instruction} using this one-time link (valid for ${expiresIn === 24 * 60 * 60 * 1000 ? '24 hours' : '1 hour'}):\n\n${link.toString()}\n\nIf you did not request this, you can ignore this email.` });
  } catch {
    return false;
  }
}

exports.register = async (req, res) => {
  const { username, email, password, address, publicKey, referralCode } = req.body || {};
  if (![username, email, password].every((value) => typeof value === 'string' && value.trim().length)) throw httpError(400, 'username, email and password are required');
  if (username.trim().length < 3 || username.trim().length > 30) throw httpError(400, 'Username must be 3 to 30 characters');
  if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'Invalid email');
  if (typeof publicKey !== 'string' || !PUBLIC_KEY.test(publicKey) || typeof address !== 'string' || !/^CW[0-9a-f]{40}$/.test(address) || addressFromPublicKey(publicKey) !== address) throw httpError(400, 'A valid CryChain address and public key are required');
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim();
  const referral = await referralAttributes(referralCode);
  const exists = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] });
  if (exists) throw httpError(409, 'Username or email already in use');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ username: normalizedUsername, email: normalizedEmail, passwordHash, referralCode: crypto.randomBytes(6).toString('hex').toUpperCase(), ...referral });
  try {
    const wallet = await Wallet.create({ userId: user._id, address, publicKey });
    const verificationSent = await issueEmailToken(user, 'verify-email');
    res.status(201).json({ user: publicUser(user), wallet: { address: wallet.address }, emailVerificationRequired: true, verificationSent });
  } catch (error) {
    await Wallet.deleteOne({ userId: user._id });
    await Session.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
    throw error;
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') throw httpError(400, 'email and password are required');
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  const valid = user?.passwordHash && await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw httpError(401, 'Invalid credentials');
  if (!user.emailVerifiedAt) throw httpError(403, 'Verify your email before signing in. Use the resend verification link.');
  await createSession(user, res, req);
  res.json({ user: publicUser(user) });
};

exports.updateProfile = async (req, res) => {
  const { username, email, currentPassword } = req.body || {};
  if (username !== undefined && (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 30)) {
    throw httpError(400, 'Username must be 3 to 30 characters');
  }
  if (email !== undefined && (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim()))) {
    throw httpError(400, 'Enter a valid email address');
  }
  if (username === undefined && email === undefined) throw httpError(400, 'Provide a username or email to update');

  const user = await User.findById(req.user.id);
  if (!user) throw httpError(404, 'User not found');
  const normalizedUsername = username?.trim();
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedUsername && normalizedUsername !== user.username) {
    if (await User.findOne({ username: normalizedUsername })) throw httpError(409, 'That username is already in use');
  }

  let emailChangeRequested = false;
  if (normalizedEmail && normalizedEmail !== user.email) {
    if (!isEmailConfigured()) throw httpError(503, 'Email delivery is not configured on this server');
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing && String(existing._id) !== String(user._id)) throw httpError(409, 'That email address is already in use');
    if (typeof currentPassword !== 'string' || !user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw httpError(401, 'Enter your current CryWallet password to change your email. Google-only accounts can set one using password reset first.');
    }
    user.pendingEmail = normalizedEmail;
    emailChangeRequested = true;
  }
  if (normalizedUsername) user.username = normalizedUsername;
  try { await user.save(); }
  catch (error) {
    if (error.code === 11000) throw httpError(409, 'That username or email is already in use');
    throw error;
  }
  const verificationSent = emailChangeRequested ? await issueEmailToken(user, 'change-email', normalizedEmail) : undefined;
  res.json({ user: publicUser(user), ...(emailChangeRequested ? { emailChangePending: true, verificationSent } : {}) });
};

exports.googleLogin = async (req, res) => {
  const { credential } = req.body || {};
  const payload = await verifiedGooglePayload(credential);
  const email = payload.email.trim().toLowerCase();
  let user = await User.findOne({ googleSubject: payload.sub });
  if (!user) {
    user = await User.findOne({ email });
    if (!user) throw httpError(404, 'No CryWallet account uses this Google email. Create an account with this email first.');
    if (user.googleSubject && user.googleSubject !== payload.sub) throw httpError(409, 'This CryWallet account is linked to another Google account');
    user.googleSubject = payload.sub;
  }
  if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
  await user.save();
  await createSession(user, res, req);
  res.json({ user: publicUser(user) });
};

exports.googleRegister = async (req, res) => {
  const { credential, username, address, publicKey, referralCode } = req.body || {};
  const payload = await verifiedGooglePayload(credential);
  if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 30) throw httpError(400, 'Username must be 3 to 30 characters');
  if (typeof publicKey !== 'string' || !PUBLIC_KEY.test(publicKey) || typeof address !== 'string' || !/^CW[0-9a-f]{40}$/.test(address) || addressFromPublicKey(publicKey) !== address) throw httpError(400, 'A valid browser-generated CryChain address and public key are required');
  const email = payload.email.trim().toLowerCase();
  const normalizedUsername = username.trim();
  const referral = await referralAttributes(referralCode);
  if (await User.findOne({ $or: [{ email }, { username: normalizedUsername }, { googleSubject: payload.sub }] })) throw httpError(409, 'An account already uses this email or username. Sign in instead.');

  let user;
  try {
    user = await User.create({ username: normalizedUsername, email, googleSubject: payload.sub, emailVerifiedAt: new Date(), referralCode: crypto.randomBytes(6).toString('hex').toUpperCase(), ...referral });
    const wallet = await Wallet.create({ userId: user._id, address, publicKey });
    await createSession(user, res, req);
    return res.status(201).json({ user: publicUser(user), wallet: { address: wallet.address } });
  } catch (error) {
    if (user) {
      await Wallet.deleteOne({ userId: user._id });
      await Session.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
    }
    if (error.code === 11000) throw httpError(409, 'An account already uses this email, username, or wallet address');
    throw error;
  }
};

exports.resendVerification = async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) throw httpError(400, 'Enter a valid email address');
  if (!isEmailConfigured()) throw httpError(503, 'Email delivery is not configured on this server');
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (user && !user.emailVerifiedAt) await issueEmailToken(user, 'verify-email');
  res.json({ message: 'If an unverified account uses that email, a verification link has been sent.' });
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.body || {};
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) throw httpError(400, 'Invalid verification token');
  const emailToken = await EmailToken.findOneAndDelete({ tokenHash: hashToken(token), purpose: { $in: ['verify-email', 'change-email'] }, expiresAt: { $gt: new Date() } });
  if (!emailToken) throw httpError(400, 'Verification link is invalid or expired. Request a new link.');
  const user = await User.findById(emailToken.userId);
  if (!user) throw httpError(400, 'Verification link is invalid or expired. Request a new link.');
  if (emailToken.purpose === 'change-email') {
    if (!emailToken.targetEmail || user.pendingEmail !== emailToken.targetEmail) throw httpError(400, 'This email change is no longer pending. Request a new link.');
    user.email = emailToken.targetEmail;
    user.pendingEmail = null;
  } else {
    user.emailVerifiedAt = new Date();
  }
  try { await user.save(); }
  catch (error) {
    if (error.code === 11000) throw httpError(409, 'That email address is already in use.');
    throw error;
  }
  res.json({ message: emailToken.purpose === 'change-email' ? 'Email address updated and verified.' : 'Email verified. You can now sign in.' });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) throw httpError(400, 'Enter a valid email address');
  if (!isEmailConfigured()) throw httpError(503, 'Email delivery is not configured on this server');
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (user) await issueEmailToken(user, 'reset-password');
  res.json({ message: 'If an account uses that email, password reset instructions have been sent.' });
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) throw httpError(400, 'Invalid reset token');
  if (typeof password !== 'string' || password.length < 8) throw httpError(400, 'Password must be at least 8 characters');
  const emailToken = await EmailToken.findOneAndDelete({ tokenHash: hashToken(token), purpose: 'reset-password', expiresAt: { $gt: new Date() } });
  if (!emailToken) throw httpError(400, 'Reset link is invalid or expired. Request a new one.');
  const user = await User.findById(emailToken.userId);
  if (!user) throw httpError(400, 'Reset link is invalid or expired. Request a new one.');
  user.passwordHash = await bcrypt.hash(password, 12);
  user.emailVerifiedAt = user.emailVerifiedAt || new Date();
  await user.save();
  await Session.deleteMany({ userId: user._id });
  clearAuthCookies(res);
  res.json({ message: 'Password updated. Sign in with your new password.' });
};

exports.me = async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash');
  if (!user) throw httpError(404, 'User not found');
  res.json({ user });
};

exports.referrals = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw httpError(404, 'User not found');
  if (!user.referralCode) {
    user.referralCode = crypto.randomBytes(6).toString('hex').toUpperCase();
    await user.save();
  }
  const invited = await User.find({ referredBy: user._id }).select('_id emailVerifiedAt').lean();
  const wallets = await Wallet.find({ userId: { $in: invited.map((item) => item._id) } }).select('address userId').lean();
  const walletByUser = new Map(wallets.map((wallet) => [String(wallet.userId), wallet.address]));
  const verifiedAddresses = invited.filter((item) => item.emailVerifiedAt).map((item) => walletByUser.get(String(item._id))).filter(Boolean);
  const rewarded = blockchain.claimedReferralAddresses();
  res.json({ referralCode: user.referralCode, invitedCount: invited.length, verifiedCount: verifiedAddresses.length, rewardedCount: verifiedAddresses.filter((address) => rewarded.has(address)).length, pendingRewardCount: verifiedAddresses.filter((address) => !rewarded.has(address)).length, rewardCwt: 100 });
};

exports.session = async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await User.findById(req.user.id).select('-passwordHash');
  if (!user) return res.json({ user: null });
  res.json({ user });
};

exports.refresh = async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw httpError(401, 'Refresh session is missing');
  let claims;
  try {
    claims = verifyRefreshToken(token);
    if (claims.type !== 'refresh' || !claims.sub || !claims.sid) throw new Error('Invalid refresh token');
  } catch {
    clearAuthCookies(res);
    throw httpError(401, 'Invalid or expired refresh session');
  }

  const user = await User.findById(claims.sub);
  if (!user) {
    await Session.deleteOne({ _id: claims.sid, userId: claims.sub });
    clearAuthCookies(res);
    throw httpError(401, 'User session is no longer valid');
  }

  const previousHash = hashToken(token);
  const nextToken = createRefreshToken(claims.sub, claims.sid);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
  const session = await Session.findOneAndUpdate(
    { _id: claims.sid, userId: claims.sub, refreshTokenHash: previousHash, expiresAt: { $gt: new Date() } },
    { $set: { refreshTokenHash: hashToken(nextToken), expiresAt } },
    { new: true },
  );
  if (!session) {
    clearAuthCookies(res);
    throw httpError(401, 'Refresh session is invalid or has been revoked');
  }
  setAuthCookies(res, createAccessToken(user, session._id), nextToken);
  res.json({ user: publicUser(user) });
};

exports.logout = async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const claims = verifyRefreshToken(token);
      if (claims.type === 'refresh' && claims.sub && claims.sid) {
        await Session.deleteOne({ _id: claims.sid, userId: claims.sub });
      }
    } catch {
      // Clear browser cookies even when an expired token cannot be verified.
    }
  }
  clearAuthCookies(res);
  res.status(204).end();
};

exports.listSessions = async (req, res) => {
  const sessions = await Session.find({ userId: req.user.id, expiresAt: { $gt: new Date() } })
    .select('_id userAgent ipAddress createdAt updatedAt expiresAt').sort({ createdAt: -1 }).lean();
  res.json(sessions.map((session) => ({ ...session, current: String(session._id) === req.user.sessionId })));
};

exports.revokeOtherSessions = async (req, res) => {
  await Session.deleteMany({ userId: req.user.id, _id: { $ne: req.user.sessionId } });
  res.status(204).end();
};

exports.revokeSession = async (req, res) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.sessionId)) throw httpError(400, 'Invalid session id');
  const session = await Session.findOneAndDelete({ _id: req.params.sessionId, userId: req.user.id });
  if (!session) throw httpError(404, 'Session not found');
  if (String(session._id) === req.user.sessionId) clearAuthCookies(res);
  res.status(204).end();
};

exports.adminCheck = (req, res) => res.json({ authorized: true, role: req.user.role });
