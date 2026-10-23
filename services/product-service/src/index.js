const config = require('./config');
const logger = require('./lib/logger');
const { connectDB } = require('./lib/db');
const { ensureTopics, connectProducer } = require('./lib/kafka');
const { createApp, start } = require('./lib/server');
const productRoutes = require('./routes/product.routes');
const internalRoutes = require('./routes/internal.routes');
const startConsumers = require('./events/consumers');
const seedProducts = require('./seed');

async function main() {
  await connectDB(config.mongoUri);
  await seedProducts();
  await ensureTopics(['order.cancelled', 'order.confirmed', 'order.cancelled.dlq', 'order.confirmed.dlq']);
  await connectProducer();
  await startConsumers();

  const app = createApp((a) => {
    a.use('/api/products', productRoutes);
    a.use('/internal', internalRoutes);
  });
  start(app, config.port);
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err.message });
  process.exit(1);
});
