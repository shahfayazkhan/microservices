const { Router } = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { publish } = require('../lib/kafka');
const { AppError } = require('../lib/errors');
const { requireUser, requireRole } = require('../lib/auth');

const router = Router();

const signToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email, role: user.role, name: user.name }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

// POST /api/users/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) throw new AppError(400, 'name, email and password are required');
  if (await User.exists({ email: email.toLowerCase() })) throw new AppError(409, 'Email already registered');

  const user = await User.create({ name, email, password });
  // Async event -> notification-service sends a welcome email.
  await publish('user.registered', { userId: user.id, name: user.name, email: user.email }, user.id);

  res.status(201).json({ user, token: signToken(user) });
});

// POST /api/users/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new AppError(400, 'email and password are required');

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw new AppError(401, 'Invalid credentials');

  res.json({ user, token: signToken(user) });
});

// GET /api/users/me
router.get('/me', requireUser, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError(404, 'User not found');
  res.json(user);
});

// PATCH /api/users/me
router.patch('/me', requireUser, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError(404, 'User not found');
  if (req.body.name) user.name = req.body.name;
  if (req.body.password) user.password = req.body.password;
  await user.save();
  res.json(user);
});

// GET /api/users (admin)
router.get('/', requireUser, requireRole('admin'), async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(100);
  res.json(users);
});

module.exports = router;
