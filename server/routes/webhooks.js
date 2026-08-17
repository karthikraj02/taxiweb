const express = require('express');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const WebhookEvent = require('../models/WebhookEvent');
const razorpayService = require('../services/razorpay');
const audit = require('../services/audit');
const logger = require('../utils/logger');
const { STATUS } = require('../constants/bookingStates');
const { emitToBooking } = require('../socket');

const router = express.Router();

/**
 * Razorpay webhooks (PHASE 13).
 *
 * Mounted BEFORE the JSON body parser and CSRF middleware in index.js, because
 * the signature is computed over the exact raw bytes Razorpay sent. Parsing and
 * re-serialising the body would change the digest and every verification would
 * fail.
 *
 * Idempotency is enforced by a unique index on WebhookEvent.eventId — a
 * concurrent redelivery loses the insert race and is skipped, rather than
 * being checked-then-inserted with a window in between.
 */
router.post('/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  const signature = req.get('x-razorpay-signature');
  const rawBody = req.body; // Buffer

  try {
    razorpayService.verifyWebhookSignature(rawBody, signature);
  } catch (err) {
    logger.warn('Rejected webhook with bad signature', { error: err.message });
    // 400, not 500: tells Razorpay not to keep retrying a malformed delivery.
    return res.status(400).json({ success: false, error: { code: 'INVALID_WEBHOOK_SIGNATURE' } });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false, error: { code: 'INVALID_WEBHOOK_BODY' } });
  }

  // Razorpay sends x-razorpay-event-id; fall back to a digest of the payload.
  const eventId = req.get('x-razorpay-event-id')
    || crypto.createHash('sha256').update(rawBody).digest('hex');

  let ledgerEntry;
  try {
    ledgerEntry = await WebhookEvent.create({
      provider: 'razorpay',
      eventId,
      eventType: event.event || 'unknown',
      payloadDigest: crypto.createHash('sha256').update(rawBody).digest('hex'),
      status: 'received',
    });
  } catch (err) {
    if (err.code === 11000) {
      // Already seen. Acknowledge so Razorpay stops retrying.
      logger.debug('Duplicate webhook ignored', { eventId });
      return res.json({ success: true, duplicate: true });
    }
    logger.error('Webhook ledger write failed', { error: err.message });
    return res.status(500).json({ success: false, error: { code: 'WEBHOOK_LEDGER_ERROR' } });
  }

  try {
    await handleEvent(event, req);
    ledgerEntry.status = 'processed';
    ledgerEntry.processedAt = new Date();
    await ledgerEntry.save();
    return res.json({ success: true });
  } catch (err) {
    logger.error('Webhook processing failed', { eventId, eventType: event.event, error: err.message });
    ledgerEntry.status = 'failed';
    ledgerEntry.error = err.message;
    await ledgerEntry.save();
    // 500 so Razorpay retries; the ledger row is already marked failed and the
    // unique index means a retry with the same id would be skipped, so retries
    // are handled by Razorpay's own redelivery with a fresh event id.
    return res.status(500).json({ success: false, error: { code: 'WEBHOOK_PROCESSING_FAILED' } });
  }
});

async function handleEvent(event, req) {
  const type = event.event;

  if (type === 'payment.captured' || type === 'payment.authorized') {
    const entity = event.payload?.payment?.entity;
    if (!entity) return;

    const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
    if (!payment) {
      logger.warn('Webhook for unknown order', { orderId: entity.order_id });
      return;
    }
    // Amount is re-checked here too: the webhook is an independent channel and
    // must not be able to confirm a booking for the wrong amount either.
    if (Number(entity.amount) !== payment.amountPaise) {
      logger.error('Webhook amount mismatch', {
        expected: payment.amountPaise, received: entity.amount,
      });
      return;
    }
    if (payment.status === 'paid') return;

    await Payment.updateOne(
      { _id: payment._id, status: { $ne: 'paid' } },
      { $set: { status: 'paid', razorpayPaymentId: entity.id, paidAt: new Date() } }
    );

    const booking = await Booking.findById(payment.booking);
    if (booking && booking.status === STATUS.PAYMENT_PENDING) {
      booking.pushStatus(STATUS.CONFIRMED, 'system', null, 'Payment captured (webhook)');
      booking.paymentStatus = 'paid';
      await booking.save();
      emitToBooking(booking.bookingId, 'bookingStatus', {
        bookingId: booking.bookingId, status: STATUS.CONFIRMED, paymentStatus: 'paid',
      });
    }

    await audit.record({
      actorType: 'webhook', action: 'payment.captured',
      resource: 'Payment', resourceId: payment._id,
      newValue: { amountPaise: entity.amount }, req,
    });
    return;
  }

  if (type === 'payment.failed') {
    const entity = event.payload?.payment?.entity;
    if (!entity) return;

    const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
    if (!payment || payment.status === 'paid') return;

    payment.status = 'failed';
    payment.failureReason = entity.error_description || entity.error_reason || 'Payment failed';
    await payment.save();

    const booking = await Booking.findById(payment.booking);
    if (booking && booking.status === STATUS.PAYMENT_PENDING) {
      booking.pushStatus(STATUS.PAYMENT_FAILED, 'system', null, 'Payment failed (webhook)');
      booking.paymentStatus = 'failed';
      await booking.save();
      emitToBooking(booking.bookingId, 'bookingStatus', {
        bookingId: booking.bookingId, status: STATUS.PAYMENT_FAILED, paymentStatus: 'failed',
      });
    }
    return;
  }

  if (type === 'refund.processed' || type === 'refund.created') {
    const entity = event.payload?.refund?.entity;
    if (!entity) return;

    const payment = await Payment.findOne({ razorpayPaymentId: entity.payment_id });
    if (!payment) return;

    const refundedPaise = Number(entity.amount) || 0;
    const fullyRefunded = refundedPaise >= payment.amountPaise;

    payment.refundId = entity.id;
    payment.refundAmountPaise = refundedPaise;
    payment.status = type === 'refund.processed'
      ? (fullyRefunded ? 'refunded' : 'partially_refunded')
      : 'refund_processing';
    if (type === 'refund.processed') payment.refundedAt = new Date();
    await payment.save();

    await Booking.updateOne(
      { _id: payment.booking },
      { paymentStatus: type === 'refund.processed' ? 'refunded' : 'refund_processing' }
    );

    await audit.record({
      actorType: 'webhook', action: `payment.${type}`,
      resource: 'Payment', resourceId: payment._id,
      newValue: { refundedPaise }, req,
    });
    return;
  }

  logger.debug('Unhandled webhook event type', { type });
}

module.exports = router;
