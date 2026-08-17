const express = require('express');
const multer = require('multer');
const env = require('../config/env');
const Driver = require('../models/Driver');
const tokens = require('../services/tokens');
const otpService = require('../services/otp');
const storage = require('../services/storage');
const audit = require('../services/audit');
const logger = require('../utils/logger');
const dto = require('../dto');
const { protectDriver } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const S = require('../validators/schemas');
const {
  registerLimiter, otpRequestLimiter, otpVerifyLimiter,
  refreshLimiter, uploadLimiter,
} = require('../middleware/rateLimiters');
const { badRequest, unauthorized, conflict } = require('../utils/errors');

const router = express.Router();

// Memory storage: bytes are inspected before anything is written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: storage.MAX_BYTES, files: 6 },
});

const GENERIC_OTP_RESPONSE = {
  success: true,
  message: 'If that email is registered, a verification code has been sent.',
};

// ---------------------------------------------------------------- register

/**
 * PHASE 15.
 *
 * Registration creates a driver in `pending_documents`. It does NOT grant
 * access to ride requests — that requires document upload plus an explicit
 * admin approval. The old flow made anyone who could receive an email a
 * "verified" driver with visibility into every pending booking.
 */
router.post('/register', registerLimiter, validate({ body: S.driverRegisterBody }), async (req, res, next) => {
  try {
    const existing = await Driver.findOne({ email: req.body.email });
    if (existing) {
      throw conflict('DRIVER_EXISTS', 'An account with that email already exists.');
    }

    const driver = await Driver.create({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      carType: req.body.carType,
      carNumber: req.body.carNumber,
      licenseNumber: req.body.licenseNumber,
      // Explicitly set; never taken from the body.
      isEmailVerified: false,
      approvalStatus: 'pending_documents',
      availability: 'offline',
    });

    await audit.record({
      actorType: 'driver', actor: driver._id, actorLabel: driver.email,
      action: 'driver.register', resource: 'Driver', resourceId: driver._id, req,
    });

    res.status(201).json({
      success: true,
      message: 'Registration received. Verify your email, upload your documents, then an admin will review your account.',
      data: { driverId: driver._id, approvalStatus: driver.approvalStatus },
    });
  } catch (err) { next(err); }
});

// --------------------------------------------------------------------- OTP

router.post('/request-otp', otpRequestLimiter, validate({ body: S.driverRequestOtpBody }), async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ email: req.body.email })
      .select('+otpHash +otpExpiry +otpAttempts +otpLastSentAt');

    // Constant response — no account enumeration.
    if (!driver) return res.json(GENERIC_OTP_RESPONSE);

    const { otp, fields } = await otpService.issue(driver);
    Object.assign(driver, fields);
    await driver.save();

    try {
      await otpService.sendEmail(driver.email, otp);
    } catch (deliveryErr) {
      logger.error('Driver OTP delivery failed', { error: deliveryErr.message });
      if (env.isProduction) throw deliveryErr;
    }
    if (!env.isProduction) logger.warn(`[dev] Driver OTP for ${driver.email}: ${otp}`);

    res.json(GENERIC_OTP_RESPONSE);
  } catch (err) { next(err); }
});

router.post('/verify-otp', otpVerifyLimiter, validate({ body: S.driverVerifyOtpBody }), async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ email: req.body.email })
      .select('+otpHash +otpExpiry +otpAttempts +otpLastSentAt');
    if (!driver) throw badRequest('OTP_INVALID', 'That code is not valid.');

    try {
      await otpService.verify(driver, req.body.otp);
    } catch (verifyErr) {
      await driver.save();     // persist the attempt counter
      throw verifyErr;
    }

    // Confirms the email address. Deliberately does NOT touch approvalStatus.
    driver.isEmailVerified = true;
    if (driver.approvalStatus === 'pending_documents' && driver.documents?.length >= 2) {
      driver.approvalStatus = 'pending_review';
    }
    driver.lastLoginAt = new Date();
    await driver.save();

    const { accessToken } = await tokens.issueSession(res, 'driver', driver, { req });

    await audit.record({
      actorType: 'driver', actor: driver._id, actorLabel: driver.email,
      action: 'driver.login', resource: 'Driver', resourceId: driver._id, req,
    });

    res.json({
      success: true,
      data: {
        driver: dto.driverSelf(driver),
        accessToken,
        // The client uses this to show the right screen instead of assuming access.
        canAcceptRides: driver.isActive(),
      },
    });
  } catch (err) { next(err); }
});

// ----------------------------------------------------------------- refresh

router.post('/refresh', refreshLimiter, async (req, res, next) => {
  try {
    const raw = req.cookies?.[tokens.REFRESH_COOKIE.driver];
    if (!raw) throw unauthorized('NO_REFRESH_TOKEN', 'Session expired. Please sign in again.');

    const { subjectId, family } = await tokens.rotateRefreshToken(raw, 'driver');
    const driver = await Driver.findById(subjectId);
    if (!driver) throw unauthorized('DRIVER_NOT_FOUND', 'Account no longer exists.');

    const { accessToken } = await tokens.issueSession(res, 'driver', driver, { family, req });
    res.json({ success: true, data: { accessToken, driver: dto.driverSelf(driver) } });
  } catch (err) {
    tokens.clearAuthCookies(res, 'driver');
    next(err);
  }
});

// ------------------------------------------------------------------ logout

router.post('/logout', async (req, res, next) => {
  try {
    await tokens.revokeToken(req.cookies?.[tokens.REFRESH_COOKIE.driver], 'driver');
    tokens.clearAuthCookies(res, 'driver');
    res.json({ success: true, message: 'Signed out.' });
  } catch (err) { next(err); }
});

router.get('/me', protectDriver, (req, res) => {
  res.json({
    success: true,
    data: {
      driver: dto.driverSelf(req.driver),
      canAcceptRides: req.driver.isActive(),
    },
  });
});

// ------------------------------------------------------------- documents

/**
 * PHASE 15/26. A driver uploads their own documents; the field name selects
 * the document type, and the file is validated by content before storage.
 */
router.post(
  '/documents',
  protectDriver,
  uploadLimiter,
  upload.fields([
    { name: 'driving_license', maxCount: 1 },
    { name: 'rc', maxCount: 1 },
    { name: 'insurance', maxCount: 1 },
    { name: 'identity', maxCount: 1 },
    { name: 'driver_photo', maxCount: 1 },
    { name: 'vehicle_photo', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const files = req.files || {};
      const fieldNames = Object.keys(files);
      if (!fieldNames.length) {
        throw badRequest('NO_FILES', 'Attach at least one document.');
      }
      if (req.driver.approvalStatus === 'approved') {
        throw badRequest('ALREADY_APPROVED', 'Your documents have already been approved.');
      }

      const stored = [];
      for (const field of fieldNames) {
        const file = files[field][0];
        const result = await storage.store(file, `drivers/${req.driver._id}`);

        // Replace any previous document of the same type.
        req.driver.documents = req.driver.documents.filter(d => d.type !== field);
        req.driver.documents.push({
          type: field,
          storageKey: result.key,
          mimeType: result.mimeType,
          sizeBytes: result.sizeBytes,
          status: 'pending',
        });
        stored.push({ type: field, sizeBytes: result.sizeBytes });
      }

      // Enough documents to be reviewable, and the email is confirmed.
      if (req.driver.isEmailVerified && req.driver.documents.length >= 2 &&
          req.driver.approvalStatus === 'pending_documents') {
        req.driver.approvalStatus = 'pending_review';
      }
      await req.driver.save();

      await audit.record({
        actorType: 'driver', actor: req.driver._id,
        action: 'driver.documents_uploaded', resource: 'Driver', resourceId: req.driver._id,
        newValue: { documents: stored }, req,
      });

      res.status(201).json({
        success: true,
        message: 'Documents uploaded. An admin will review them shortly.',
        data: { driver: dto.driverSelf(req.driver) },
      });
    } catch (err) { next(err); }
  }
);

module.exports = router;
