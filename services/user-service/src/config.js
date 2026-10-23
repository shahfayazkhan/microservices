module.exports = {
  port: Number(process.env.PORT || 3001),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/user_db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@shop.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@123',
};
