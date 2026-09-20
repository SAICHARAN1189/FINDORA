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

// ─── Root & Health Check ───────────────────────────────────────
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Findora Smart Ecosystem &bull; Backend Running</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
          .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 36px; max-width: 580px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
          .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; margin-bottom: 16px; border: 1px solid rgba(16, 185, 129, 0.3); }
          .dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981; }
          h1 { font-size: 24px; margin: 0 0 8px 0; color: #ffffff; }
          p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
          .btn-primary { display: block; text-align: center; background: #4f46e5; color: white; text-decoration: none; padding: 14px 20px; border-radius: 10px; font-weight: 600; font-size: 15px; transition: background 0.2s; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); margin-bottom: 20px; }
          .btn-primary:hover { background: #4338ca; }
          .list { list-style: none; padding: 0; margin: 0 0 20px 0; display: flex; flex-direction: column; gap: 10px; }
          .list li { background: #0f172a; padding: 12px 14px; border-radius: 8px; border: 1px solid #334155; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
          .list li a { color: #818cf8; text-decoration: none; font-weight: 500; }
          .list li a:hover { text-decoration: underline; }
          .footer { font-size: 12px; color: #64748b; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge"><span class="dot"></span> Backend Active & Online (Demo Mode)</div>
          <h1>Findora Server API</h1>
          <p>You have accessed the backend REST API port. The user interface application is hosted on port <strong>5173</strong>.</p>
          
          <a href="http://localhost:5173/lockers" class="btn-primary">🚀 Open Smart Lockers Web App &rarr;</a>

          <ul class="list">
            <li>
              <span>🖥️ Web Frontend:</span>
              <a href="http://localhost:5173">http://localhost:5173</a>
            </li>
            <li>
              <span>📦 Lockers Dashboard:</span>
              <a href="http://localhost:5173/lockers">http://localhost:5173/lockers</a>
            </li>
            <li>
              <span>🤖 Telegram Bot:</span>
              <a href="https://t.me/smartLostandFoundbot" target="_blank">@smartLostandFoundbot</a>
            </li>
            <li>
              <span>🔌 ESP32 Hardware API:</span>
              <a href="http://localhost:8000/api/v1/box/status">Port 8000 (/status)</a>
            </li>
            <li>
              <span>🩺 Health Status:</span>
              <a href="/api/health">/api/health</a>
            </li>
          </ul>

          <div class="footer">Findora Smart Lock & Found Ecosystem</div>
        </div>
      </body>
      </html>
    `);
  }
  res.json({
    name: 'Findora Smart Locker Backend API',
    status: 'online',
    frontend: 'http://localhost:5173',
    lockers: 'http://localhost:5173/lockers',
    esp32_endpoint: 'http://localhost:8000/api/v1/box/verify-otp',
    telegram_bot: '@smartLostandFoundbot',
  });
});

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

// Start integrated Telegram Bot (native Node.js, no Python or port 8080 needed)
try {
  const telegramService = require('./services/telegramService');
  telegramService.startBot();
} catch (err) {
  console.warn('⚠️ Could not start Telegram bot:', err.message);
}

module.exports = app;
