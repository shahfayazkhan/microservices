const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { randomUUID } = require('crypto');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('./config');
const routes = require('./routes');
const authGate = require('./middleware/auth');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(morgan('tiny', { skip: (req) => req.path === '/health' }));
// NOTE: no express.json() here — the raw body is streamed straight to the services.

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

// Aggregated health: handy to see which service is down.
app.get('/health/services', async (req, res) => {
  const results = await Promise.all(
    Object.entries(config.services).map(async ([name, url]) => {
      try {
        const r = await fetch(`${url}/ready`, { signal: AbortSignal.timeout(2000) });
        return [name, r.ok ? 'up' : 'not-ready'];
      } catch {
        return [name, 'down'];
      }
    })
  );
  const status = Object.fromEntries(results);
  res.status(Object.values(status).every((s) => s === 'up') ? 200 : 503).json(status);
});

app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

// Correlation id -> follow one request across all service logs.
app.use((req, res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', req.headers['x-request-id']);
  next();
});

app.use('/api', authGate);

for (const route of routes) {
  app.use(
    createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      pathFilter: route.prefix,
      proxyTimeout: 10_000,
      on: {
        error: (err, req, res) => {
          if (res.headersSent) return;
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Upstream service unavailable', target: route.prefix }));
        },
      },
    })
  );
}

app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` }));

const server = app.listen(config.port, () => console.log(`api-gateway listening on ${config.port}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
