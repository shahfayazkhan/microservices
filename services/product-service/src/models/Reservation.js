const { mongoose } = require('../lib/db');

// One stock reservation per order. Makes reserve/release idempotent.
const reservationSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    items: [
      {
        _id: false,
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: String,
        price: Number,
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    status: { type: String, enum: ['RESERVED', 'RELEASED', 'COMMITTED'], default: 'RESERVED' },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Reservation', reservationSchema);
