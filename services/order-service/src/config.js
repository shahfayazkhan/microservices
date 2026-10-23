module.exports = {
  port: Number(process.env.PORT || 3003),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/order_db',
  productServiceUrl: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
};
