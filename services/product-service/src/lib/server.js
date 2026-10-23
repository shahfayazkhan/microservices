const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./logger');
const { notFound, errorHandler } = require('./errors');
const { isDBReady, mongoose } = require('./db');
const { isKafkaReady, disconnectKafka } = require('./kafka');

/** Builds an Express app with health endpoints used by Docker + Kubernetes probes. */
function createApp(registerRoutes) {
  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('tiny', { skip: (req) => req.path === '/health' || req.path === '/ready' }));

  // Liveness: "is the process alive?"  -> K8s restarts the pod if this fails.
  app.get('/health', (req, res) => res.json({ status: 'ok', service: process.env.SERVICE_NAME }));
  // Readiness: "can it serve traffic?" -> K8s stops sending traffic if this fails.
  app.get('/ready', (req, res) => {
    const ready = isDBReady() && isKafkaReady();
    res.status(ready ? 200 : 503).json({ db: isDBReady(), kafka: isKafkaReady() });
  });

  registerRoutes(app);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

/** Starts listening and handles SIGTERM (sent by Docker/K8s on stop) gracefully. */
function start(app, port) {
  const server = app.listen(port, () => logger.info(`Listening on port ${port}`));
  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close();
    await disconnectKafka();
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}

module.exports = { createApp, start };
