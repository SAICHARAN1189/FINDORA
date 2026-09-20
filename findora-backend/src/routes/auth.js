// src/routes/auth.js
const express = require('express');
const router = express.Router();
const store = require('../config/demoStore');
const { authenticate, DEMO_TOKEN_PREFIX } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { resolveLinkCode, confirmLink } = require('../services/telegramService');

// POST /api/auth/demo-login - Login with demo account
router.post('/demo-login', (req, res) => {
  const { userId } = req.body;
  const validIds = ['demo-user-1', 'demo-user-2', 'demo-admin-1', 'demo-police-1', 'demo-super-1'];
  
  if (!validIds.includes(userId)) {
    return res.status(400).json({ error: 'Invalid demo user ID' });
  }

  const user = store.getUser(userId);
  const token = `${DEMO_TOKEN_PREFIX}${userId}`;
  
  store.addAuditLog({ action: 'DEMO_LOGIN', userId, details: `Demo login as ${user.displayName}` });
  
  res.json({ token, user });
});

// POST /api/auth/register - Register new user (demo creates in store)
router.post('/register', (req, res) => {
  const { email, displayName, uid } = req.body;
  if (!email || !displayName || !uid) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (store.getUser(uid)) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const user = store.createUser({
    uid,
    email,
    displayName,
    role: 'user',
    rewardPoints: 0,
    badges: ['newcomer'],
    createdAt: new Date().toISOString(),
  });

  const token = `${DEMO_TOKEN_PREFIX}${uid}`;
  store.addAuditLog({ action: 'REGISTER', userId: uid, details: `New user registered: ${email}` });
  
  res.status(201).json({ token, user });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json(req.user);
});

// PUT /api/auth/profile
router.put('/profile', authenticate, (req, res) => {
  const { displayName, photoURL } = req.body;
  const updated = store.updateUser(req.user.uid, { displayName, photoURL });
  res.json(updated);
});

// POST /api/auth/link-telegram - Link Telegram account via link code
router.post('/link-telegram', authenticate, async (req, res) => {
  const { linkCode } = req.body;
  if (!linkCode) return res.status(400).json({ error: 'linkCode is required' });

  const result = await resolveLinkCode(linkCode.toUpperCase().trim());
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  const { chatId } = result;
  const updated = store.updateUser(req.user.uid, { telegramChatId: chatId });

  // Tell the bot to send a confirmation message
  confirmLink(chatId, req.user.uid).catch(() => {});

  store.addAuditLog({ action: 'TELEGRAM_LINKED', userId: req.user.uid, details: `chat_id: ${chatId}` });
  res.json({ message: 'Telegram account linked successfully!', telegramChatId: chatId, user: updated });
});

// DELETE /api/auth/link-telegram - Unlink Telegram account
router.delete('/link-telegram', authenticate, (req, res) => {
  const updated = store.updateUser(req.user.uid, { telegramChatId: null });
  store.addAuditLog({ action: 'TELEGRAM_UNLINKED', userId: req.user.uid });
  res.json({ message: 'Telegram account unlinked.', user: updated });
});

// GET /api/auth/telegram-status - Check if Telegram is linked
router.get('/telegram-status', authenticate, (req, res) => {
  const user = store.getUser(req.user.uid);
  res.json({ linked: !!user?.telegramChatId, chatId: user?.telegramChatId || null });
});

module.exports = router;
