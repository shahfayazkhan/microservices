const { mongoose } = require('../lib/db');

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true }, // unique => never charge an order twice
    userId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    status: { type: String, enum: ['PROCESSING', 'SUCCEEDED', 'FAILED'], default: 'PROCESSING' },
    provider: { type: String, default: 'mock' },
    transactionId: String,
    failureReason: String,
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Payment', paymentSchema);
