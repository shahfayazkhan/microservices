// Minimal structured logger (JSON lines) — easy to read with `kubectl logs`.
const SERVICE = process.env.SERVICE_NAME || 'service';

function log(level, msg, meta = {}) {
  const line = { ts: new Date().toISOString(), level, service: SERVICE, msg, ...meta };
  (level === 'error' ? console.error : console.log)(JSON.stringify(line));
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};
