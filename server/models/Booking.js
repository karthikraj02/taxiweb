const mongoose = require('mongoose');
const { STATUS, ALL_STATUSES } = require('../constants/bookingStates');
const { VEHICLE_TYPES } = require('../services/pricing');

/**
 * Booking (PHASE 8/21/30/31).
 *
 * `fare`, `distanceKm` and `fareBreakdown` are written ONLY by the server from
 * the pricing service. No route accepts them from a request body.
 */

const coordSchema = new mongoose.Schema({
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
}, { _id: false });

const statusEventSchema = new mongoose.Schema({
  from: { type: String },
  to: { type: String, required: true },
  at: { type: Date, default: Date.now },
  actorType: { type: String, enum: ['system', 'customer', 'driver', 'admin'], default: 'system' },
  actorId: { type: mongoose.Schema.Types.ObjectId },
  reason: { type: String },
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  pickup: { type: String, required: true, trim: true, maxlength: 300 },
  drop: { type: String, required: true, trim: true, maxlength: 300 },
  pickupCoords: { type: coordSchema, required: true },
  dropCoords: { type: coordSchema, required: true },

  scheduledFor: { type: Date, required: true },
  carType: { type: String, enum: VEHICLE_TYPES, required: true },
  tripType: { type: String, enum: ['one-way', 'round-trip'], default: 'one-way' },
  passengerCount: { type: Number, min: 1, max: 12, default: 1 },
  notes: { type: String, maxlength: 500 },

  // --- Server-authoritative values. Never accepted from the client.
  distanceKm: { type: Number, required: true, min: 0 },
  durationMinutes: { type: Number, min: 0 },
  distanceProvider: { type: String },
  distanceEstimated: { type: Boolean, default: false },
  fare: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' },
  fareBreakdown: { type: mongoose.Schema.Types.Mixed },

  status: { type: String, enum: ALL_STATUSES, default: STATUS.PENDING, required: true },
  statusHistory: { type: [statusEventSchema], default: [] },

  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
  driverAssignedAt: { type: Date },

  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'pending', 'paid', 'failed', 'refund_requested', 'refund_processing', 'refunded'],
    default: 'unpaid',
  },

  cancelledAt: { type: Date },
  cancelledBy: { type: String, enum: ['customer', 'driver', 'admin', 'system'] },
  cancellationReason: { type: String, maxlength: 300 },
  cancellationFee: { type: Number, default: 0 },

  startedAt: { type: Date },
  completedAt: { type: Date },

  // PHASE 30 — replayed requests return the original booking instead of
  // creating a second one.
  idempotencyKey: { type: String, index: true, sparse: true },
}, { timestamps: true });

// PHASE 31 — indexes matching real query patterns
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ driver: 1, status: 1 });
bookingSchema.index({ status: 1, carType: 1, createdAt: -1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ paymentStatus: 1 });
// One in-flight booking per idempotency key per user.
bookingSchema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

/** Records a transition in history. Legality is checked by the caller via assertTransition. */
bookingSchema.methods.pushStatus = function (to, actorType = 'system', actorId = null, reason = null) {
  this.statusHistory.push({ from: this.status, to, actorType, actorId, reason });
  this.status = to;
};

module.exports = mongoose.model('Booking', bookingSchema);
