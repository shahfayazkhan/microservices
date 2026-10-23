const Product = require('./models/Product');
const logger = require('./lib/logger');

const SAMPLE = [
  { name: 'Mechanical Keyboard', sku: 'KB-001', price: 120, stock: 50, description: 'RGB, hot-swappable switches' },
  { name: 'Wireless Mouse', sku: 'MS-001', price: 45, stock: 100, description: 'Ergonomic 2.4GHz mouse' },
  { name: '27" 4K Monitor', sku: 'MN-001', price: 399, stock: 20, description: 'IPS, 60Hz, USB-C' },
  { name: 'Gaming Laptop', sku: 'LP-001', price: 6500, stock: 5, description: 'Expensive item: exceeds the mock card limit' },
];

module.exports = async function seedProducts() {
  if (await Product.estimatedDocumentCount()) return;
  await Product.insertMany(SAMPLE);
  logger.info('Sample products seeded', { count: SAMPLE.length });
};
