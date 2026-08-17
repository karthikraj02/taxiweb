const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const RefreshToken = require('../models/RefreshToken');
const logger = require('../utils/logger');
const { unauthorized } = require('../utils/errors');

/**
 * Token service (PHASE 3).
 *
 * - short-lived access JWT (15m default)
 * - opaque refresh token, stored only as a SHA-256 hash
 * - rotation on every refresh
 * - reuse detection: presenting an already-rotated token revokes the whole family
 * - HttpOnly + Secure + SameSite cookies
 */

const ACCESS_COOKIE = { user: 'accessToken', driver: 'driverAccessToken' };
const REFRESH_COOKIE = { user: 'refreshToken', driver: 'driverRefreshToken' };

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function signAccessToken(subjectType, subject) {
  const payload = {
    sub: subject._id.toString(),
    type: subjectType,
    role: subjectType === 'driver' ? 'driver' : (subject.role || 'user'),
    // Lets `protect` reject tokens minted before a password change / forced logout.
    iat: Math.floor(Date.now() / 1000),
  };
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: subjectType === 'driver' ? env.driverAccessTokenTtl : env.accessTokenTtl,
    issuer: 'taxiweb',
    audience: `taxiweb:${subjectType}`,
  });
}

function verifyAccessToken(token, expectedType) {
  return jwt.verify(token, env.jwtSecret, {
    issuer: 'taxiweb',
    audience: `taxiweb:${expectedType}`,
  });
}

async function createRefreshToken(subjectType, subject, { family, req } = {}) {
  const raw = crypto.randomBytes(48).toString('base64url');
  await RefreshToken.create({
    tokenHash: hashToken(raw),
    family: family || crypto.randomUUID(),
    subjectType,
    subject: subject._id,
    expiresAt: new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
    userAgent: req?.get?.('user-agent'),
    ip: req?.ip,
  });
  return raw;
}

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    // 'none' is required for a Vercel frontend calling a separately-hosted API,
    // and 'none' without Secure is rejected by browsers — hence the pairing.
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

function setAuthCookies(res, subjectType, accessToken, refreshToken) {
  res.cookie(ACCESS_COOKIE[subjectType], accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie(
    REFRESH_COOKIE[subjectType],
    refreshToken,
    cookieOptions(env.refreshTokenTtlDays * 24 * 60 * 60 * 1000)
  );
}

function clearAuthCookies(res, subjectType) {
  const opts = { ...cookieOptions(0) };
  delete opts.maxAge;
  res.clearCookie(ACCESS_COOKIE[subjectType], opts);
  res.clearCookie(REFRESH_COOKIE[subjectType], opts);
}

/** Issue a fresh access + refresh pair and set cookies. */
async function issueSession(res, subjectType, subject, { family, req } = {}) {
  const accessToken = signAccessToken(subjectType, subject);
  const refreshToken = await createRefreshToken(subjectType, subject, { family, req });
  setAuthCookies(res, subjectType, accessToken, refreshToken);
  return { accessToken };
}

/**
 * Rotate a refresh token.
 *
 * Reuse of an already-rotated token means the token leaked, so every token in
 * that family is revoked and the caller must re-authenticate.
 */
async function rotateRefreshToken(rawToken, subjectType) {
  const tokenHash = hashToken(rawToken);
  const stored = await RefreshToken.findOne({ tokenHash, subjectType });

  if (!stored) throw unauthorized('INVALID_REFRESH_TOKEN', 'Session expired. Please sign in again.');

  if (stored.revokedAt) {
    logger.warn('Refresh token reuse detected — revoking family', {
      family: stored.family,
      subjectType,
    });
    await RefreshToken.updateMany(
      { family: stored.family, revokedAt: null },
      { revokedAt: new Date() }
    );
    throw unauthorized('REFRESH_TOKEN_REUSED', 'Session expired. Please sign in again.');
  }

  if (stored.expiresAt < new Date()) {
    throw unauthorized('REFRESH_TOKEN_EXPIRED', 'Session expired. Please sign in again.');
  }

  stored.revokedAt = new Date();
  await stored.save();

  return { subjectId: stored.subject, family: stored.family };
}

/** Revoke every refresh token for a subject (logout-all / password change). */
async function revokeAllForSubject(subjectType, subjectId) {
  await RefreshToken.updateMany(
    { subjectType, subject: subjectId, revokedAt: null },
    { revokedAt: new Date() }
  );
}

async function revokeToken(rawToken, subjectType) {
  if (!rawToken) return;
  await RefreshToken.updateOne(
    { tokenHash: hashToken(rawToken), subjectType, revokedAt: null },
    { revokedAt: new Date() }
  );
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  hashToken,
  signAccessToken,
  verifyAccessToken,
  issueSession,
  setAuthCookies,
  clearAuthCookies,
  rotateRefreshToken,
  revokeAllForSubject,
  revokeToken,
};
