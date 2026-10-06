const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Session = require('../models/Session');
const httpError = require('../utils/httpError');
const { generateKeyPair, addressFromPublicKey, encrypt } = require('../utils/crypto');
const {
  REFRESH_COOKIE, REFRESH_TTL_SECONDS, createAccessToken, createRefreshToken,
  hashToken, setAuthCookies, clearAuthCookies, verifyRefreshToken,
} = require('../utils/sessionTokens');

const publicUser = (user) => ({ id: user._id, username: user.username, email: user.email });

async function createSession(user, res) {
  const session = new Session({
    userId: user._id,
    refreshTokenHash: 'pending',
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
  });
  const refreshToken = createRefreshToken(user._id, session._id);
  session.refreshTokenHash = hashToken(refreshToken);
  await session.save();
  setAuthCookies(res, createAccessToken(user, session._id), refreshToken);
}

exports.register = async (req, res) => {
  const { username, email, password } = req.body || {};
  if (![username, email, password].every((value) => typeof value === 'string' && value.trim().length)) throw httpError(400, 'username, email and password are required');
  if (username.trim().length < 3 || username.trim().length > 30) throw httpError(400, 'Username must be 3 to 30 characters');
  if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'Invalid email');
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim();
  const exists = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] });
  if (exists) throw httpError(409, 'Username or email already in use');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ username: normalizedUsername, email: normalizedEmail, passwordHash });
  try {
    const { publicKey, privateKey } = generateKeyPair();
    const wallet = await Wallet.create({ userId: user._id, address: addressFromPublicKey(publicKey), publicKey, encryptedPrivateKey: encrypt(privateKey) });
    await createSession(user, res);
    res.status(201).json({ user: publicUser(user), wallet: { address: wallet.address } });
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
  const valid = user && await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw httpError(401, 'Invalid credentials');
  await createSession(user, res);
  res.json({ user: publicUser(user) });
};

exports.me = async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash');
  if (!user) throw httpError(404, 'User not found');
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
    .select('_id createdAt updatedAt expiresAt').sort({ createdAt: -1 }).lean();
  res.json(sessions.map((session) => ({ ...session, current: String(session._id) === req.user.sessionId })));
};

exports.revokeSession = async (req, res) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.sessionId)) throw httpError(400, 'Invalid session id');
  const session = await Session.findOneAndDelete({ _id: req.params.sessionId, userId: req.user.id });
  if (!session) throw httpError(404, 'Session not found');
  if (String(session._id) === req.user.sessionId) clearAuthCookies(res);
  res.status(204).end();
};

exports.adminCheck = (req, res) => res.json({ authorized: true, role: req.user.role });
