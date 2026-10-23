const { randomUUID } = require('crypto');
const config = require('../config');

/**
 * Mock payment provider. Replace this with Stripe / Checkout.com / crypto gateway later —
 * the rest of the service (events, DB, API) stays the same.
 */
async function charge({ amount }) {
  await new Promise((r) => setTimeout(r, config.processingDelayMs));
  if (amount > config.maxAmount) {
    return { success: false, reason: `Amount ${amount} exceeds card limit of ${config.maxAmount}` };
  }
  return { success: true, transactionId: `txn_${randomUUID()}` };
}

module.exports = { charge };
