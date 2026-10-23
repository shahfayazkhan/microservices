const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const { AppError } = require('../lib/errors');
const logger = require('../lib/logger');

/**
 * Atomically reserve stock for an order.
 * Each item uses a conditional update (stock >= qty), so two orders can never oversell.
 * If any item fails, the already-reserved items are rolled back.
 */
async function reserve(orderId, items) {
  const existing = await Reservation.findOne({ orderId });
  if (existing) return existing; // idempotent

  const reserved = [];
  try {
    for (const { productId, quantity } of items) {
      const product = await Product.findOneAndUpdate(
        { _id: productId, isActive: true, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true }
      );
      if (!product) {
        const exists = await Product.exists({ _id: productId, isActive: true });
        throw new AppError(exists ? 409 : 404, exists ? `Insufficient stock for product ${productId}` : `Product ${productId} not found`);
      }
      reserved.push({ productId: product._id, name: product.name, price: product.price, quantity });
    }
    return await Reservation.create({ orderId, items: reserved });
  } catch (err) {
    await Promise.all(reserved.map((i) => Product.updateOne({ _id: i.productId }, { $inc: { stock: i.quantity } })));
    throw err;
  }
}

/** Put stock back (order cancelled / payment failed). Only once per reservation. */
async function release(orderId) {
  const reservation = await Reservation.findOneAndUpdate(
    { orderId, status: 'RESERVED' },
    { status: 'RELEASED' },
    { new: true }
  );
  if (!reservation) return;
  await Promise.all(
    reservation.items.map((i) => Product.updateOne({ _id: i.productId }, { $inc: { stock: i.quantity } }))
  );
  logger.info('Stock released', { orderId });
}

/** Payment succeeded -> reservation becomes final. */
async function commit(orderId) {
  await Reservation.updateOne({ orderId, status: 'RESERVED' }, { status: 'COMMITTED' });
}

module.exports = { reserve, release, commit };
