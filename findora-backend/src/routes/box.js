// src/routes/box.js
// Direct hardware integration for ESP32 Smart Locker Keypad

const express = require('express');
const router = express.Router();
const store = require('../config/demoStore');

// In-memory set of valid OTPs generated across the system
const registeredOTPs = new Set([
  '093115',
  '254012',
  '848530',
  '847291',
  '123456',
  '000000',
]);

/**
 * Re-arms Locker A2 back to ITEM_DEPOSITED with a new OTP for continuous testing.
 */
function rearmLocker(lockerId = 'locker-002', customOtp = null) {
  const newOtp = customOtp ? String(customOtp).trim() : `${Math.floor(100000 + Math.random() * 900000)}`;
  registeredOTPs.add(newOtp);

  try {
    if (store.updateLockerSession) {
      store.updateLockerSession('session-001', {
        state: 'ITEM_DEPOSITED',
        otp: newOtp,
        unlockedAt: null,
        collectedAt: null,
      });
    }
    if (store.updateLocker) {
      store.updateLocker(lockerId, {
        state: 'ITEM_DEPOSITED',
        sessionId: 'session-001',
      });
    }
  } catch (e) {
    console.warn('Error in rearmLocker:', e.message);
  }

  console.log(`🔄 [LOCKER RE-ARMED] Locker ${lockerId} set to ITEM_DEPOSITED with OTP: ${newOtp}`);
  return newOtp;
}

/**
 * Registers an OTP code from Telegram bot or web UI
 */
function registerOTP(otp) {
  if (otp) {
    const code = String(otp).trim();
    registeredOTPs.add(code);
    try {
      if (store.updateLockerSession) {
        store.updateLockerSession('session-001', { otp: code, state: 'ITEM_DEPOSITED' });
      }
      if (store.updateLocker) {
        store.updateLocker('locker-002', { state: 'ITEM_DEPOSITED', sessionId: 'session-001' });
      }
    } catch (e) {}
    console.log(`📥 [OTP REGISTERED] Code: ${code} - Locker A2 armed!`);
  }
}

/**
 * POST /api/v1/box/register-otp
 * Called whenever an OTP is issued to a user.
 */
router.post('/register-otp', (req, res) => {
  const otp = (req.body.otp || req.body.otp_code || '').trim();
  if (otp) {
    registerOTP(otp);
  }
  res.json({ ok: true, registered: otp });
});

/**
 * POST /api/v1/box/verify-otp
 * Called directly by ESP32 HTTPClient when user enters OTP on 4x4 keypad.
 * Expected Request: { "box_id": "BOX001", "otp_code": "093115" }
 * Expected Response: { "success": true } or { "success": false, "message": "..." }
 */
router.post('/verify-otp', (req, res) => {
  const boxId = req.body.box_id || 'BOX001';
  const otp = (req.body.otp_code || req.body.otp || '').trim();

  console.log(`\n========================================`);
  console.log(`🔑 [ESP32 KEYPAD REQUEST] Box: ${boxId}, Entered OTP: ${otp}`);
  console.log(`========================================`);

  if (!otp) {
    return res.json({ success: false, message: 'OTP is required' });
  }

  // 1. Search for an active session with this OTP
  const sessions = store.getAllLockerSessions ? store.getAllLockerSessions() : Object.values(store.lockerSessions || {});
  const matchingSession = sessions.find((s) => s.otp === otp);

  // 2. Check if it's in registeredOTPs
  const isRegistered = registeredOTPs.has(otp);

  if (matchingSession || isRegistered) {
    const sessionId = matchingSession ? matchingSession.id : 'session-001';
    const lockerId = matchingSession ? matchingSession.lockerId : 'locker-002';

    console.log(`🔓 [ESP32 KEYPAD] OTP ${otp} Verified! ACCESS GRANTED! Unlocking ${lockerId}...`);

    // Update session and locker state in memory to OPEN
    try {
      if (store.updateLockerSession) {
        store.updateLockerSession(sessionId, {
          state: 'OPEN',
          unlockedAt: new Date().toISOString(),
        });
      }
      if (store.updateLocker) {
        store.updateLocker(lockerId, {
          state: 'OPEN',
          sessionId: sessionId,
        });
      }
      if (store.addAuditLog) {
        store.addAuditLog({
          action: 'HARDWARE_KEYPAD_UNLOCK',
          boxId,
          sessionId,
          otp,
        });
      }
    } catch (err) {
      console.warn('Warning updating store from ESP32:', err.message);
    }

    // Auto-rearm after 10 seconds so the user can test again without getting stuck!
    setTimeout(() => {
      try {
        const locker = store.getLocker ? store.getLocker(lockerId) : null;
        if (!locker || locker.state === 'OPEN' || locker.state === 'AVAILABLE') {
          const freshOtp = rearmLocker(lockerId);
          console.log(`🔁 [AUTO-REARM] Locker ${lockerId} re-armed for next test! Fresh OTP: ${freshOtp}`);
        }
      } catch (e) {}
    }, 10000);

    return res.json({
      success: true,
      message: 'Access granted. Opening locker.',
      box_id: boxId,
      session_id: sessionId,
    });
  }

  console.log(`❌ [ESP32 KEYPAD] Invalid OTP: ${otp}`);
  return res.json({
    success: false,
    message: 'Invalid OTP code',
  });
});

/**
 * GET or POST /api/v1/box/rearm and /api/v1/box/reset
 * Re-arms Locker A2 back to ITEM_DEPOSITED with a fresh OTP for continuous testing.
 */
const handleRearm = (req, res) => {
  const customOtp = req.query.otp || req.body?.otp;
  const newOtp = rearmLocker('locker-002', customOtp);

  // Send to Telegram if linked
  try {
    const telegramService = require('../services/telegramService');
    const user = store.getUser ? store.getUser('demo-user-1') : null;
    const chatId = user?.telegramChatId || 5679070779;
    if (chatId && telegramService.sendOTPViaTelegram) {
      telegramService.sendOTPViaTelegram(
        chatId,
        newOtp,
        'Demo Test Package',
        'Locker A2 – Ground Floor'
      ).catch(() => {});
    }
  } catch (e) {}

  res.json({
    success: true,
    message: 'Locker A2 re-armed to ITEM_DEPOSITED',
    locker: 'Locker A2',
    sessionId: 'session-001',
    newOtp: newOtp,
    instructions: `Type ${newOtp} on the ESP32 keypad and press # to unlock again!`,
  });
};

router.all('/rearm', handleRearm);
router.all('/reset', handleRearm);

/**
 * GET /api/v1/box/status
 * Health check for ESP32 and testing
 */
router.get('/status', (req, res) => {
  const locker = store.getLocker ? store.getLocker('locker-002') : null;
  const session = store.getLockerSession ? store.getLockerSession('session-001') : null;
  res.json({
    status: 'online',
    system: 'Findora Smart Locker ESP32 Service',
    time: new Date().toISOString(),
    valid_otps_count: registeredOTPs.size,
    locker_state: locker?.state || 'UNKNOWN',
    active_test_otp: session?.otp || null,
  });
});

router.rearmLocker = rearmLocker;
router.registerOTP = registerOTP;
router.registeredOTPs = registeredOTPs;

module.exports = router;
