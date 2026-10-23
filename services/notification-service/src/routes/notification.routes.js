const { Router } = require('express');
const Notification = require('../models/Notification');
const { AppError } = require('../lib/errors');
const { requireUser } = require('../lib/auth');

const router = Router();
router.use(requireUser);

// GET /api/notifications?unread=true
router.get('/', async (req, res) => {
  const filter = { userId: req.user.id };
  if (req.query.unread === 'true') filter.read = false;
  const [items, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ userId: req.user.id, read: false }),
  ]);
  res.json({ items, unread });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
  const result = await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
  res.json({ updated: result.modifiedCount });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { read: true }, { new: true });
  if (!n) throw new AppError(404, 'Notification not found');
  res.json(n);
});

module.exports = router;
