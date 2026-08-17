const crypto = require('crypto');
const env = require('../config/env');
const { badRequest, serverError } = require('../utils/errors');

/**
 * Razorpay integration (PHASE 11/12/13).
 *
 * Signature comparison uses timingSafeEqual. The original used `!==` on hex
 * strings, which leaks position-of-first-difference through timing; that is a
 * weak oracle in practice but there is no reason to hand it over.
 */

let client = null;
function getClient() {
  if (!env.razorpay.enabled) {
    throw serverError('PAYMENTS_NOT_CONFIGURED', 'Payments are not configured on this server.');
  }
  if (!client) {
    const Razorpay = require('razorpay');
    client = new Razorpay({
      key_id: env.razorpay.keyId,
      key_secret: env.razorpay.keySecret,
    });
  }
  return client;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function createOrder({ amountPaise, receipt, notes }) {
  return getClient().orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt,
    notes,
    payment_capture: 1,
  });
}

/** Fetch the authoritative payment record from Razorpay. */
async function fetchPayment(paymentId) {
  return getClient().payments.fetch(paymentId);
}

/**
 * Verify a checkout signature.
 *
 * There is no bypass branch. An absent or empty signature is a failure, not a
 * reason to skip the check — that branch is exactly how the old build let a
 * client confirm a booking by posting `razorpaySignature: ''`.
 */
function verifyCheckoutSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  if (!env.razorpay.keySecret) {
    throw serverError('PAYMENTS_NOT_CONFIGURED', 'Payments are not configured on this server.');
  }
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw badRequest('INVALID_PAYMENT_SIGNATURE', 'Payment could not be verified.');
  }
  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (!safeEqual(expected, razorpaySignature)) {
    throw badRequest('INVALID_PAYMENT_SIGNATURE', 'Payment could not be verified.');
  }
  return true;
}

/** Verify a webhook body signature against the raw bytes Razorpay signed. */
function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpay.webhookSecret) {
    throw serverError('WEBHOOK_NOT_CONFIGURED', 'Webhooks are not configured on this server.');
  }
  if (!signature) {
    throw badRequest('INVALID_WEBHOOK_SIGNATURE', 'Missing webhook signature.');
  }
  const expected = crypto
    .createHmac('sha256', env.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (!safeEqual(expected, signature)) {
    throw badRequest('INVALID_WEBHOOK_SIGNATURE', 'Webhook signature did not match.');
  }
  return true;
}

async function createRefund(paymentId, amountPaise, notes) {
  return getClient().payments.refund(paymentId, {
    amount: amountPaise,
    speed: 'normal',
    notes,
  });
}

module.exports = {
  getClient,
  createOrder,
  fetchPayment,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  createRefund,
  safeEqual,
};
