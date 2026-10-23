const { services } = require('./config');

/**
 * Routing table. `public` rules don't need a JWT; everything else does.
 * Only /api/* paths are proxied — /internal/* endpoints stay private inside the cluster.
 */
module.exports = [
  {
    prefix: '/api/users',
    target: services.user,
    public: [
      { method: 'POST', path: '/api/users/register' },
      { method: 'POST', path: '/api/users/login' },
    ],
  },
  { prefix: '/api/products', target: services.product, public: [{ method: 'GET', path: '/api/products' }] },
  { prefix: '/api/orders', target: services.order },
  { prefix: '/api/payments', target: services.payment },
  { prefix: '/api/notifications', target: services.notification },
];
