const { mongoose } = require('../lib/db');

const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true },
    items: [
      {
        _id: false,
        productId: { type: String, required: true },
        name: String,
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    // PENDING -> PAID (payment.completed) | CANCELLED (payment.failed)
    status: { type: String, enum: ['PENDING', 'PAID', 'CANCELLED'], default: 'PENDING', index: true },
    paymentId: String,
    cancelReason: String,
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Order', orderSchema);
