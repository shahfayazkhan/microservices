const { Router } = require('express');
const Product = require('../models/Product');
const { AppError } = require('../lib/errors');
const { requireUser, requireRole } = require('../lib/auth');

const router = Router();
const admin = [requireUser, requireRole('admin')];

// GET /api/products?search=&page=1&limit=20   (public)
router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = { isActive: true };
  if (req.query.search) filter.$text = { $search: String(req.query.search) };

  const [items, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
});

// GET /api/products/:id   (public)
router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError(404, 'Product not found');
  res.json(product);
});

// POST /api/products   (admin)
router.post('/', ...admin, async (req, res) => {
  const { name, description, sku, price, stock } = req.body || {};
  res.status(201).json(await Product.create({ name, description, sku, price, stock }));
});

// PATCH /api/products/:id   (admin)
router.patch('/:id', ...admin, async (req, res) => {
  const allowed = ['name', 'description', 'price', 'stock', 'isActive'];
  const update = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
  const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!product) throw new AppError(404, 'Product not found');
  res.json(product);
});

// DELETE /api/products/:id   (admin, soft delete)
router.delete('/:id', ...admin, async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!product) throw new AppError(404, 'Product not found');
  res.status(204).end();
});

module.exports = router;
