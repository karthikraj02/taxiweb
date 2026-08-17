const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * Rate limiting (PHASE 56).
 *
 * The default in-memory store is per-process. For a multi-instance deployment
 * set REDIS_URL and swap in `rate-limit-redis` — see docs/DEPLOYMENT.md. This
 * is called out rather than silently under-protecting a scaled deployment.
 */
const handler = (req, res) => {
  res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down and try again shortly.' },
    requestId: req.id,
  });
};

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  // Tests would otherwise trip limits across cases.
  skip: () => env.isTest,
};

/** Broad ceiling for the whole API. */
const apiLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, max: 300 });

/** Credential endpoints — tight, and keyed by IP + identifier so one attacker
 *  cannot lock out an entire NAT range by spraying a single account. */
const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
});

const registerLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, max: 5 });

/** OTP request is the expensive one — it sends an SMS or email. */
const otpRequestLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.phone || req.body?.email || '')}`,
});

const otpVerifyLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, max: 10 });
const refreshLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, max: 60 });
const bookingLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, max: 30 });
const paymentLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, max: 20 });
const contactLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, max: 5 });
const uploadLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, max: 20 });

/** Location pings are frequent by design; the ceiling is generous but finite. */
const locationLimiter = rateLimit({ ...base, windowMs: 60 * 1000, max: 60 });

module.exports = {
  apiLimiter, loginLimiter, registerLimiter,
  otpRequestLimiter, otpVerifyLimiter, refreshLimiter,
  bookingLimiter, paymentLimiter, contactLimiter,
  uploadLimiter, locationLimiter,
};
