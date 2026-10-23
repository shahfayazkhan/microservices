const Order = require('../models/Order');
const { subscribe, publish } = require('../lib/kafka');
const logger = require('../lib/logger');

const orderPayload = (o) => ({
  orderId: o.id,
  userId: o.userId,
  userEmail: o.userEmail,
  totalAmount: o.totalAmount,
  currency: o.currency,
  status: o.status,
  cancelReason: o.cancelReason,
});

module.exports = () =>
  subscribe('order-service', {
    'payment.completed': async ({ data }) => {
      // Conditional update = idempotent: a duplicate event changes nothing.
      const order = await Order.findOneAndUpdate(
        { _id: data.orderId, status: 'PENDING' },
        { status: 'PAID', paymentId: data.paymentId },
        { new: true }
      );
      if (!order) return logger.warn('payment.completed ignored', { orderId: data.orderId });
      await publish('order.confirmed', orderPayload(order), order.id);
    },

    'payment.failed': async ({ data }) => {
      const order = await Order.findOneAndUpdate(
        { _id: data.orderId, status: 'PENDING' },
        { status: 'CANCELLED', cancelReason: data.reason, paymentId: data.paymentId },
        { new: true }
      );
      if (!order) return logger.warn('payment.failed ignored', { orderId: data.orderId });
      // product-service listens to this and releases the reserved stock (saga compensation).
      await publish('order.cancelled', orderPayload(order), order.id);
    },
  });
