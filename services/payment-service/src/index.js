const config = require('./config');
const logger = require('./lib/logger');
const { connectDB } = require('./lib/db');
const { ensureTopics, connectProducer } = require('./lib/kafka');
const { createApp, start } = require('./lib/server');
const paymentRoutes = require('./routes/payment.routes');
const startConsumers = require('./events/consumers');

async function main() {
  await connectDB(config.mongoUri);
  await ensureTopics(['order.created', 'order.created.dlq', 'payment.completed', 'payment.failed']);
  await connectProducer();
  await startConsumers();

  const app = createApp((a) => a.use('/api/payments', paymentRoutes));
  start(app, config.port);
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err.message });
  process.exit(1);
});
