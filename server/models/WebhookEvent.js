const mongoose = require('mongoose');

/**
 * Webhook idempotency ledger (PHASE 13).
 *
 * Razorpay retries deliveries. The unique index on eventId is what makes
 * "never process the same event twice" a database guarantee rather than an
 * application convention that races under concurrent retries.
 */
const webhookEventSchema = new mongoose.Schema({
  provider: { type: String, required: true, default: 'razorpay' },
  eventId: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  processedAt: { type: Date },
  status: { type: String, enum: ['received', 'processed', 'failed', 'ignored'], default: 'received' },
  error: { type: String },
  payloadDigest: { type: String },
}, { timestamps: true });

webhookEventSchema.index({ eventType: 1, createdAt: -1 });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
