const { AppError } = require('./errors');

/**
 * The API Gateway verifies the JWT and forwards the user as trusted headers.
 * Services are NOT exposed outside the cluster, so only the gateway can reach them.
 */
function requireUser(req, res, next) {
  const id = req.header('x-user-id');
  if (!id) return next(new AppError(401, 'Authentication required'));
  req.user = {
    id,
    email: req.header('x-user-email'),
    role: req.header('x-user-role') || 'user',
    name: req.header('x-user-name'),
  };
  next();
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'Forbidden'));
  next();
};

module.exports = { requireUser, requireRole };
