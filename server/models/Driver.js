const mongoose = require('mongoose');
const { VEHICLE_TYPES } = require('../services/pricing');

/**
 * Driver lifecycle (PHASE 15/16/18/20).
 *
 * Two things changed materially from the original schema:
 *
 * 1. `isVerified` used to be flipped to true the moment an OTP was confirmed,
 *    which meant anyone with an email address became a "verified driver" and
 *    could read every pending booking including customer phone numbers.
 *    Email verification and business approval are now separate fields.
 *
 * 2. Location is GeoJSON with a 2dsphere index so dispatch can run a real
 *    geospatial query, instead of a lat/lng pair defaulted to the middle of
 *    Udupi for every driver.
 */

const APPROVAL_STATUS = ['pending_documents', 'pending_review', 'approved', 'rejected', 'suspended'];
const AVAILABILITY = ['offline', 'online', 'busy', 'on_trip', 'suspended'];
const DOCUMENT_TYPES = ['driving_license', 'rc', 'insurance', 'identity', 'driver_photo', 'vehicle_photo'];

const documentSchema = new mongoose.Schema({
  type: { type: String, enum: DOCUMENT_TYPES, required: true },
  storageKey: { type: String, required: true },   // opaque key, never the original filename
  mimeType: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: { type: String },
  uploadedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: true });

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, trim: true, maxlength: 300 },

  carType: { type: String, enum: VEHICLE_TYPES },
  carNumber: { type: String, trim: true, uppercase: true },
  licenseNumber: { type: String, trim: true },

  documents: [documentSchema],

  rating: { type: Number, default: null, min: 1, max: 5 },
  ratingCount: { type: Number, default: 0 },

  // Contact-channel verification only. NOT a business approval.
  isEmailVerified: { type: Boolean, default: false },

  // Business approval, set by an admin after document review (PHASE 15).
  approvalStatus: { type: String, enum: APPROVAL_STATUS, default: 'pending_documents' },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String },

  availability: { type: String, enum: AVAILABILITY, default: 'offline' },

  // GeoJSON Point: [longitude, latitude] (PHASE 18)
  //
  // `type` deliberately has NO default. A default of 'Point' made every new
  // driver start with `{ type: 'Point' }` and no coordinates, which is invalid
  // GeoJSON: the 2dsphere index below rejects the insert ("Can't extract geo
  // keys"), so registering any driver failed with a 500. Until the driver
  // shares a location the field is simply absent, and 2dsphere skips absent
  // fields. The location route sets `type` and `coordinates` together.
  currentLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number], default: undefined },
  },
  locationAccuracy: { type: Number },
  locationHeading: { type: Number },
  locationSpeed: { type: Number },
  locationUpdatedAt: { type: Date },

  otpHash: { type: String, select: false },
  otpExpiry: { type: Date, select: false },
  otpAttempts: { type: Number, default: 0, select: false },
  otpLastSentAt: { type: Date, select: false },

  sessionsValidFrom: { type: Date, default: Date.now },
  lastLoginAt: { type: Date },
}, { timestamps: true });

// PHASE 31 — indexes
driverSchema.index({ currentLocation: '2dsphere' });
driverSchema.index({ approvalStatus: 1, availability: 1, carType: 1 });
driverSchema.index({ phone: 1 });
driverSchema.index({ createdAt: -1 });

/** A driver may only be dispatched when approved, online and email-verified. */
driverSchema.methods.isDispatchable = function () {
  return (
    this.approvalStatus === 'approved' &&
    this.isEmailVerified &&
    this.availability === 'online' &&
    Array.isArray(this.currentLocation?.coordinates) &&
    this.currentLocation.coordinates.length === 2
  );
};

/** Whether this driver may access driver-only APIs at all. */
driverSchema.methods.isActive = function () {
  return this.approvalStatus === 'approved' && this.isEmailVerified;
};

driverSchema.methods.toJSON = function () {
  const obj = this.toObject();
  ['otpHash', 'otpExpiry', 'otpAttempts', 'otpLastSentAt', '__v'].forEach(k => delete obj[k]);
  return obj;
};

module.exports = mongoose.model('Driver', driverSchema);
module.exports.APPROVAL_STATUS = APPROVAL_STATUS;
module.exports.AVAILABILITY = AVAILABILITY;
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
