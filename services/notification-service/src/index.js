const config = require('./config');
const logger = require('./lib/logger');
const { connectDB } = require('./lib/db');
const { ensureTopics, connectProducer } = require('./lib/kafka');
const { createApp, start } = require('./lib/server');
const notificationRoutes = require('./routes/notification.routes');
const startConsumers = require('./events/consumers');
const templates = require('./services/templates');

async function main() {
  await connectDB(config.mongoUri);
  const topics = Object.keys(templates);
  await ensureTopics([...topics, ...topics.map((t) => `${t}.dlq`)]);
  await connectProducer(); // used for DLQ publishing
  await startConsumers();

  const app = createApp((a) => a.use('/api/notifications', notificationRoutes));
  start(app, config.port);
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err.message });
  process.exit(1);
});
