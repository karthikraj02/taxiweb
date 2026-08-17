const express = require('express');
const env = require('../config/env');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const razorpay = require('../services/razorpay');
const bookingService = require('../services/booking');
const audit = require('../services/audit');
const logger = require('../utils/logger');
const dto = require('../dto');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const S = require('../validators/schemas');
const { paymentLimiter } = require('../middleware/rateLimiters');
const { STATUS } = require('../constants/bookingStates');
const { notFound, badRequest, conflict } = require('../utils/errors');
const { emitToBooking } = require('../socket');

const router = express.Router();

// ------------------------------------------------------------ create order

/**
 * PHASE 11.
 *
 * The amount is read from `booking.fare`, which the pricing service wrote at
 * creation time. The request body carries only a booking reference — there is
 * no `amount` field to tamper with, and the validator rejects one if sent.
 */
router.post('/razorpay/order', protect, paymentLimiter, validate({ body: S.createOrderBody }), async (req, res, next) => {
  try {
    // Ownership is part of the query, so another user's booking simply is not found.
    const booking = await bookingService.findScoped(req.body.bookingId, { user: req.user._id });
    if (!booking) throw notFound('BOOKING_NOT_FOUND', 'We could not find that booking.');

    if (booking.paymentStatus === 'paid') {
      throw conflict('ALREADY_PAID', 'This booking has already been paid for.');
    }
    if (![STATUS.PENDING, STATUS.PAYMENT_PENDING, STATUS.PAYMENT_FAILED].includes(booking.status)) {
      throw badRequest('BOOKING_NOT_PAYABLE', 'This booking is not awaiting payment.');
    }

    const amountPaise = Math.round(booking.fare * 100);
    if (!Number.isFinite(amountPaise) || amountPaise < 100) {
      throw badRequest('INVALID_AMOUNT', 'This booking has no valid fare to charge.');
    }

    // Reuse an open order rather than minting a new one on every retry.
    const openOrder = await Payment.findOne({
      booking: booking._id,
      status: 'created',
      amountPaise,
    });
    if (openOrder) {
      return res.json({
        success: true,
        data: {
          orderId: openOrder.razorpayOrderId,
          amount: amountPaise,
          currency: 'INR',
          keyId: env.razorpay.keyId,
          bookingId: booking.bookingId,
        },
      });
    }

    const receipt = `rcpt_${booking.bookingId}_${Date.now()}`;
    const order = await razorpay.createOrder({
      amountPaise,
      receipt,
      notes: { bookingId: booking.bookingId, userId: req.user._id.toString() },
    });

    const payment = await Payment.create({
      booking: booking._id,
      user: req.user._id,
      razorpayOrderId: order.id,
      amountPaise,
      currency: 'INR',
      receipt,
      status: 'created',
    });

    booking.payment = payment._id;
    booking.paymentStatus = 'pending';
    if (booking.status === STATUS.PENDING) {
      booking.pushStatus(STATUS.PAYMENT_PENDING, 'customer', req.user._id);
    }
    await booking.save();

    await audit.record({
      actorType: 'user', actor: req.user._id,
      action: 'payment.order_created', resource: 'Payment', resourceId: payment._id,
      newValue: { amountPaise, bookingId: booking.bookingId }, req,
    });

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        amount: amountPaise,
        currency: 'INR',
        keyId: env.razorpay.keyId,
        bookingId: booking.bookingId,
      },
    });
  } catch (err) { next(err); }
});

// ----------------------------------------------------------------- verify

/**
 * PHASE 11/12.
 *
 * Every one of these checks is mandatory. There is no environment, flag or
 * payload shape that skips the signature comparison.
 */
router.post('/razorpay/verify', protect, paymentLimiter, validate({ body: S.verifyPaymentBody }), async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    // 1. The payment record must exist AND belong to the caller.
    //    The old code looked it up by order id alone, so any authenticated
    //    user could confirm any other user's payment.
    const payment = await Payment.findOne({
      razorpayOrderId,
      user: req.user._id,
    });
    if (!payment) throw notFound('PAYMENT_NOT_FOUND', 'We could not find that payment.');

    if (payment.status === 'paid') {
      const alreadyBooking = await Booking.findById(payment.booking);
      return res.json({
        success: true,
        data: {
          payment: dto.paymentSummary(payment),
          booking: dto.bookingForCustomer(alreadyBooking),
        },
        alreadyVerified: true,
      });
    }

    // 2. Cryptographic signature over orderId|paymentId.
    razorpay.verifyCheckoutSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });

    // 3. Ask Razorpay what actually happened. The signature proves the client
    //    did not forge the callback; this proves the money was really captured
    //    for the right order, amount and currency.
    const remote = await razorpay.fetchPayment(razorpayPaymentId);

    if (remote.order_id !== razorpayOrderId) {
      throw badRequest('PAYMENT_ORDER_MISMATCH', 'Payment could not be verified.');
    }
    if (!['captured', 'authorized'].includes(remote.status)) {
      payment.status = 'failed';
      payment.failureReason = `Gateway status: ${remote.status}`;
      await payment.save();
      await Booking.updateOne(
        { _id: payment.booking },
        { paymentStatus: 'failed' }
      );
      throw badRequest('PAYMENT_NOT_CAPTURED', 'This payment has not completed.');
    }
    if (Number(remote.amount) !== payment.amountPaise) {
      logger.error('Payment amount mismatch', {
        expected: payment.amountPaise, received: remote.amount,
        paymentId: payment._id.toString(),
      });
      throw badRequest('PAYMENT_AMOUNT_MISMATCH', 'The paid amount does not match this booking.');
    }
    if (String(remote.currency).toUpperCase() !== payment.currency) {
      throw badRequest('PAYMENT_CURRENCY_MISMATCH', 'Payment currency does not match this booking.');
    }

    // 4. Commit. The conditional filter makes a concurrent duplicate verify a
    //    no-op instead of a second state change.
    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $ne: 'paid' } },
      {
        $set: {
          razorpayPaymentId,
          status: 'paid',
          paidAt: new Date(),
        },
      },
      { new: true }
    );
    if (!updatedPayment) {
      throw conflict('PAYMENT_ALREADY_PROCESSED', 'This payment was already recorded.');
    }

    const booking = await Booking.findById(payment.booking);
    if (booking && booking.status === STATUS.PAYMENT_PENDING) {
      await bookingService.transitionAtomic(
        booking._id, booking.status, STATUS.CONFIRMED,
        {
          actorType: 'system',
          reason: 'Payment verified',
          extraSet: { paymentStatus: 'paid' },
        }
      );
    } else if (booking) {
      booking.paymentStatus = 'paid';
      await booking.save();
    }

    const finalBooking = await Booking.findById(payment.booking).populate('driver');

    await audit.record({
      actorType: 'user', actor: req.user._id,
      action: 'payment.verified', resource: 'Payment', resourceId: payment._id,
      newValue: { amountPaise: payment.amountPaise, bookingId: finalBooking?.bookingId }, req,
    });

    emitToBooking(finalBooking?.bookingId, 'bookingStatus', {
      bookingId: finalBooking?.bookingId,
      status: finalBooking?.status,
      paymentStatus: 'paid',
    });

    res.json({
      success: true,
      data: {
        payment: dto.paymentSummary(updatedPayment),
        booking: dto.bookingForCustomer(finalBooking),
      },
    });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------- my payments

router.get('/', protect, async (req, res, next) => {
  try {
    const payments = await Payment.find({ user: req.user._id })
      .sort({ createdAt: -1 }).limit(50).populate('booking', 'bookingId pickup drop scheduledFor');
    res.json({
      success: true,
      data: {
        payments: payments.map(p => ({
          ...dto.paymentSummary(p),
          booking: p.booking ? {
            bookingId: p.booking.bookingId,
            pickup: p.booking.pickup,
            drop: p.booking.drop,
            scheduledFor: p.booking.scheduledFor,
          } : null,
        })),
      },
    });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------ refund request

/** PHASE 14 — customer-initiated refund request. Admin executes it. */
router.post('/:id/refund-request', protect, validate({ params: S.objectIdParam, body: S.refundBody }), async (req, res, next) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, user: req.user._id });
    if (!payment) throw notFound('PAYMENT_NOT_FOUND', 'We could not find that payment.');
    if (payment.status !== 'paid') {
      throw badRequest('NOT_REFUNDABLE', 'Only a completed payment can be refunded.');
    }

    payment.status = 'refund_requested';
    payment.refundReason = req.body.reason;
    payment.refundRequestedAt = new Date();
    await payment.save();

    await Booking.updateOne({ _id: payment.booking }, { paymentStatus: 'refund_requested' });

    await audit.record({
      actorType: 'user', actor: req.user._id,
      action: 'payment.refund_requested', resource: 'Payment', resourceId: payment._id,
      newValue: { reason: req.body.reason }, req,
    });

    res.json({ success: true, data: { payment: dto.paymentSummary(payment) } });
  } catch (err) { next(err); }
});

module.exports = router;
