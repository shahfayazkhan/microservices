const { Router } = require('express');
const Order = require('../models/Order');
const { reserveStock } = require('../clients/product.client');
const { publish } = require('../lib/kafka');
const { AppError } = require('../lib/errors');
const { requireUser } = require('../lib/auth');

const router = Router();
router.use(requireUser);

// POST /api/orders   { items: [{ productId, quantity }] }
router.post('/', async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) throw new AppError(400, 'items must be a non-empty array');

  // 1) Generate the id first so the stock reservation can reference it.
  const order = new Order({ userId: req.user.id, userEmail: req.user.email });

  // 2) Reserve stock + get authoritative prices from product-service (never trust client prices).
  const reservation = await reserveStock(order.id, items);
  order.items = reservation.items.map((i) => ({ ...i, productId: String(i.productId) }));
  order.totalAmount = Number(order.items.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2));
  await order.save();

  // 3) Async: payment-service charges, notification-service emails.
  await publish(
    'order.created',
    {
      orderId: order.id,
      userId: order.userId,
      userEmail: order.userEmail,
      items: order.items,
      totalAmount: order.totalAmount,
      currency: order.currency,
    },
    order.id
  );

  res.status(201).json(order);
});

// GET /api/orders   (own orders; admin can pass ?all=true)
router.get('/', async (req, res) => {
  const filter = req.user.role === 'admin' && req.query.all === 'true' ? {} : { userId: req.user.id };
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(100));
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order || (order.userId !== req.user.id && req.user.role !== 'admin')) throw new AppError(404, 'Order not found');
  res.json(order);
});

module.exports = router;
