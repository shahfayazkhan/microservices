module.exports = {
  port: Number(process.env.PORT || 3005),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/notification_db',
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  mailFrom: process.env.MAIL_FROM || 'Shop <no-reply@shop.local>',
};
