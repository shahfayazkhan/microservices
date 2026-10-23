const { subscribe } = require('../lib/kafka');
const inventory = require('../services/inventory');

// Saga compensation: give stock back when an order is cancelled.
module.exports = () =>
  subscribe('product-service', {
    'order.cancelled': async ({ data }) => inventory.release(data.orderId),
    'order.confirmed': async ({ data }) => inventory.commit(data.orderId),
  });
