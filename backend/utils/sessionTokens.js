const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const ACCESS_COOKIE = 'cw_access';
const REFRESH_COOKIE = 'cw_refresh';

function tokenClaims() {
  return { issuer: 'crywallet', audience: 'crywallet-api' };
}

function createAccessToken(user, sessionId) {
  return jwt.sign({ sub: String(user._id), role: user.role, sid: String(sessionId), type: 'access' }, process.env.JWT_SECRET, {
    ...tokenClaims(), algorithm: 'HS256', expiresIn: ACCESS_TTL_SECONDS,
  });
}

function createRefreshToken(userId, sessionId) {
  return jwt.sign({ sub: String(userId), sid: String(sessionId), type: 'refresh' }, process.env.JWT_REFRESH_SECRET, {
    ...tokenClaims(), algorithm: 'HS256', expiresIn: REFRESH_TTL_SECONDS,
  });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setAuthCookies(res, accessToken, refreshToken) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true, secure, sameSite: 'strict', path: '/api', maxAge: ACCESS_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true, secure, sameSite: 'strict', path: '/api/auth', maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

function clearAuthCookies(res) {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie(ACCESS_COOKIE, { httpOnly: true, secure, sameSite: 'strict', path: '/api' });
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure, sameSite: 'strict', path: '/api/auth' });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { ...tokenClaims(), algorithms: ['HS256'] });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, { ...tokenClaims(), algorithms: ['HS256'] });
}

module.exports = {
  ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_TTL_SECONDS,
  createAccessToken, createRefreshToken, hashToken, setAuthCookies, clearAuthCookies,
  verifyAccessToken, verifyRefreshToken,
};
