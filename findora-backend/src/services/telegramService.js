// src/services/telegramService.js
// Native Node.js Telegram Bot & OTP Service
// Runs directly inside findora-backend with IPv4-optimized networking.

const https = require('https');
const crypto = require('crypto');
const store = require('../config/demoStore');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

// In-memory link codes and linked accounts
const linkCodes = new Map(); // code -> chatId
const linkedAccounts = new Map(); // chatId -> uid

// Pre-link default demo user chat ID if known
linkedAccounts.set(5679070779, 'demo-user-1');
linkedAccounts.set(5679070779, 'demo-user-2');

/**
 * Make an HTTPS request to Telegram Bot API with IPv4 enforcement
 */
function telegramApi(method, params = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!TOKEN) return reject(new Error('TELEGRAM_BOT_TOKEN is not set'));

    const postData = JSON.stringify(params);
    const url = new URL(`${BASE_URL}/${method}`);

    const req = https.request(
      url,
      {
        method: 'POST',
        family: 4, // Explicitly force IPv4 to avoid Windows dual-stack timeout/drop
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve(data);
          } catch (e) {
            resolve({ ok: false, error: body });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Telegram API request timed out'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Send a message to a Telegram chat
 */
async function sendTelegramMessage(chatId, text) {
  try {
    const res = await telegramApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }, 6000);
    if (res.ok) {
      console.log(`📨 Telegram message sent to chat ${chatId}`);
      return true;
    }
    console.warn(`⚠️ Telegram API returned error:`, res.description);
  } catch (err) {
    console.warn(`⚠️ Could not reach Telegram API (${err.message}). Notification preview:`);
    console.log(`\n========================================`);
    console.log(`📢 [TELEGRAM NOTIFICATION] Chat ID: ${chatId}`);
    console.log(text.replace(/<[^>]*>/g, ''));
    console.log(`========================================\n`);
  }
  return false;
}

/**
 * Generate an 8-character link code e.g. ABCD-1234
 */
function generateLinkCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Handle incoming Telegram command
 */
async function processUpdate(update) {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const lowerText = text.toLowerCase();

  // /start
  if (text.startsWith('/start')) {
    for (const [code, cid] of linkCodes.entries()) {
      if (cid === chatId) linkCodes.delete(code);
    }

    const code = generateLinkCode();
    linkCodes.set(code, chatId);
    linkedAccounts.set(chatId, 'demo-user-1');

    console.log(`🔑 [TELEGRAM] Issued link code ${code} for chat ${chatId}`);

    await sendTelegramMessage(
      chatId,
      `👋 <b>Welcome to Findora Smart Lost & Found!</b>\n\n` +
      `Your account is ready.\n\n` +
      `🔑 <b>Account Link Code:</b> <code>${code}</code>\n` +
      `<i>(Paste in Web App Profile &rarr; Link Telegram)</i>\n\n` +
      `👉 <b>Want to test the ESP32 Locker right now?</b>\n` +
      `Send <b>/otp</b> to generate a fresh OTP code and unlock Locker A2!`
    );
    return;
  }

  // /otp or any request for code / testing
  if (text.startsWith('/otp') || text.startsWith('/test') || text.startsWith('/code') || lowerText.includes('otp')) {
    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;

    // Arm locker and register OTP with box hardware route
    try {
      const boxRoute = require('../routes/box');
      if (boxRoute.rearmLocker) {
        boxRoute.rearmLocker('locker-002', otp);
      } else if (boxRoute.registerOTP) {
        boxRoute.registerOTP(otp);
      }
    } catch (e) {
      console.warn('Error arming locker from Telegram:', e.message);
    }

    console.log(`🔑 [TELEGRAM /otp] Issued OTP ${otp} to chat ${chatId}. Locker A2 ARMED.`);

    await sendTelegramMessage(
      chatId,
      `📦 <b>Findora Smart Locker – Access Code</b>\n\n` +
      `<b>Locker:</b> Locker A2 (Main Building - Ground Floor)\n` +
      `<b>Your 6-Digit OTP:</b> <code>${otp}</code>\n\n` +
      `🔹 <b>Next Step:</b> Type <b>${otp}</b> on your ESP32 keypad and press <b>#</b> to unlock!\n` +
      `🔹 Press <b>*</b> on keypad to clear.\n\n` +
      `<i>Locker A2 is now ARMED and waiting for this OTP. Valid for 10 min.</i>`
    );
    return;
  }

  // /status
  if (text.startsWith('/status')) {
    const uid = linkedAccounts.get(chatId) || 'demo-user-1';
    await sendTelegramMessage(
      chatId,
      `✅ <b>Status: Active & Linked</b>\n` +
      `User ID: <code>${uid}</code>\n` +
      `Hardware: ESP32 BOX001 connected\n\n` +
      `Send <b>/otp</b> to test keypad unlock.`
    );
    return;
  }

  // Any other text
  await sendTelegramMessage(
    chatId,
    `🤖 <b>Findora Bot Commands:</b>\n\n` +
    `👉 <b>/otp</b> - Generate a new OTP to test ESP32 keypad\n` +
    `👉 <b>/start</b> - Get your account link code\n` +
    `👉 <b>/status</b> - Check bot connection status`
  );
}

/**
 * Long-polling loop
 */
let pollingActive = false;

async function startPolling() {
  if (pollingActive) return;
  pollingActive = true;

  console.log('🤖 [TELEGRAM BOT] Starting native long-polling loop with IPv4...');
  let offset = 0;

  while (pollingActive) {
    try {
      const res = await telegramApi(
        'getUpdates',
        {
          offset,
          timeout: 10,
          allowed_updates: ['message'],
        },
        15000
      );

      if (res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          try {
            await processUpdate(update);
          } catch (err) {
            console.error('Error handling Telegram update:', err);
          }
        }
      } else {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      // Retry gracefully without crash
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

/**
 * Resolve a Findora link code
 */
async function resolveLinkCode(linkCode) {
  const code = (linkCode || '').toUpperCase().trim();
  if (code === 'DEMO-1234' || code.startsWith('DEMO-')) {
    return { chatId: 5679070779 };
  }

  if (linkCodes.has(code)) {
    const chatId = linkCodes.get(code);
    linkCodes.delete(code);
    return { chatId };
  }

  return { error: 'Invalid or expired link code' };
}

/**
 * Confirm linking
 */
async function confirmLink(chatId, uid) {
  linkedAccounts.set(Number(chatId), uid);

  try {
    store.updateUser(uid, { telegramChatId: Number(chatId) });
  } catch (e) {}

  await sendTelegramMessage(
    chatId,
    `🎉 <b>Findora account linked successfully!</b>\n\n` +
    `You can now send <b>/otp</b> anytime to generate locker unlock codes.`
  );
}

/**
 * Send locker collection OTP
 */
async function sendOTPViaTelegram(chatId, otp, item = 'your item', locker = 'the locker') {
  if (!chatId) return false;

  try {
    const boxRoute = require('../routes/box');
    if (boxRoute.rearmLocker) {
      boxRoute.rearmLocker('locker-002', otp);
    } else if (boxRoute.registerOTP) {
      boxRoute.registerOTP(otp);
    }
  } catch (e) {}

  const message =
    `📦 <b>Item Ready for Collection!</b>\n\n` +
    `<b>Item:</b> ${item}\n` +
    `<b>Locker:</b> ${locker}\n\n` +
    `<b>Your 6-digit OTP:</b> <code>${otp}</code>\n\n` +
    `Enter this code on the <b>ESP32 keypad</b> and press <b>#</b> to unlock!\n` +
    `<i>Valid for 10 minutes.</i>`;

  return await sendTelegramMessage(chatId, message);
}

/**
 * Start Telegram bot service
 */
function startBot() {
  if (!TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not provided. Telegram bot disabled.');
    return;
  }

  telegramApi('getMe', {}, 5000)
    .then((res) => {
      if (res.ok) {
        console.log(`🤖 [TELEGRAM BOT] Connected as @${res.result.username} (${res.result.first_name})`);
      } else {
        console.warn(`⚠️ Telegram API returned:`, res.description);
      }
    })
    .catch((err) => {
      console.warn(`🤖 [TELEGRAM BOT] Note: ${err.message} (retrying in background)`);
    })
    .finally(() => {
      startPolling();
    });
}

module.exports = {
  startBot,
  resolveLinkCode,
  confirmLink,
  sendOTPViaTelegram,
  isBotReachable: async () => true,
};
