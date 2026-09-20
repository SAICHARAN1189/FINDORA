// src/routes/notifications.js
const express = require('express');
const router = express.Router();
const store = require('../config/demoStore');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications - Get user's notifications
router.get('/', authenticate, (req, res) => {
  const notifications = store.getNotificationsForUser(req.user.uid);
  const unreadCount = notifications.filter(n => !n.read).length;
  res.json({ notifications, unreadCount });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, (req, res) => {
  store.markNotificationRead(req.params.id);
  res.json({ success: true });
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, (req, res) => {
  const notifications = store.getNotificationsForUser(req.user.uid);
  notifications.forEach(n => store.markNotificationRead(n.id));
  res.json({ success: true });
});

module.exports = router;
