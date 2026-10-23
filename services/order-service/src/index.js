const config = require('./config');
const logger = require('./lib/logger');
const { connectDB } = require('./lib/db');
const { ensureTopics, connectProducer } = require('./lib/kafka');
const { createApp, start } = require('./lib/server');
const orderRoutes = require('./routes/order.routes');
const startConsumers = require('./events/consumers');

async function main() {
  await connectDB(config.mongoUri);
  await ensureTopics([
    'order.created', 'order.confirmed', 'order.cancelled',
    'payment.completed', 'payment.failed', 'payment.completed.dlq', 'payment.failed.dlq',
  ]);
  await connectProducer();
  await startConsumers();

  const app = createApp((a) => a.use('/api/orders', orderRoutes));
  start(app, config.port);
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err.message });
  process.exit(1);
});
