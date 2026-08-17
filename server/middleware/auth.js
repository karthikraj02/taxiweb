const User = require('../models/User');
const Driver = require('../models/Driver');
const tokens = require('../services/tokens');
const { unauthorized, forbidden } = require('../utils/errors');

/**
 * Authentication and authorisation (PHASE 6/16).
 *
 * Two changes worth calling out:
 *
 * 1. The old middleware accepted a Bearer token from the `authorization`
 *    header on BOTH the user and driver paths without distinguishing audience,
 *    so a token minted for one surface could be presented to the other. Tokens
 *    now carry an audience claim that is verified.
 *
 * 2. `sessionsValidFrom` is checked, so changing a password or forcing a
 *    logout invalidates access tokens already in the wild rather than leaving
 *    them valid until natural expiry.
 */

function extractToken(req, cookieName) {
  if (req.cookies?.[cookieName]) return req.cookies[cookieName];
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

const protect = async (req, res, next) => {
  try {
    const token = extractToken(req, tokens.ACCESS_COOKIE.user);
    if (!token) throw unauthorized();

    let decoded;
    try {
      decoded = tokens.verifyAccessToken(token, 'user');
    } catch {
      throw unauthorized('INVALID_TOKEN', 'Your session is invalid or has expired.');
    }
    if (decoded.type !== 'user') throw unauthorized('WRONG_TOKEN_TYPE', 'This token is not valid here.');

    const user = await User.findById(decoded.sub);
    if (!user) throw unauthorized('USER_NOT_FOUND', 'Account no longer exists.');

    if (user.sessionsValidFrom && decoded.iat * 1000 < new Date(user.sessionsValidFrom).getTime() - 1000) {
      throw unauthorized('SESSION_REVOKED', 'Your session has been ended. Please sign in again.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

const protectDriver = async (req, res, next) => {
  try {
    const token = extractToken(req, tokens.ACCESS_COOKIE.driver);
    if (!token) throw unauthorized();

    let decoded;
    try {
      decoded = tokens.verifyAccessToken(token, 'driver');
    } catch {
      throw unauthorized('INVALID_TOKEN', 'Your session is invalid or has expired.');
    }
    if (decoded.type !== 'driver') throw unauthorized('WRONG_TOKEN_TYPE', 'This token is not valid here.');

    const driver = await Driver.findById(decoded.sub);
    if (!driver) throw unauthorized('DRIVER_NOT_FOUND', 'Account no longer exists.');

    if (driver.sessionsValidFrom && decoded.iat * 1000 < new Date(driver.sessionsValidFrom).getTime() - 1000) {
      throw unauthorized('SESSION_REVOKED', 'Your session has been ended. Please sign in again.');
    }
    if (driver.approvalStatus === 'suspended') {
      throw forbidden('DRIVER_SUSPENDED', 'Your driver account is suspended. Contact support.');
    }

    req.driver = driver;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Driver routes that touch live operations additionally require an approved,
 * email-verified account. Registration and document upload deliberately do not
 * use this — a pending driver still needs to reach those.
 */
const requireApprovedDriver = (req, res, next) => {
  if (!req.driver) return next(unauthorized());
  if (!req.driver.isActive()) {
    return next(forbidden(
      'DRIVER_NOT_APPROVED',
      'Your account is awaiting admin approval. You will be notified once documents are verified.'
    ));
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(forbidden('INSUFFICIENT_ROLE', 'You do not have permission to perform this action.'));
  }
  next();
};

const requireAdmin = requireRole('admin');

/** Attaches req.user when a valid token is present, but never rejects. */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req, tokens.ACCESS_COOKIE.user);
    if (token) {
      const decoded = tokens.verifyAccessToken(token, 'user');
      if (decoded.type === 'user') {
        req.user = await User.findById(decoded.sub);
      }
    }
  } catch {
    // Intentionally ignored — this middleware is opt-in enrichment.
  }
  next();
};

module.exports = {
  protect,
  protectDriver,
  requireApprovedDriver,
  requireRole,
  requireAdmin,
  optionalAuth,
  extractToken,
};
