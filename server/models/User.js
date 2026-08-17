const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  phone: { type: String, unique: true, sparse: true, trim: true },
  password: { type: String, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isVerified: { type: Boolean, default: false },

  // --- OTP (PHASE 4). Only the hash is stored; plaintext never touches the DB.
  otpHash: { type: String, select: false },
  otpExpiry: { type: Date, select: false },
  otpAttempts: { type: Number, default: 0, select: false },
  otpLastSentAt: { type: Date, select: false },

  // --- Brute-force protection (PHASE 5)
  failedLoginAttempts: { type: Number, default: 0, select: false },
  lockUntil: { type: Date, select: false },

  // Refresh tokens issued before this instant are rejected. This is how
  // "log out everywhere after a password change" is enforced.
  sessionsValidFrom: { type: Date, default: Date.now },
  passwordChangedAt: { type: Date },

  lastLoginAt: { type: Date },
}, { timestamps: true });

userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, env.bcryptRounds);
  this.passwordChangedAt = new Date();
  this.sessionsValidFrom = new Date();
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isLocked = function () {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

// Safety net: even if a query forgets to deselect, serialising never emits
// credentials. The explicit DTOs in dto/ remain the primary control.
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  ['password', 'otpHash', 'otpExpiry', 'otpAttempts', 'otpLastSentAt',
   'failedLoginAttempts', 'lockUntil', '__v'].forEach(k => delete obj[k]);
  return obj;
};

module.exports = mongoose.model('User', userSchema);
