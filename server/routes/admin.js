const express = require('express');
const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const Payment = require('../models/Payment');
const ContactMessage = require('../models/ContactMessage');
const AuditLog = require('../models/AuditLog');
const razorpayService = require('../services/razorpay');
const bookingService = require('../services/booking');
const audit = require('../services/audit');
const dto = require('../dto');
const { protect, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const S = require('../validators/schemas');
const { STATUS, ACTIVE_RIDE_STATUSES } = require('../constants/bookingStates');
const { notFound, badRequest } = require('../utils/errors');
const { emitToBooking } = require('../socket');

const router = express.Router();

// PHASE 35 — every route below requires an authenticated admin.
router.use(protect, requireAdmin);

// ------------------------------------------------------------- dashboard

router.get('/stats', async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      totalBookings, todayBookings, activeRides, completed, cancelled,
      revenueAgg, approvedDrivers, availableDrivers, pendingApprovals,
      paymentFailures, refundsPending, newEnquiries,
    ] = await Promise.all([
      Booking.countDocuments({}),
      Booking.countDocuments({ createdAt: { $gte: startOfDay } }),
      Booking.countDocuments({ status: { $in: ACTIVE_RIDE_STATUSES } }),
      Booking.countDocuments({ status: STATUS.COMPLETED }),
      Booking.countDocuments({ status: STATUS.CANCELLED }),
      Payment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amountPaise' } } },
      ]),
      Driver.countDocuments({ approvalStatus: 'approved' }),
      Driver.countDocuments({ approvalStatus: 'approved', availability: 'online' }),
      Driver.countDocuments({ approvalStatus: 'pending_review' }),
      Payment.countDocuments({ status: 'failed' }),
      Payment.countDocuments({ status: { $in: ['refund_requested', 'refund_processing'] } }),
      ContactMessage.countDocuments({ status: 'new' }),
    ]);

    res.json({
      success: true,
      data: {
        bookings: { total: totalBookings, today: todayBookings, active: activeRides, completed, cancelled },
        revenue: { totalPaid: (revenueAgg[0]?.total || 0) / 100, currency: 'INR' },
        drivers: { approved: approvedDrivers, online: availableDrivers, pendingApprovals },
        payments: { failures: paymentFailures, refundsPending },
        support: { newEnquiries },
      },
    });
  } catch (err) { next(err); }
});

// --------------------------------------------------------------- bookings

router.get('/bookings', validate({ query: S.bookingListQuery }), async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = req.query.from;
      if (req.query.to) filter.createdAt.$lte = req.query.to;
    }
    if (req.query.search) {
      // Escaped so a search string cannot inject regex metacharacters and
      // turn a lookup into a ReDoS.
      const safe = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { bookingId: new RegExp(safe, 'i') },
        { pickup: new RegExp(safe, 'i') },
        { drop: new RegExp(safe, 'i') },
      ];
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('user', 'name email phone role createdAt')
        .populate('driver').populate('payment'),
      Booking.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        bookings: bookings.map(dto.bookingForAdmin),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) { next(err); }
});

/**
 * Admin status override.
 *
 * Still goes through the state machine. An admin has broad authority but not
 * the authority to put a booking into an incoherent state — the old route
 * accepted any status for any booking, so `pending -> completed` was one
 * request away.
 */
router.put('/bookings/:id/status', validate({ params: S.idParam, body: S.adminBookingStatusBody }), async (req, res, next) => {
  try {
    const booking = await bookingService.findScoped(req.params.id, {});
    if (!booking) throw notFound('BOOKING_NOT_FOUND', 'We could not find that booking.');

    const updated = await bookingService.transitionAtomic(
      booking._id, booking.status, req.body.status,
      { actorType: 'admin', actorId: req.user._id, reason: req.body.reason }
    );

    await audit.record({
      actorType: 'admin', actor: req.user._id, actorLabel: req.user.email,
      action: 'booking.admin_status_change', resource: 'Booking', resourceId: booking.bookingId,
      oldValue: { status: booking.status }, newValue: { status: req.body.status, reason: req.body.reason },
      req,
    });

    emitToBooking(booking.bookingId, 'bookingStatus', {
      bookingId: booking.bookingId, status: req.body.status,
    });

    res.json({ success: true, data: { booking: dto.bookingForAdmin(updated) } });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------- drivers

router.get('/drivers', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.approvalStatus) filter.approvalStatus = req.query.approvalStatus;
    const drivers = await Driver.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, data: { drivers: drivers.map(dto.driverForAdmin) } });
  } catch (err) { next(err); }
});

/** PHASE 15/36 — approval is an explicit, audited admin decision. */
router.put('/drivers/:id/approval', validate({ params: S.objectIdParam, body: S.driverApprovalBody }), async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) throw notFound('DRIVER_NOT_FOUND', 'We could not find that driver.');

    if (req.body.decision === 'approved') {
      if (!driver.isEmailVerified) {
        throw badRequest('EMAIL_NOT_VERIFIED', 'This driver has not verified their email address yet.');
      }
      if (!driver.documents?.length) {
        throw badRequest('NO_DOCUMENTS', 'This driver has not uploaded any documents.');
      }
      if (!driver.carType) {
        throw badRequest('NO_VEHICLE', 'This driver has no vehicle class recorded.');
      }
    }

    const previous = driver.approvalStatus;
    driver.approvalStatus = req.body.decision;
    driver.rejectionReason = req.body.decision === 'approved' ? undefined : req.body.reason;
    if (req.body.decision === 'approved') {
      driver.approvedAt = new Date();
      driver.approvedBy = req.user._id;
      driver.documents.forEach(d => { d.status = 'approved'; d.reviewedAt = new Date(); d.reviewedBy = req.user._id; });
    } else {
      // A suspended or rejected driver must not stay dispatchable.
      driver.availability = 'offline';
    }
    await driver.save();

    await audit.record({
      actorType: 'admin', actor: req.user._id, actorLabel: req.user.email,
      action: `driver.${req.body.decision}`, resource: 'Driver', resourceId: driver._id,
      oldValue: { approvalStatus: previous },
      newValue: { approvalStatus: req.body.decision, reason: req.body.reason },
      req,
    });

    res.json({ success: true, data: { driver: dto.driverForAdmin(driver) } });
  } catch (err) { next(err); }
});

// --------------------------------------------------------------- payments

router.get('/payments', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 }).limit(200)
      .populate('booking', 'bookingId').populate('user', 'name email');
    res.json({
      success: true,
      data: {
        payments: payments.map(p => ({
          ...dto.paymentSummary(p),
          bookingId: p.booking?.bookingId,
          customer: p.user ? { name: p.user.name, email: p.user.email } : null,
        })),
      },
    });
  } catch (err) { next(err); }
});

/** PHASE 14 — admin executes a refund through the gateway. */
router.post('/payments/:id/refund', validate({ params: S.objectIdParam, body: S.refundBody }), async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw notFound('PAYMENT_NOT_FOUND', 'We could not find that payment.');
    if (!['paid', 'refund_requested'].includes(payment.status)) {
      throw badRequest('NOT_REFUNDABLE', 'Only a completed payment can be refunded.');
    }
    if (!payment.razorpayPaymentId) {
      throw badRequest('NO_GATEWAY_PAYMENT', 'This payment has no gateway reference to refund.');
    }

    const amountPaise = req.body.amountPaise || payment.amountPaise;
    if (amountPaise > payment.amountPaise) {
      throw badRequest('REFUND_EXCEEDS_PAYMENT', 'A refund cannot exceed the amount paid.');
    }

    const refund = await razorpayService.createRefund(payment.razorpayPaymentId, amountPaise, {
      reason: req.body.reason,
      adminId: req.user._id.toString(),
    });

    payment.status = 'refund_processing';
    payment.refundId = refund.id;
    payment.refundAmountPaise = amountPaise;
    payment.refundReason = req.body.reason;
    await payment.save();

    await Booking.updateOne({ _id: payment.booking }, { paymentStatus: 'refund_processing' });

    await audit.record({
      actorType: 'admin', actor: req.user._id, actorLabel: req.user.email,
      action: 'payment.refund_initiated', resource: 'Payment', resourceId: payment._id,
      newValue: { amountPaise, reason: req.body.reason }, req,
    });

    res.json({ success: true, data: { payment: dto.paymentSummary(payment) } });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------- support

router.get('/contact-messages', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const messages = await ContactMessage.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, data: { messages } });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------- audit logs

router.get('/audit-logs', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.resource) filter.resource = req.query.resource;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) { next(err); }
});

module.exports = router;
