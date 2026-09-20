// src/routes/chat.js
const express = require('express');
const router = express.Router();
const store = require('../config/demoStore');
const { authenticate } = require('../middleware/auth');

// GET /api/chat - Get user's chats
router.get('/', authenticate, (req, res) => {
  const chats = store.getChatsByUser(req.user.uid);
  const enriched = chats.map(c => ({
    ...c,
    otherUser: store.getUser(c.participants.find(p => p !== req.user.uid)),
  }));
  res.json({ chats: enriched });
});

// POST /api/chat - Create/get chat for a match
router.post('/', authenticate, (req, res) => {
  const { matchId, otherUserId } = req.body;
  if (!otherUserId) return res.status(400).json({ error: 'otherUserId required' });

  // Check if chat already exists
  const existing = store.getChatsByUser(req.user.uid).find(c =>
    c.participants.includes(otherUserId) && (!matchId || c.matchId === matchId)
  );

  if (existing) {
    return res.json({ chat: { ...existing, messages: store.getChatMessages(existing.id) } });
  }

  // Verify both users exist
  const otherUser = store.getUser(otherUserId);
  if (!otherUser) return res.status(404).json({ error: 'Other user not found' });

  const chat = store.createChat({
    participants: [req.user.uid, otherUserId],
    matchId: matchId || null,
    lastMessage: null,
    lastMessageAt: null,
  });

  res.status(201).json({ chat: { ...chat, messages: [] } });
});

// GET /api/chat/:chatId/messages
router.get('/:chatId/messages', authenticate, (req, res) => {
  const chat = store.getChat(req.params.chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (!chat.participants.includes(req.user.uid)) return res.status(403).json({ error: 'Access denied' });

  const messages = store.getChatMessages(req.params.chatId);
  res.json({ messages });
});

// POST /api/chat/:chatId/messages - Send message
router.post('/:chatId/messages', authenticate, (req, res) => {
  const chat = store.getChat(req.params.chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (!chat.participants.includes(req.user.uid)) return res.status(403).json({ error: 'Access denied' });

  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message text required' });
  if (text.length > 1000) return res.status(400).json({ error: 'Message too long (max 1000 chars)' });

  const message = store.addChatMessage(req.params.chatId, {
    senderId: req.user.uid,
    senderName: req.user.displayName,
    text: text.trim(),
  });

  // Notify other participant
  const otherId = chat.participants.find(p => p !== req.user.uid);
  store.createNotification({
    userId: otherId,
    type: 'new_message',
    title: '💬 New Message',
    message: `${req.user.displayName}: ${text.slice(0, 60)}${text.length > 60 ? '...' : ''}`,
    chatId: req.params.chatId,
  });

  res.status(201).json({ message });
});

module.exports = router;
