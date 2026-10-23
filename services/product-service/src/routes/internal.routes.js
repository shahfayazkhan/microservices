const { Router } = require('express');
const inventory = require('../services/inventory');
const { AppError } = require('../lib/errors');

/**
 * Internal (service-to-service) endpoints.
 * The gateway does NOT proxy /internal, so these are only reachable inside the cluster.
 */
const router = Router();

// POST /internal/inventory/reserve  { orderId, items: [{ productId, quantity }] }
router.post('/inventory/reserve', async (req, res) => {
  const { orderId, items } = req.body || {};
  if (!orderId || !Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'orderId and a non-empty items array are required');
  }
  for (const i of items) {
    if (!i.productId || !Number.isInteger(i.quantity) || i.quantity < 1) {
      throw new AppError(400, 'Each item needs productId and a positive integer quantity');
    }
  }
  const reservation = await inventory.reserve(orderId, items);
  res.status(201).json(reservation);
});

module.exports = router;
