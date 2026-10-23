const config = require('../config');
const { AppError } = require('../lib/errors');

/** Synchronous (HTTP) call: order-service needs an immediate answer about stock + prices. */
async function reserveStock(orderId, items) {
  let res;
  try {
    res = await fetch(`${config.productServiceUrl}/internal/inventory/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, items }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    throw new AppError(503, 'Product service unavailable', err.message);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AppError(res.status, body.error || 'Stock reservation failed');
  return body; // { orderId, items: [{ productId, name, price, quantity }] }
}

module.exports = { reserveStock };
