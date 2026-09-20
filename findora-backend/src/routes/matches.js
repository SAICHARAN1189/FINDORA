// src/routes/matches.js
const express = require('express');
const router = express.Router();
const store = require('../config/demoStore');
const { authenticate, requireRole } = require('../middleware/auth');
const { computeMatch } = require('../services/aiMatcher');

// GET /api/matches - Get matches for current user
router.get('/', authenticate, (req, res) => {
  const { status } = req.query;
  let matches = store.getMatchesForUser(req.user.uid);
  
  if (['institution_admin', 'super_admin', 'police'].includes(req.user.role)) {
    matches = store.getAllMatches();
  }

  if (status) matches = matches.filter(m => m.status === status);
  matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Enrich with report data
  const enriched = matches.map(m => ({
    ...m,
    lostReport: store.getReport(m.lostReportId),
    foundReport: store.getReport(m.foundReportId),
    lostUser: store.getUser(m.lostUserId),
    foundUser: store.getUser(m.foundUserId),
  }));

  res.json({ matches: enriched });
});

// GET /api/matches/:id
router.get('/:id', authenticate, (req, res) => {
  const match = store.getMatch(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const isParticipant = match.lostUserId === req.user.uid || match.foundUserId === req.user.uid;
  const isAdmin = ['institution_admin', 'super_admin', 'police'].includes(req.user.role);
  if (!isParticipant && !isAdmin) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({
    ...match,
    lostReport: store.getReport(match.lostReportId),
    foundReport: store.getReport(match.foundReportId),
    lostUser: store.getUser(match.lostUserId),
    foundUser: store.getUser(match.foundUserId),
  });
});

// POST /api/matches/:id/accept - Lost item owner accepts match
router.post('/:id/accept', authenticate, (req, res) => {
  const match = store.getMatch(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (match.lostUserId !== req.user.uid) {
    return res.status(403).json({ error: 'Only the lost item owner can accept a match' });
  }
  if (match.status !== 'pending') {
    return res.status(400).json({ error: `Match is already ${match.status}` });
  }

  const updated = store.updateMatch(req.params.id, { status: 'accepted' });
  
  // Notify the finder
  store.createNotification({
    userId: match.foundUserId,
    type: 'match_accepted',
    title: '✅ Match Accepted!',
    message: 'The potential owner has accepted the match. Please select a return method.',
    matchId: match.id,
  });

  store.addAuditLog({ action: 'MATCH_ACCEPTED', userId: req.user.uid, matchId: match.id });
  res.json({ ...updated, lostReport: store.getReport(match.lostReportId), foundReport: store.getReport(match.foundReportId) });
});

// POST /api/matches/:id/reject
router.post('/:id/reject', authenticate, (req, res) => {
  const match = store.getMatch(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  
  const isParticipant = match.lostUserId === req.user.uid || match.foundUserId === req.user.uid;
  if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

  const updated = store.updateMatch(req.params.id, { status: 'rejected', rejectedBy: req.user.uid, rejectedReason: req.body.reason || 'Not the right item' });
  
  // Reset report status to active
  store.updateReport(match.lostReportId, { status: 'active' });
  store.updateReport(match.foundReportId, { status: 'active' });

  store.addAuditLog({ action: 'MATCH_REJECTED', userId: req.user.uid, matchId: match.id });
  res.json(updated);
});

// POST /api/matches/:id/verify - Mark as verified (owner confirmed it's theirs)
router.post('/:id/verify', authenticate, (req, res) => {
  const match = store.getMatch(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (match.lostUserId !== req.user.uid) return res.status(403).json({ error: 'Only lost item owner can verify' });

  const { returnMethod } = req.body; // 'direct' | 'locker' | 'institution'
  const updated = store.updateMatch(req.params.id, { status: 'verified', returnMethod });

  // Award reward to finder
  const founder = store.getUser(match.foundUserId);
  if (founder) {
    store.updateUser(match.foundUserId, { rewardPoints: (founder.rewardPoints || 0) + 100 });
    if (!founder.badges.includes('good_samaritan')) {
      store.updateUser(match.foundUserId, { badges: [...founder.badges, 'good_samaritan'] });
    }
  }

  store.createNotification({
    userId: match.foundUserId,
    type: 'match_verified',
    title: '🏆 Ownership Verified!',
    message: `The owner has verified the item. Return method: ${returnMethod}. You earned 100 points!`,
    matchId: match.id,
  });

  store.addAuditLog({ action: 'MATCH_VERIFIED', userId: req.user.uid, matchId: match.id, details: `Return method: ${returnMethod}` });
  res.json(updated);
});

// POST /api/matches/:id/complete - Mark case as completed
router.post('/:id/complete', authenticate, (req, res) => {
  const match = store.getMatch(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const updated = store.updateMatch(req.params.id, { status: 'completed', completedAt: new Date().toISOString() });
  store.updateReport(match.lostReportId, { status: 'collected' });
  store.updateReport(match.foundReportId, { status: 'collected' });

  // Final reward to lost user
  const lostUser = store.getUser(match.lostUserId);
  if (lostUser) {
    store.updateUser(match.lostUserId, { rewardPoints: (lostUser.rewardPoints || 0) + 25 });
  }

  store.createNotification({
    userId: match.lostUserId,
    type: 'case_completed',
    title: '🎉 Item Recovered!',
    message: 'Your lost item has been successfully recovered. Case closed.',
    matchId: match.id,
  });

  store.addAuditLog({ action: 'CASE_COMPLETED', userId: req.user.uid, matchId: match.id });
  res.json(updated);
});

module.exports = router;
