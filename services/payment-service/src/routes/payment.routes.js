const { Router } = require('express');
const Payment = require('../models/Payment');
const { AppError } = require('../lib/errors');
const { requireUser } = require('../lib/auth');

const router = Router();
router.use(requireUser);

// GET /api/payments   (own payments)
router.get('/', async (req, res) => {
  const filter = req.user.role === 'admin' && req.query.all === 'true' ? {} : { userId: req.user.id };
  res.json(await Payment.find(filter).sort({ createdAt: -1 }).limit(100));
});

// GET /api/payments/order/:orderId
router.get('/order/:orderId', async (req, res) => {
  const payment = await Payment.findOne({ orderId: req.params.orderId });
  if (!payment || (payment.userId !== req.user.id && req.user.role !== 'admin')) {
    throw new AppError(404, 'Payment not found');
  }
  res.json(payment);
});

module.exports = router;
