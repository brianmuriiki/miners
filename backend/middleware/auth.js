const jwt = require('jsonwebtoken');
const httpError = require('../utils/httpError');

module.exports = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(httpError(401, 'Not authenticated'));
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(httpError(401, 'Invalid or expired token'));
  }
  return next();
};
