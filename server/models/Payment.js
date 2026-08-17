const mongoose = require('mongoose');

/**
 * Payment (PHASE 11/13/14/31).
 *
 * `amountPaise` is written from the booking's server-calculated fare. The
 * verify endpoint compares the amount Razorpay reports against this stored
 * value, so a tampered client amount cannot confirm a booking cheaply.
 */
const paymentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  razorpayOrderId: { type: String, required: true, unique: true },
  razorpayPaymentId: { type: String, unique: true, sparse: true },

  amountPaise: { type: Number, required: true, min: 100 },
  currency: { type: String, default: 'INR' },
  receipt: { type: String, required: true },

  status: {
    type: String,
    enum: ['created', 'authorized', 'paid', 'failed',
           'refund_requested', 'refund_processing', 'refunded', 'partially_refunded'],
    default: 'created',
  },
  failureReason: { type: String },
  paidAt: { type: Date },

  // --- Refund lifecycle (PHASE 14)
  refundId: { type: String },
  refundAmountPaise: { type: Number, default: 0 },
  refundReason: { type: String },
  refundRequestedAt: { type: Date },
  refundedAt: { type: Date },

  // Set only when demo mode is explicitly enabled. Production can never write
  // a truthy value here because DEMO_MODE is forced false when NODE_ENV=production.
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ booking: 1 });
paymentSchema.index({ status: 1 });

// The signature is a transient verification artefact, not a stored credential.
paymentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Payment', paymentSchema);
