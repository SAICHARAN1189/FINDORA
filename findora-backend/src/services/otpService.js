// src/services/otpService.js
// OTP generation, validation with expiry and rate limiting

const crypto = require('crypto');

// In-memory OTP rate limiting (per locker session)
const otpAttempts = {};

function generateOTP() {
  // Cryptographically secure 6-digit OTP
  const buf = crypto.randomBytes(4);
  const num = buf.readUInt32BE(0) % 1000000;
  return String(num).padStart(6, '0');
}

function getOTPExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function isOTPExpired(expiryISO) {
  return new Date() > new Date(expiryISO);
}

function recordAttempt(sessionId) {
  if (!otpAttempts[sessionId]) {
    otpAttempts[sessionId] = { count: 0, lockedUntil: null };
  }
  otpAttempts[sessionId].count++;
  
  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || '5');
  if (otpAttempts[sessionId].count >= maxAttempts) {
    // Lock for 15 minutes after max attempts
    otpAttempts[sessionId].lockedUntil = new Date(Date.now() + 15 * 60000).toISOString();
    return { locked: true, remainingAttempts: 0 };
  }
  return { locked: false, remainingAttempts: maxAttempts - otpAttempts[sessionId].count };
}

function isRateLimited(sessionId) {
  const record = otpAttempts[sessionId];
  if (!record) return false;
  if (record.lockedUntil && new Date() < new Date(record.lockedUntil)) {
    return { limited: true, lockedUntil: record.lockedUntil };
  }
  if (record.lockedUntil && new Date() >= new Date(record.lockedUntil)) {
    // Reset after lockout period
    otpAttempts[sessionId] = { count: 0, lockedUntil: null };
  }
  return false;
}

function clearAttempts(sessionId) {
  delete otpAttempts[sessionId];
}

module.exports = { generateOTP, getOTPExpiry, isOTPExpired, recordAttempt, isRateLimited, clearAttempts };
