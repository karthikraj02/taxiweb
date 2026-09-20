const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const logger = require('../utils/logger');
const mailer = require('./mailer');
const { badRequest, tooManyReq } = require('../utils/errors');

/**
 * OTP service (PHASE 4).
 *
 * Original behaviour, all of which is fixed here:
 *   - `Math.floor(100000 + Math.random() * 900000)` — Math.random is not a CSPRNG
 *   - OTP stored in plaintext on the user document
 *   - no attempt limit, so a 6-digit code was brute-forceable
 *   - no resend cooldown
 *   - the OTP was returned in the HTTP response whenever NODE_ENV !== 'production',
 *     which is true by default on a machine that simply forgot to set it
 */

/** Cryptographically secure 6-digit code. */
function generate() {
  const max = 10 ** env.otp.length;
  const min = 10 ** (env.otp.length - 1);
  return crypto.randomInt(min, max).toString();
}

async function hash(otp) {
  return bcrypt.hash(otp, env.bcryptRounds);
}

/**
 * Prepare OTP fields for a subject (user or driver), enforcing the resend
 * cooldown. Returns the plaintext for delivery plus the fields to persist.
 */
async function issue(subject) {
  const now = Date.now();
  if (subject.otpLastSentAt) {
    const elapsed = (now - new Date(subject.otpLastSentAt).getTime()) / 1000;
    if (elapsed < env.otp.resendCooldownSeconds) {
      throw tooManyReq(
        'OTP_RESEND_COOLDOWN',
        `Please wait ${Math.ceil(env.otp.resendCooldownSeconds - elapsed)} seconds before requesting another code.`
      );
    }
  }

  const otp = generate();
  const fields = {
    otpHash: await hash(otp),
    otpExpiry: new Date(now + env.otp.expiryMinutes * 60 * 1000),
    otpAttempts: 0,
    otpLastSentAt: new Date(now),
  };
  return { otp, fields };
}

/**
 * Verify a submitted code against a subject document.
 *
 * The subject MUST have been loaded with the otp fields selected. Mutates the
 * subject's attempt counter; the caller is responsible for saving.
 * Throws on failure, returns true on success.
 */
async function verify(subject, submitted) {
  if (!subject.otpHash || !subject.otpExpiry) {
    throw badRequest('OTP_NOT_REQUESTED', 'No verification code is pending. Please request a new one.');
  }
  if (new Date(subject.otpExpiry) < new Date()) {
    subject.otpHash = undefined;
    subject.otpExpiry = undefined;
    subject.otpAttempts = 0;
    throw badRequest('OTP_EXPIRED', 'This verification code has expired. Please request a new one.');
  }
  if ((subject.otpAttempts || 0) >= env.otp.maxAttempts) {
    // Burn the code — an attacker who exhausts attempts must start a new
    // request, which is itself rate limited and cooldown-gated.
    subject.otpHash = undefined;
    subject.otpExpiry = undefined;
    throw tooManyReq('OTP_ATTEMPTS_EXCEEDED', 'Too many incorrect attempts. Please request a new code.');
  }

  const ok = await bcrypt.compare(String(submitted), subject.otpHash);
  if (!ok) {
    subject.otpAttempts = (subject.otpAttempts || 0) + 1;
    const remaining = Math.max(0, env.otp.maxAttempts - subject.otpAttempts);
    throw badRequest('OTP_INVALID', `Incorrect code. ${remaining} attempt(s) remaining.`);
  }

  // Single-use: invalidate immediately on success.
  subject.otpHash = undefined;
  subject.otpExpiry = undefined;
  subject.otpAttempts = 0;
  return true;
}

/** Deliver by SMS. Never logs the code in production. */
async function sendSms(phone, otp) {
  if (!env.twilio.enabled) {
    if (env.isProduction) {
      throw badRequest('SMS_NOT_CONFIGURED', 'SMS delivery is not configured.');
    }
    logger.warn('Twilio not configured — OTP not delivered', { phone });
    return { delivered: false, channel: 'none' };
  }
  const twilio = require('twilio')(env.twilio.accountSid, env.twilio.authToken);
  await twilio.messages.create({
    body: `Your Udupi Taxi verification code is ${otp}. It expires in ${env.otp.expiryMinutes} minutes. Do not share it with anyone.`,
    from: env.twilio.phoneNumber,
    to: phone,
  });
  return { delivered: true, channel: 'sms' };
}

/** Deliver by email. Never logs the code in production. */
async function sendEmail(email, otp) {
  if (!mailer.isEnabled()) {
    if (env.isProduction) {
      throw badRequest('EMAIL_NOT_CONFIGURED', 'Email delivery is not configured.');
    }
    logger.warn('Email not configured — OTP not delivered', { email });
    return { delivered: false, channel: 'none' };
  }
  await mailer.send({
    to: email,
    subject: 'Udupi Taxi — verification code',
    text: `Your verification code is ${otp}. It expires in ${env.otp.expiryMinutes} minutes. Do not share it with anyone.`,
    html: `<p>Your verification code is <strong>${otp}</strong>.</p><p>It expires in ${env.otp.expiryMinutes} minutes. Do not share it with anyone.</p>`,
  });
  return { delivered: true, channel: 'email' };
}

module.exports = { generate, hash, issue, verify, sendSms, sendEmail };
