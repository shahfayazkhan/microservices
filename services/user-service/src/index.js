const config = require('./config');
const logger = require('./lib/logger');
const { connectDB } = require('./lib/db');
const { ensureTopics, connectProducer } = require('./lib/kafka');
const { createApp, start } = require('./lib/server');
const userRoutes = require('./routes/user.routes');
const User = require('./models/User');

async function seedAdmin() {
  if (await User.exists({ email: config.adminEmail })) return;
  await User.create({ name: 'Admin', email: config.adminEmail, password: config.adminPassword, role: 'admin' });
  logger.info('Admin user seeded', { email: config.adminEmail });
}

async function main() {
  await connectDB(config.mongoUri);
  await seedAdmin();
  await ensureTopics(['user.registered']);
  await connectProducer();

  const app = createApp((a) => a.use('/api/users', userRoutes));
  start(app, config.port);
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err.message });
  process.exit(1);
});
