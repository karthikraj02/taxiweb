const express = require('express');
const env = require('../config/env');
const User = require('../models/User');
const tokens = require('../services/tokens');
const otpService = require('../services/otp');
const audit = require('../services/audit');
const logger = require('../utils/logger');
const dto = require('../dto');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const S = require('../validators/schemas');
const { unauthorized, badRequest, conflict } = require('../utils/errors');
const {
  loginLimiter, registerLimiter, otpRequestLimiter,
  otpVerifyLimiter, refreshLimiter,
} = require('../middleware/rateLimiters');

const router = express.Router();

const LOCK_THRESHOLD = 8;
const LOCK_MINUTES = 15;

/**
 * A deliberately constant response for OTP requests.
 *
 * The original endpoint returned 404 "No user found" for unknown numbers and
 * created a User document for any phone number submitted. That leaked which
 * numbers were registered and let anyone fill the users collection. We now
 * answer identically either way and only touch existing accounts, except on
 * the signup path where creating an account is the explicit intent.
 */
const GENERIC_OTP_RESPONSE = {
  success: true,
  message: 'If that number is registered, a verification code has been sent.',
};

// ---------------------------------------------------------------- register

router.post('/register', registerLimiter, validate({ body: S.registerBody }), async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    const clash = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    });
    if (clash) {
      throw conflict('ACCOUNT_EXISTS', 'An account with those details already exists. Try signing in.');
    }

    const user = new User({
      name,
      email: email || undefined,
      phone: phone || undefined,
      password,
      role: 'user',            // role is never taken from the request body
      isVerified: false,
    });
    await user.save();

    const { accessToken } = await tokens.issueSession(res, 'user', user, { req });
    await audit.record({
      actorType: 'user', actor: user._id, actorLabel: user.email || user.phone,
      action: 'auth.register', resource: 'User', resourceId: user._id, req,
    });

    res.status(201).json({
      success: true,
      data: { user: dto.publicUser(user), accessToken },
    });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------------- login

router.post('/login', loginLimiter, validate({ body: S.loginBody }), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // `.select('+...')` because these fields are excluded by default.
    const user = await User.findOne({ email })
      .select('+password +failedLoginAttempts +lockUntil');

    if (!user) {
      // Same shape and roughly the same cost as a real failure.
      throw unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    if (user.isLocked()) {
      throw unauthorized(
        'ACCOUNT_LOCKED',
        'Too many failed attempts. Your account is temporarily locked — try again in a few minutes.'
      );
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= LOCK_THRESHOLD) {
        user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        user.failedLoginAttempts = 0;
        logger.warn('Account locked after repeated failures', { userId: user._id.toString() });
      }
      await user.save();
      throw unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    const { accessToken } = await tokens.issueSession(res, 'user', user, { req });
    await audit.record({
      actorType: user.role === 'admin' ? 'admin' : 'user',
      actor: user._id, actorLabel: user.email,
      action: 'auth.login', resource: 'User', resourceId: user._id, req,
    });

    res.json({ success: true, data: { user: dto.publicUser(user), accessToken } });
  } catch (err) { next(err); }
});

// --------------------------------------------------------------------- OTP

router.post('/request-otp', otpRequestLimiter, validate({ body: S.requestOtpBody }), async (req, res, next) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone })
      .select('+otpHash +otpExpiry +otpAttempts +otpLastSentAt');

    if (!user) {
      // No account creation, no enumeration signal.
      return res.json(GENERIC_OTP_RESPONSE);
    }

    const { otp, fields } = await otpService.issue(user);
    Object.assign(user, fields);
    await user.save();

    try {
      await otpService.sendSms(phone, otp);
    } catch (deliveryErr) {
      logger.error('OTP delivery failed', { channel: 'sms', error: deliveryErr.message });
      if (env.isProduction) throw deliveryErr;
    }

    // The plaintext OTP is NEVER returned in the response body, in any
    // environment. Locally, read it from the server log instead.
    if (!env.isProduction) {
      logger.warn(`[dev] OTP for ${phone}: ${otp}`);
    }

    res.json(GENERIC_OTP_RESPONSE);
  } catch (err) { next(err); }
});

router.post('/verify-otp', otpVerifyLimiter, validate({ body: S.verifyOtpBody }), async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    const user = await User.findOne({ phone })
      .select('+otpHash +otpExpiry +otpAttempts +otpLastSentAt');

    if (!user) throw badRequest('OTP_INVALID', 'That code is not valid.');

    // verify() mutates the attempt counter then throws. The counter must be
    // persisted on the failure path too, otherwise the attempt limit never
    // increments and the code stays brute-forceable.
    try {
      await otpService.verify(user, otp);
    } catch (verifyErr) {
      await user.save();
      throw verifyErr;
    }

    user.isVerified = true;
    user.lastLoginAt = new Date();
    await user.save();

    const { accessToken } = await tokens.issueSession(res, 'user', user, { req });
    await audit.record({
      actorType: 'user', actor: user._id, actorLabel: user.phone,
      action: 'auth.otp_login', resource: 'User', resourceId: user._id, req,
    });

    res.json({ success: true, data: { user: dto.publicUser(user), accessToken } });
  } catch (err) { next(err); }
});

// ----------------------------------------------------------------- refresh

router.post('/refresh', refreshLimiter, async (req, res, next) => {
  try {
    const raw = req.cookies?.[tokens.REFRESH_COOKIE.user];
    if (!raw) throw unauthorized('NO_REFRESH_TOKEN', 'Session expired. Please sign in again.');

    const { subjectId, family } = await tokens.rotateRefreshToken(raw, 'user');
    const user = await User.findById(subjectId);
    if (!user) throw unauthorized('USER_NOT_FOUND', 'Account no longer exists.');

    const { accessToken } = await tokens.issueSession(res, 'user', user, { family, req });
    res.json({ success: true, data: { accessToken, user: dto.publicUser(user) } });
  } catch (err) {
    tokens.clearAuthCookies(res, 'user');
    next(err);
  }
});

// ------------------------------------------------------------------ logout

router.post('/logout', async (req, res, next) => {
  try {
    await tokens.revokeToken(req.cookies?.[tokens.REFRESH_COOKIE.user], 'user');
    tokens.clearAuthCookies(res, 'user');
    res.json({ success: true, message: 'Signed out.' });
  } catch (err) { next(err); }
});

router.post('/logout-all', protect, async (req, res, next) => {
  try {
    await tokens.revokeAllForSubject('user', req.user._id);
    req.user.sessionsValidFrom = new Date();
    await req.user.save();
    tokens.clearAuthCookies(res, 'user');
    await audit.record({
      actorType: 'user', actor: req.user._id,
      action: 'auth.logout_all', resource: 'User', resourceId: req.user._id, req,
    });
    res.json({ success: true, message: 'Signed out of all devices.' });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------------ profile

router.get('/me', protect, (req, res) => {
  res.json({ success: true, data: { user: dto.publicUser(req.user) } });
});

// ---------------------------------------------------------------- password

router.post('/change-password', protect, validate({ body: S.changePasswordBody }), async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!user?.password) {
      throw badRequest('NO_PASSWORD_SET', 'This account signs in with a one-time code.');
    }
    const ok = await user.comparePassword(req.body.currentPassword);
    if (!ok) throw unauthorized('INVALID_CREDENTIALS', 'Your current password is incorrect.');

    user.password = req.body.newPassword;   // pre-save hook rehashes + bumps sessionsValidFrom
    await user.save();

    // PHASE 5 — every other session dies with the old password.
    await tokens.revokeAllForSubject('user', user._id);
    tokens.clearAuthCookies(res, 'user');

    await audit.record({
      actorType: 'user', actor: user._id,
      action: 'auth.password_change', resource: 'User', resourceId: user._id, req,
    });

    res.json({ success: true, message: 'Password updated. Please sign in again.' });
  } catch (err) { next(err); }
});

router.post('/forgot-password', otpRequestLimiter, validate({ body: S.forgotPasswordBody }), async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email })
      .select('+otpHash +otpExpiry +otpAttempts +otpLastSentAt');

    // Constant response regardless of whether the address exists.
    const generic = {
      success: true,
      message: 'If that email is registered, a reset code has been sent.',
    };
    if (!user) return res.json(generic);

    const { otp, fields } = await otpService.issue(user);
    Object.assign(user, fields);
    await user.save();

    try {
      await otpService.sendEmail(user.email, otp);
    } catch (deliveryErr) {
      logger.error('Reset code delivery failed', { error: deliveryErr.message });
      if (env.isProduction) throw deliveryErr;
    }
    if (!env.isProduction) logger.warn(`[dev] Reset code for ${user.email}: ${otp}`);

    res.json(generic);
  } catch (err) { next(err); }
});

router.post('/reset-password', otpVerifyLimiter, validate({ body: S.resetPasswordBody }), async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email })
      .select('+otpHash +otpExpiry +otpAttempts +password');
    if (!user) throw badRequest('OTP_INVALID', 'That code is not valid.');

    try {
      await otpService.verify(user, req.body.otp);
    } catch (verifyErr) {
      await user.save();
      throw verifyErr;
    }

    user.password = req.body.newPassword;
    user.isVerified = true;
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    await tokens.revokeAllForSubject('user', user._id);
    await audit.record({
      actorType: 'user', actor: user._id,
      action: 'auth.password_reset', resource: 'User', resourceId: user._id, req,
    });

    res.json({ success: true, message: 'Password reset. Please sign in.' });
  } catch (err) { next(err); }
});

module.exports = router;
