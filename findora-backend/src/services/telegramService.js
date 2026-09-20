// src/services/telegramService.js
// Communicates with the Telegram OTP bot HTTP API for:
//   - Resolving link codes (account linking)
//   - Sending OTP messages via Telegram

const http = require('http');

const BOT_URL = process.env.TELEGRAM_BOT_URL || 'http://localhost:8080';

/**
 * Make a simple HTTP request to the Telegram bot API.
 * @param {'GET'|'POST'} method
 * @param {string} path
 * @param {object|null} body
 * @returns {Promise<object>}
 */
function botRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BOT_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Bot request timed out')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Resolve a Findora link code to a Telegram chat_id.
 * The code is one-time-use and consumed by the bot on resolution.
 * @param {string} linkCode - e.g. "ABCD-1234"
 * @returns {Promise<{chatId: number}|{error: string}>}
 */
async function resolveLinkCode(linkCode) {
  try {
    const { status, body } = await botRequest('GET', `/resolve-link?code=${encodeURIComponent(linkCode)}`);
    if (status === 200 && body.chat_id) {
      return { chatId: body.chat_id };
    }
    return { error: body.error || 'Invalid or expired link code' };
  } catch (err) {
    console.error('❌ Telegram bot unreachable:', err.message);
    return { error: 'Telegram bot is not reachable. Make sure it is running.' };
  }
}

/**
 * Notify the Telegram bot that linking is confirmed so it can
 * send a welcome message to the user.
 * @param {number} chatId
 * @param {string} uid
 */
async function confirmLink(chatId, uid) {
  try {
    await botRequest('POST', '/link-confirm', { chat_id: chatId, uid });
  } catch (err) {
    console.warn('⚠️  Could not send Telegram link confirmation:', err.message);
  }
}

/**
 * Send an OTP to a user via Telegram.
 * @param {number} chatId - Telegram chat ID of the recipient
 * @param {string} otp    - 6-digit OTP string
 * @param {string} item   - Item description (e.g. "iPhone 15 Pro")
 * @param {string} locker - Locker name (e.g. "Locker A1 - Main Building")
 * @returns {Promise<boolean>} true if sent successfully
 */
async function sendOTPViaTelegram(chatId, otp, item = 'your item', locker = 'the locker') {
  if (!chatId) return false;
  try {
    const { status } = await botRequest('POST', '/send-otp', { chat_id: chatId, otp, item, locker });
    if (status === 200) {
      console.log(`📨 OTP sent via Telegram to chat_id ${chatId}`);
      return true;
    }
    console.warn(`⚠️  Telegram OTP send returned status ${status}`);
    return false;
  } catch (err) {
    console.warn('⚠️  Could not send OTP via Telegram:', err.message);
    return false;
  }
}

/**
 * Check if the Telegram bot HTTP API is reachable.
 * @returns {Promise<boolean>}
 */
async function isBotReachable() {
  try {
    const { status } = await botRequest('GET', '/health');
    return status === 200;
  } catch {
    return false;
  }
}

module.exports = { resolveLinkCode, confirmLink, sendOTPViaTelegram, isBotReachable };
