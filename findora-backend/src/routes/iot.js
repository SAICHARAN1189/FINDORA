/**
 * IoT API Routes
 * 
 * Endpoints for ESP32 smart locker integration
 * - Locker status and heartbeat
 * - Session management
 * - OTP generation and verification
 * - Door control commands
 */

const express = require('express');
const router = express.Router();
const store = require('../config/demoStore');
const { getMQTTBridge } = require('../services/mqttBridge');
const { authenticate } = require('../middleware/auth');

let mqttBridge = null;

// Initialize MQTT bridge
const initMQTT = () => {
  if (!mqttBridge) {
    mqttBridge = getMQTTBridge();
    
    // Connect to MQTT broker
    mqttBridge.connect().then(() => {
      console.log('✅ MQTT Bridge connected and ready');
      
      // Start offline check
      mqttBridge.startOfflineCheck();
      
      // Setup event listeners
      mqttBridge.on('heartbeat', ({ lockerId, data }) => {
        // Update locker status in store
        store.updateLocker(lockerId, {
          state: data.state,
          lastHeartbeat: new Date().toISOString(),
          uptime: data.uptime,
          wifiRSSI: data.wifiRSSI,
        });
      });
      
      mqttBridge.on('deposit_started', ({ lockerId, data }) => {
        console.log(`📦 Deposit started on ${lockerId}`);
      });
      
      mqttBridge.on('deposit_completed', ({ lockerId, data }) => {
        console.log(`✅ Item deposited in ${lockerId}`);
        
        // Update session state
        if (data.sessionId) {
          store.updateLockerSession(data.sessionId, {
            state: 'ITEM_DEPOSITED',
          });
        }
        
        // Update locker
        store.updateLocker(lockerId, {
          state: 'ITEM_DEPOSITED',
          sessionId: data.sessionId,
        });
      });
      
      mqttBridge.on('door_unlocked', ({ lockerId, data }) => {
        console.log(`🔓 Door unlocked: ${lockerId}`);
      });
      
      mqttBridge.on('door_locked', ({ lockerId, data }) => {
        console.log(`🔒 Door locked: ${lockerId}`);
        
        // Check if session should complete
        const session = store.getLockerSessionByLocker(lockerId);
        if (session && session.state === 'COLLECTING') {
          store.updateLockerSession(session.id, {
            state: 'COMPLETED',
            completedAt: new Date().toISOString(),
          });
          
          store.updateLocker(lockerId, {
            state: 'AVAILABLE',
            sessionId: null,
          });
        }
      });
      
      mqttBridge.on('otp_verification', async ({ lockerId, data }) => {
        console.log(`🔑 OTP verification requested for ${lockerId}: ${data.otp}`);
        
        // Verify OTP
        const session = store.getLockerSessionByOTP(data.otp);
        
        if (session && session.lockerId === lockerId) {
          // Check expiry
          if (new Date(session.otpExpiry) > new Date()) {
            // OTP valid - unlock door
            console.log(`✅ OTP ${data.otp} verified`);
            
            store.updateLockerSession(session.id, {
              state: 'COLLECTING',
              verifiedAt: new Date().toISOString(),
            });
            
            await mqttBridge.unlockDoor(lockerId);
          } else {
            // OTP expired
            console.log(`❌ OTP ${data.otp} expired`);
            await mqttBridge.sendCommand(lockerId, {
              action: 'otp_result',
              success: false,
              reason: 'OTP expired',
            });
          }
        } else {
          // OTP invalid
          console.log(`❌ OTP ${data.otp} invalid`);
          
          // Increment attempts if session exists
          if (session) {
            store.updateLockerSession(session.id, {
              otpAttempts: (session.otpAttempts || 0) + 1,
            });
          }
          
          await mqttBridge.sendCommand(lockerId, {
            action: 'otp_result',
            success: false,
            reason: 'Invalid OTP',
          });
        }
      });
      
      mqttBridge.on('locker_offline', ({ lockerId }) => {
        store.updateLocker(lockerId, {
          state: 'OFFLINE',
        });
      });
      
    }).catch(err => {
      console.error('❌ Failed to connect MQTT bridge:', err);
    });
  }
  return mqttBridge;
};

// ==================== PUBLIC ENDPOINTS ====================

/**
 * GET /api/iot/health
 * Health check for IoT service
 */
router.get('/health', (req, res) => {
  const bridge = initMQTT();
  
  res.json({
    status: 'ok',
    mqtt: {
      connected: bridge.isConnected(),
      lockers: bridge.getAllLockers().length,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/iot/lockers
 * Get all lockers and their status
 */
router.get('/lockers', authenticate, (req, res) => {
  const lockers = store.getAllLockers();
  const bridge = initMQTT();
  
  // Merge with MQTT state
  const enrichedLockers = lockers.map(locker => {
    const mqttState = bridge.getLockerState(locker.id);
    const online = bridge.isLockerOnline(locker.id);
    
    return {
      ...locker,
      online,
      mqttState: mqttState?.state || locker.state,
      wifiRSSI: mqttState?.wifiRSSI || null,
      uptime: mqttState?.uptime || null,
    };
  });
  
  res.json(enrichedLockers);
});

/**
 * GET /api/iot/lockers/:id
 * Get specific locker details
 */
router.get('/lockers/:id', authenticate, (req, res) => {
  const locker = store.getLocker(req.params.id);
  
  if (!locker) {
    return res.status(404).json({ error: 'Locker not found' });
  }
  
  const bridge = initMQTT();
  const mqttState = bridge.getLockerState(locker.id);
  const online = bridge.isLockerOnline(locker.id);
  
  res.json({
    ...locker,
    online,
    mqttState: mqttState?.state || locker.state,
    wifiRSSI: mqttState?.wifiRSSI || null,
    uptime: mqttState?.uptime || null,
    doorLocked: mqttState?.doorLocked || true,
  });
});

/**
 * POST /api/iot/lockers/:id/status
 * Request locker status update
 */
router.post('/lockers/:id/status', authenticate, async (req, res) => {
  const locker = store.getLocker(req.params.id);
  
  if (!locker) {
    return res.status(404).json({ error: 'Locker not found' });
  }
  
  try {
    const bridge = initMQTT();
    await bridge.requestStatus(req.params.id);
    
    res.json({ 
      success: true,
      message: 'Status request sent',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SESSION MANAGEMENT ====================

/**
 * POST /api/iot/sessions
 * Create a new locker session (deposit)
 */
router.post('/sessions', authenticate, async (req, res) => {
  const { lockerId, reportId, matchId, depositedBy, claimedBy } = req.body;
  
  if (!lockerId || !reportId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Check locker availability
  const locker = store.getLocker(lockerId);
  if (!locker) {
    return res.status(404).json({ error: 'Locker not found' });
  }
  
  const bridge = initMQTT();
  if (!bridge.isLockerOnline(lockerId)) {
    return res.status(400).json({ error: 'Locker is offline' });
  }
  
  const existingSession = store.getLockerSessionByLocker(lockerId);
  if (existingSession) {
    return res.status(400).json({ error: 'Locker already has an active session' });
  }
  
  try {
    // Create session
    const session = store.createLockerSession({
      lockerId,
      reportId,
      matchId,
      depositedBy: depositedBy || req.user.uid,
      claimedBy,
      state: 'PENDING',
    });
    
    // Send deposit command to locker
    await bridge.startDeposit(lockerId, {
      sessionId: session.id,
      reportId,
      userId: depositedBy || req.user.uid,
    });
    
    // Update locker
    store.updateLocker(lockerId, {
      sessionId: session.id,
    });
    
    res.json({
      success: true,
      session,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/iot/sessions/:id
 * Get session details
 */
router.get('/sessions/:id', authenticate, (req, res) => {
  const session = store.getLockerSession(req.params.id);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Check authorization
  if (session.depositedBy !== req.user.uid && 
      session.claimedBy !== req.user.uid && 
      req.user.role !== 'institution_admin' && 
      req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Not authorized to view this session' });
  }
  
  res.json(session);
});

/**
 * GET /api/iot/sessions
 * Get all sessions (filtered by user)
 */
router.get('/sessions', authenticate, (req, res) => {
  let sessions = store.getAllLockerSessions();
  
  // Filter by user unless admin
  if (req.user.role !== 'institution_admin' && req.user.role !== 'super_admin') {
    sessions = sessions.filter(s => 
      s.depositedBy === req.user.uid || s.claimedBy === req.user.uid
    );
  }
  
  res.json(sessions);
});

/**
 * POST /api/iot/sessions/:id/verify-otp
 * Verify OTP for collection
 */
router.post('/sessions/:id/verify-otp', authenticate, async (req, res) => {
  const { otp } = req.body;
  
  if (!otp) {
    return res.status(400).json({ error: 'OTP is required' });
  }
  
  const session = store.getLockerSession(req.params.id);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Check authorization (only claimer can verify)
  if (session.claimedBy !== req.user.uid && 
      req.user.role !== 'institution_admin' && 
      req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Not authorized to collect this item' });
  }
  
  // Check session state
  if (session.state !== 'ITEM_DEPOSITED') {
    return res.status(400).json({ error: 'Invalid session state' });
  }
  
  // Check OTP expiry
  if (new Date(session.otpExpiry) < new Date()) {
    return res.status(400).json({ 
      error: 'OTP expired',
      expired: true,
    });
  }
  
  // Check OTP match
  if (session.otp !== otp) {
    // Increment attempts
    store.updateLockerSession(session.id, {
      otpAttempts: (session.otpAttempts || 0) + 1,
    });
    
    return res.status(400).json({ 
      error: 'Invalid OTP',
      attemptsRemaining: 3 - (session.otpAttempts || 0) - 1,
    });
  }
  
  try {
    // Send OTP verification to locker
    const bridge = initMQTT();
    await bridge.verifyOTP(session.lockerId, otp, session.id);
    
    // Update session
    store.updateLockerSession(session.id, {
      state: 'COLLECTING',
      verifiedAt: new Date().toISOString(),
    });
    
    res.json({
      success: true,
      message: 'OTP verified. Door unlocked for collection.',
      session: store.getLockerSession(session.id),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/iot/sessions/:id/cancel
 * Cancel active session
 */
router.post('/sessions/:id/cancel', authenticate, async (req, res) => {
  const session = store.getLockerSession(req.params.id);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Check authorization
  if (session.depositedBy !== req.user.uid && 
      req.user.role !== 'institution_admin' && 
      req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  try {
    const bridge = initMQTT();
    await bridge.cancelSession(session.lockerId);
    
    store.updateLockerSession(session.id, {
      state: 'CANCELLED',
      cancelledAt: new Date().toISOString(),
      cancelledBy: req.user.uid,
    });
    
    store.updateLocker(session.lockerId, {
      state: 'AVAILABLE',
      sessionId: null,
    });
    
    res.json({
      success: true,
      message: 'Session cancelled',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN CONTROLS ====================

/**
 * POST /api/iot/lockers/:id/unlock
 * Manual unlock (admin only)
 */
router.post('/lockers/:id/unlock', authenticate, async (req, res) => {
  if (req.user.role !== 'institution_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const locker = store.getLocker(req.params.id);
  if (!locker) {
    return res.status(404).json({ error: 'Locker not found' });
  }
  
  try {
    const bridge = initMQTT();
    await bridge.unlockDoor(req.params.id);
    
    res.json({
      success: true,
      message: 'Unlock command sent',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/iot/lockers/:id/lock
 * Manual lock (admin only)
 */
router.post('/lockers/:id/lock', authenticate, async (req, res) => {
  if (req.user.role !== 'institution_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const locker = store.getLocker(req.params.id);
  if (!locker) {
    return res.status(404).json({ error: 'Locker not found' });
  }
  
  try {
    const bridge = initMQTT();
    await bridge.lockDoor(req.params.id);
    
    res.json({
      success: true,
      message: 'Lock command sent',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/iot/lockers/:id/maintenance
 * Toggle maintenance mode (admin only)
 */
router.post('/lockers/:id/maintenance', authenticate, async (req, res) => {
  if (req.user.role !== 'institution_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { enable } = req.body;
  const locker = store.getLocker(req.params.id);
  
  if (!locker) {
    return res.status(404).json({ error: 'Locker not found' });
  }
  
  try {
    const bridge = initMQTT();
    await bridge.setMaintenance(req.params.id, enable);
    
    store.updateLocker(req.params.id, {
      state: enable ? 'MAINTENANCE' : 'AVAILABLE',
    });
    
    res.json({
      success: true,
      message: `Maintenance mode ${enable ? 'enabled' : 'disabled'}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
