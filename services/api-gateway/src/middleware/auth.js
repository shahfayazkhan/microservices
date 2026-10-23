const jwt = require('jsonwebtoken');
const config = require('../config');
const routes = require('../routes');

const isPublic = (req) => {
  const path = req.baseUrl + req.path; // full path, e.g. /api/users/login
  return routes.some((r) =>
    (r.public || []).some((p) => p.method === req.method && (path === p.path || path.startsWith(`${p.path}/`)))
  );
};

/**
 * Verifies the JWT once at the edge and forwards the identity as headers.
 * Client-supplied x-user-* headers are always stripped to prevent spoofing.
 */
module.exports = function authGate(req, res, next) {
  for (const h of ['x-user-id', 'x-user-email', 'x-user-role', 'x-user-name']) delete req.headers[h];

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      req.headers['x-user-id'] = payload.sub;
      req.headers['x-user-email'] = payload.email;
      req.headers['x-user-role'] = payload.role;
      req.headers['x-user-name'] = payload.name || '';
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } else if (!isPublic(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};
