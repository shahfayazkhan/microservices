const Notification = require('../models/Notification');
const templates = require('../services/templates');
const { sendMail } = require('../services/mailer');
const { subscribe } = require('../lib/kafka');
const logger = require('../lib/logger');

async function handle(event) {
  if (await Notification.exists({ eventId: event.eventId })) return; // already processed

  const n = templates[event.type](event.data);
  let emailStatus = 'SKIPPED';
  if (n.email) {
    try {
      await sendMail({ to: n.email, subject: n.title, title: n.title, message: n.message });
      emailStatus = 'SENT';
    } catch (err) {
      emailStatus = 'FAILED';
      logger.error('Email send failed', { eventId: event.eventId, error: err.message });
    }
  }

  await Notification.create({ eventId: event.eventId, type: event.type, emailStatus, ...n });
  logger.info('Notification stored', { type: event.type, userId: n.userId, emailStatus });
}

module.exports = () =>
  subscribe(
    'notification-service',
    Object.fromEntries(Object.keys(templates).map((topic) => [topic, handle]))
  );
