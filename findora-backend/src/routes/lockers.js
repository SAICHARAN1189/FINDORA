// src/routes/lockers.js
// Smart Locker API + Software Simulation Mode
const express = require('express');
const router = express.Router();
const store = require('../config/demoStore');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateOTP, getOTPExpiry, isOTPExpired, recordAttempt, isRateLimited, clearAttempts } = require('../services/otpService');
const { sendOTPViaTelegram } = require('../services/telegramService');

const LOCKER_STATES = ['AVAILABLE', 'RESERVED', 'ITEM_DEPOSITED', 'READY_FOR_COLLECTION', 'OPEN', 'COLLECTED', 'OFFLINE', 'ERROR'];

// GET /api/lockers - List all lockers
router.get('/', authenticate, (req, res) => {
  const lockers = store.getAllLockers();
  const enriched = lockers.map(l => ({
    ...l,
    session: l.sessionId ? store.getLockerSession(l.sessionId) : null,
  }));
  res.json({ lockers: enriched });
});

// GET /api/lockers/:id
router.get('/:id', authenticate, (req, res) => {
  const locker = store.getLocker(req.params.id);
  if (!locker) return res.status(404).json({ error: 'Locker not found' });
  res.json({ ...locker, session: locker.sessionId ? store.getLockerSession(locker.sessionId) : null });
});

// POST /api/lockers/assign - Assign a locker for a match
router.post('/assign', authenticate, (req, res) => {
  const { matchId, reportId } = req.body;
  if (!matchId) return res.status(400).json({ error: 'matchId is required' });

  const match = store.getMatch(matchId);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const isParticipant = match.lostUserId === req.user.uid || match.foundUserId === req.user.uid;
  if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

  // Find available locker
  const available = store.getAllLockers().find(l => l.state === 'AVAILABLE');
  if (!available) return res.status(503).json({ error: 'No lockers available. Try again later.' });

  // Generate OTP
  const otp = generateOTP();
  const otpExpiry = getOTPExpiry(parseInt(process.env.OTP_EXPIRY_MINUTES || '10'));

  // Create session
  const session = store.createLockerSession({
    lockerId: available.id,
    matchId,
    reportId: reportId || match.foundReportId,
    depositedBy: match.foundUserId,
    claimedBy: match.lostUserId,
    otp,
    otpExpiry,
    otpAttempts: 0,
    state: 'RESERVED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Update locker state
  store.updateLocker(available.id, { state: 'RESERVED', sessionId: session.id });

  // Notify both users
  store.createNotification({
    userId: match.foundUserId,
    type: 'locker_assigned',
    title: '🔒 Locker Assigned',
    message: `Locker ${available.name} at ${available.location} has been reserved. Please deposit the item.`,
    matchId,
    sessionId: session.id,
  });
  store.createNotification({
    userId: match.lostUserId,
    type: 'locker_assigned',
    title: '🔒 Locker Ready',
    message: `Item will be deposited at ${available.name}. Your OTP will be sent when the item is ready for collection.`,
    matchId,
    sessionId: session.id,
  });

  store.addAuditLog({ action: 'LOCKER_ASSIGNED', userId: req.user.uid, matchId, lockerId: available.id, sessionId: session.id });

  res.json({
    locker: available,
    session: {
      ...session,
      otp: req.user.uid === match.lostUserId ? otp : '******', // Only show OTP to owner
    },
  });
});

// POST /api/lockers/sessions/:sessionId/deposit - Finder marks item as deposited
router.post('/sessions/:sessionId/deposit', authenticate, (req, res) => {
  const session = store.getLockerSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.depositedBy !== req.user.uid) return res.status(403).json({ error: 'Only the finder can deposit the item' });
  if (session.state !== 'RESERVED') return res.status(400).json({ error: `Cannot deposit: locker is ${session.state}` });

  const updated = store.updateLockerSession(req.params.sessionId, { state: 'ITEM_DEPOSITED' });
  store.updateLocker(session.lockerId, { state: 'ITEM_DEPOSITED' });

  // Notify owner with OTP (in-app)
  store.createNotification({
    userId: session.claimedBy,
    type: 'item_deposited',
    title: '📦 Item Deposited in Locker!',
    message: `Your item has been placed in the locker. Use OTP: ${session.otp} to collect it. Valid for 10 minutes.`,
    sessionId: session.id,
    otp: session.otp,
  });

  // Also send OTP via Telegram if the claimer has linked their account
  const claimer = store.getUser(session.claimedBy);
  if (claimer?.telegramChatId) {
    const locker = store.getLocker(session.lockerId);
    const report = session.reportId ? store.getReport(session.reportId) : null;
    const itemDesc = report?.title || 'your item';
    const lockerName = locker ? `${locker.name} – ${locker.location}` : 'the locker';
    sendOTPViaTelegram(claimer.telegramChatId, session.otp, itemDesc, lockerName).catch(() => {});
  }

  store.addAuditLog({ action: 'ITEM_DEPOSITED', userId: req.user.uid, sessionId: session.id, lockerId: session.lockerId });
  res.json({ session: updated, locker: store.getLocker(session.lockerId) });
});

// POST /api/lockers/sessions/:sessionId/verify-otp - Owner enters OTP to unlock
router.post('/sessions/:sessionId/verify-otp', authenticate, (req, res) => {
  const session = store.getLockerSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.claimedBy !== req.user.uid) return res.status(403).json({ error: 'Only the owner can claim from locker' });
  if (!['ITEM_DEPOSITED', 'READY_FOR_COLLECTION'].includes(session.state)) {
    return res.status(400).json({ error: `Cannot unlock: locker state is ${session.state}` });
  }

  // Rate limit check
  const limitStatus = isRateLimited(session.id);
  if (limitStatus && limitStatus.limited) {
    return res.status(429).json({ error: 'Too many OTP attempts. Try again later.', lockedUntil: limitStatus.lockedUntil });
  }

  const { otp } = req.body;
  if (!otp) return res.status(400).json({ error: 'OTP is required' });

  // Check expiry
  if (isOTPExpired(session.otpExpiry)) {
    return res.status(400).json({ error: 'OTP has expired. Request a new one.' });
  }

  // Check OTP
  if (otp !== session.otp) {
    const { locked, remainingAttempts } = recordAttempt(session.id);
    store.addAuditLog({ action: 'INVALID_OTP', userId: req.user.uid, sessionId: session.id, details: `Wrong OTP entered` });
    return res.status(400).json({
      error: 'Invalid OTP',
      remainingAttempts,
      locked,
    });
  }

  // OTP valid - unlock
  clearAttempts(session.id);
  const updated = store.updateLockerSession(session.id, { state: 'OPEN', unlockedAt: new Date().toISOString() });
  store.updateLocker(session.lockerId, { state: 'OPEN' });

  // Simulate auto-close after 30 seconds (in real system, door sensor closes it)
  setTimeout(() => {
    const s = store.getLockerSession(session.id);
    if (s && s.state === 'OPEN') {
      store.updateLockerSession(session.id, { state: 'COLLECTED', collectedAt: new Date().toISOString() });
      store.updateLocker(session.lockerId, { state: 'AVAILABLE', sessionId: null });
      
      // Complete the match
      const match = store.getMatch(session.matchId);
      if (match && match.status !== 'completed') {
        store.updateMatch(session.matchId, { status: 'completed', completedAt: new Date().toISOString() });
        store.updateReport(match.lostReportId, { status: 'collected' });
        store.updateReport(match.foundReportId, { status: 'collected' });
        
        store.createNotification({
          userId: session.claimedBy,
          type: 'item_collected',
          title: '🎉 Item Successfully Collected!',
          message: 'You have collected your item. Case is now closed.',
          sessionId: session.id,
          matchId: session.matchId,
        });
      }
    }
  }, 15000); // 15 seconds in simulation (10 min in real)

  store.addAuditLog({ action: 'LOCKER_UNLOCKED', userId: req.user.uid, sessionId: session.id, lockerId: session.lockerId });
  res.json({ session: updated, locker: store.getLocker(session.lockerId), message: 'Locker unlocked! Collect your item.' });
});

// POST /api/lockers/sessions/:sessionId/collect - Confirm collection
router.post('/sessions/:sessionId/collect', authenticate, (req, res) => {
  const session = store.getLockerSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.claimedBy !== req.user.uid) return res.status(403).json({ error: 'Access denied' });

  const updated = store.updateLockerSession(session.id, { state: 'COLLECTED', collectedAt: new Date().toISOString() });
  store.updateLocker(session.lockerId, { state: 'AVAILABLE', sessionId: null });

  const match = store.getMatch(session.matchId);
  if (match) {
    store.updateMatch(session.matchId, { status: 'completed', completedAt: new Date().toISOString() });
    store.updateReport(match.lostReportId, { status: 'collected' });
    store.updateReport(match.foundReportId, { status: 'collected' });
  }

  store.addAuditLog({ action: 'ITEM_COLLECTED', userId: req.user.uid, sessionId: session.id });
  res.json({ session: updated, message: 'Item collected! Case completed.' });
});

// POST /api/lockers/sessions/:sessionId/resend-otp - Resend/regenerate OTP
router.post('/sessions/:sessionId/resend-otp', authenticate, (req, res) => {
  const session = store.getLockerSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.claimedBy !== req.user.uid) return res.status(403).json({ error: 'Access denied' });

  const newOtp = generateOTP();
  const newExpiry = getOTPExpiry(10);
  clearAttempts(session.id);
  const updated = store.updateLockerSession(session.id, { otp: newOtp, otpExpiry: newExpiry });

  store.createNotification({
    userId: session.claimedBy,
    type: 'otp_resent',
    title: '🔑 New OTP Generated',
    message: `Your new OTP is: ${newOtp}. Valid for 10 minutes.`,
    sessionId: session.id,
    otp: newOtp,
  });

  // Resend via Telegram too
  const claimer = store.getUser(session.claimedBy);
  if (claimer?.telegramChatId) {
    const locker = store.getLocker(session.lockerId);
    const report = session.reportId ? store.getReport(session.reportId) : null;
    const itemDesc = report?.title || 'your item';
    const lockerName = locker ? `${locker.name} – ${locker.location}` : 'the locker';
    sendOTPViaTelegram(claimer.telegramChatId, newOtp, itemDesc, lockerName).catch(() => {});
  }

  store.addAuditLog({ action: 'OTP_RESENT', userId: req.user.uid, sessionId: session.id });
  res.json({ message: 'New OTP sent', otp: newOtp, expiry: newExpiry });
});

// GET /api/lockers/sessions/:sessionId
router.get('/sessions/:sessionId', authenticate, (req, res) => {
  const session = store.getLockerSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const isParticipant = session.claimedBy === req.user.uid || session.depositedBy === req.user.uid;
  const isAdmin = ['institution_admin', 'super_admin'].includes(req.user.role);
  if (!isParticipant && !isAdmin) return res.status(403).json({ error: 'Access denied' });

  res.json({
    ...session,
    otp: session.claimedBy === req.user.uid ? session.otp : '******',
    locker: store.getLocker(session.lockerId),
  });
});

// POST /api/lockers/:id/heartbeat - ESP32 heartbeat endpoint
router.post('/:id/heartbeat', (req, res) => {
  const { state, firmwareVersion } = req.body;
  const locker = store.getLocker(req.params.id);
  if (!locker) return res.status(404).json({ error: 'Locker not registered' });

  store.updateLocker(req.params.id, {
    lastHeartbeat: new Date().toISOString(),
    ...(state && LOCKER_STATES.includes(state) ? { state } : {}),
    ...(firmwareVersion ? { firmwareVersion } : {}),
  });

  // Send any pending commands
  const session = locker.sessionId ? store.getLockerSession(locker.sessionId) : null;
  res.json({
    command: session?.pendingCommand || 'NONE',
    sessionId: locker.sessionId,
    timestamp: new Date().toISOString(),
  });
});

// Admin: Update locker state (simulation)
router.put('/:id/state', authenticate, requireRole('institution_admin', 'super_admin'), (req, res) => {
  const { state } = req.body;
  if (!LOCKER_STATES.includes(state)) return res.status(400).json({ error: 'Invalid state' });
  const updated = store.updateLocker(req.params.id, { state });
  store.addAuditLog({ action: 'LOCKER_STATE_CHANGED', userId: req.user.uid, lockerId: req.params.id, details: `State -> ${state}` });
  res.json(updated);
});

module.exports = router;
