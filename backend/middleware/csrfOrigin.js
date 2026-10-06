const httpError = require('../utils/httpError');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

module.exports = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== process.env.CLIENT_URL) return next(httpError(403, 'Request origin is not allowed'));
  if (!origin && !req.headers.authorization && (req.cookies?.cw_access || req.cookies?.cw_refresh)) {
    return next(httpError(403, 'Origin header is required for cookie-authenticated requests'));
  }
  return next();
};
