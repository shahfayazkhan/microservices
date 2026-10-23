const { mongoose } = require('../lib/db');

const notificationSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true }, // dedupe: Kafka is at-least-once
    userId: { type: String, required: true, index: true },
    email: String,
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    emailStatus: { type: String, enum: ['SENT', 'FAILED', 'SKIPPED'], default: 'SKIPPED' },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Notification', notificationSchema);
