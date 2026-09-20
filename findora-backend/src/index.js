// src/index.js - Findora Backend Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Global Rate Limiter ──────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/lockers', require('./routes/lockers'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/rewards', require('./routes/rewards'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/iot', require('./routes/iot'));
app.use('/api/v1/box', require('./routes/box'));

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const { isDemoMode } = require('./config/firebase');
  res.json({
    status: 'ok',
    mode: isDemoMode ? 'demo' : 'production',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Error Handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Findora Backend running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
});

// Dual listener on port 8000 for ESP32 hardware compatibility
const HARDWARE_PORT = 8000;
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('192.168.56')) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

try {
  const hwServer = app.listen(HARDWARE_PORT, () => {
    const ip = getLocalIP();
    console.log(`🔌 ESP32 Hardware API listening on port ${HARDWARE_PORT}`);
    console.log(`🔑 Verification URL for ESP32: http://${ip}:${HARDWARE_PORT}/api/v1/box/verify-otp`);
  });
  hwServer.on('error', (err) => {
    console.warn(`⚠️ Could not bind to port ${HARDWARE_PORT}: ${err.message}`);
  });
} catch (e) {
  console.warn(`⚠️ Hardware port listener error: ${e.message}`);
}

module.exports = app;
