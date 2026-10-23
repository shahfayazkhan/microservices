const Payment = require('../models/Payment');
const { charge } = require('../services/gateway');
const { subscribe, publish } = require('../lib/kafka');
const logger = require('../lib/logger');

module.exports = () =>
  subscribe('payment-service', {
    'order.created': async ({ data }) => {
      let payment;
      try {
        payment = await Payment.create({
          orderId: data.orderId,
          userId: data.userId,
          amount: data.totalAmount,
          currency: data.currency,
        });
      } catch (err) {
        if (err.code === 11000) return logger.warn('Duplicate order.created ignored', { orderId: data.orderId });
        throw err;
      }

      const result = await charge({ amount: payment.amount });
      payment.status = result.success ? 'SUCCEEDED' : 'FAILED';
      payment.transactionId = result.transactionId;
      payment.failureReason = result.reason;
      await payment.save();

      const payload = {
        paymentId: payment.id,
        orderId: payment.orderId,
        userId: payment.userId,
        userEmail: data.userEmail,
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transactionId,
        reason: payment.failureReason,
      };
      await publish(result.success ? 'payment.completed' : 'payment.failed', payload, payment.orderId);
    },
  });
