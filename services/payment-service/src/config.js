module.exports = {
  port: Number(process.env.PORT || 3004),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/payment_db',
  // Mock gateway rules: amounts above this "card limit" are declined.
  maxAmount: Number(process.env.PAYMENT_MAX_AMOUNT || 5000),
  processingDelayMs: Number(process.env.PAYMENT_DELAY_MS || 1500),
};
