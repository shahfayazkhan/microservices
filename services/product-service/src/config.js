module.exports = {
  port: Number(process.env.PORT || 3002),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/product_db',
};
