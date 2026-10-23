// Maps each Kafka event to the notification the user receives.
const money = (d) => `${d.totalAmount} ${d.currency || 'USD'}`;

module.exports = {
  'user.registered': (d) => ({
    userId: d.userId,
    email: d.email,
    title: `Welcome, ${d.name}!`,
    message: 'Your account has been created successfully. Happy shopping!',
  }),
  'order.created': (d) => ({
    userId: d.userId,
    email: d.userEmail,
    title: 'Order received',
    message: `We received your order #${d.orderId} for ${money(d)}. We are processing your payment.`,
  }),
  'order.confirmed': (d) => ({
    userId: d.userId,
    email: d.userEmail,
    title: 'Order confirmed',
    message: `Payment successful! Your order #${d.orderId} (${money(d)}) is confirmed.`,
  }),
  'order.cancelled': (d) => ({
    userId: d.userId,
    email: d.userEmail,
    title: 'Order cancelled',
    message: `Your order #${d.orderId} was cancelled. Reason: ${d.cancelReason || 'unknown'}.`,
  }),
};
