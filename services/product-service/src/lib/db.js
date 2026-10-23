const mongoose = require('mongoose');
const logger = require('./logger');

// Connect with retries: in Docker/K8s the DB may start after the service.
async function connectDB(uri, { retries = 20, delayMs = 3000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      logger.info('MongoDB connected', { db: mongoose.connection.name });
      return;
    } catch (err) {
      logger.warn('MongoDB connection failed, retrying', { attempt, error: err.message });
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Could not connect to MongoDB');
}

const isDBReady = () => mongoose.connection.readyState === 1;

module.exports = { connectDB, isDBReady, mongoose };
