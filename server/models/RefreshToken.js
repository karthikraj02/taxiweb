const mongoose = require('mongoose');

/**
 * Refresh tokens (PHASE 3).
 *
 * Only a SHA-256 hash is stored, so a database dump does not hand an attacker
 * usable sessions. Tokens rotate on every use and carry a `family` id: if a
 * token that has already been rotated is presented again, the whole family is
 * revoked, which is the standard response to a stolen-token replay.
 */
const refreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  family: { type: String, required: true, index: true },
  subjectType: { type: String, enum: ['user', 'driver'], required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  replacedBy: { type: String, default: null },
  userAgent: { type: String },
  ip: { type: String },
}, { timestamps: true });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ subjectType: 1, subject: 1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
