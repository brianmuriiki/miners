const Session = require('../models/Session');
const { ACCESS_COOKIE, verifyAccessToken } = require('../utils/sessionTokens');
const httpError = require('../utils/httpError');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = bearer || req.cookies?.[ACCESS_COOKIE];
  if (!token) return next(httpError(401, 'Not authenticated'));
  let claims;
  try {
    claims = verifyAccessToken(token);
    if (claims.type !== 'access' || !claims.sub || !claims.sid) throw new Error('Invalid access token');
  } catch {
    return next(httpError(401, 'Invalid or expired token'));
  }
  const session = await Session.findOne({ _id: claims.sid, userId: claims.sub, expiresAt: { $gt: new Date() } }).select('_id userId');
  if (!session) return next(httpError(401, 'Invalid or expired token'));
  req.user = { id: String(claims.sub), role: claims.role, sessionId: String(session._id) };
  return next();
};
