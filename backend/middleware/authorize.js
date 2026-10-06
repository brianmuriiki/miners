const httpError = require('../utils/httpError');

module.exports = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return next(httpError(401, 'Not authenticated'));
  if (!allowedRoles.includes(req.user.role)) return next(httpError(403, 'You do not have permission to perform this action'));
  return next();
};
