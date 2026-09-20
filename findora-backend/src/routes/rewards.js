// src/routes/rewards.js
const express = require('express');
const router = express.Router();
const store = require('../config/demoStore');
const { authenticate } = require('../middleware/auth');
const rewardsSystem = require('../services/rewardsSystem');

// GET /api/rewards/profile - Get user's rewards profile
router.get('/profile', authenticate, (req, res) => {
  const profile = rewardsSystem.getUserRewardStats(req.user.uid);
  res.json(profile);
});

// GET /api/rewards/leaderboard - Get public leaderboard
router.get('/leaderboard', authenticate, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const leaderboard = rewardsSystem.getLeaderboard(limit);
  res.json({ leaderboard });
});

// GET /api/rewards/history - Get user's points history
router.get('/history', authenticate, (req, res) => {
  const history = store.getPointsTransactions(req.user.uid);
  res.json({ history });
});

module.exports = router;
