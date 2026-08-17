const express = require('express');
const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const bookingService = require('../services/booking');
const dispatch = require('../services/dispatch');
const audit = require('../services/audit');
const dto = require('../dto');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const S = require('../validators/schemas');
const { bookingLimiter } = require('../middleware/rateLimiters');
const { STATUS, cancellationPolicy } = require('../constants/bookingStates');
const { notFound, badRequest } = require('../utils/errors');
const { emitToBooking } = require('../socket');

const router = express.Router();

router.use(protect);

// ------------------------------------------------------------ create booking

/**
 * PHASE 9/10/30.
 *
 * Note what this handler does NOT read from req.body: fare, distance, amount,
 * status, driver, paymentStatus. The validator rejects them outright and the
 * fare is computed from coordinates by the pricing service.
 */
router.post('/', bookingLimiter, validate({ body: S.createBookingBody }), async (req, res, next) => {
  try {
    const idempotencyKey = req.get('idempotency-key') || null;

    // PHASE 30 — a replayed request returns the original booking.
    if (idempotencyKey) {
      const existing = await Booking.findOne({ user: req.user._id, idempotencyKey });
      if (existing) {
        return res.status(200).json({
          success: true,
          data: { booking: dto.bookingForCustomer(existing) },
          idempotentReplay: true,
        });
      }
    }

    if (new Date(req.body.scheduledFor).getTime() < Date.now() - 5 * 60 * 1000) {
      throw badRequest('SCHEDULE_IN_PAST', 'Pick a pickup time in the future.');
    }

    const priced = await bookingService.priceTrip(req.body);

    let booking;
    try {
      booking = await Booking.create({
        bookingId: bookingService.generateBookingId(),
        user: req.user._id,
        pickup: req.body.pickup,
        drop: req.body.drop,
        pickupCoords: req.body.pickupCoords,
        dropCoords: req.body.dropCoords,
        scheduledFor: req.body.scheduledFor,
        carType: req.body.carType,
        tripType: req.body.tripType,
        passengerCount: req.body.passengerCount,
        notes: req.body.notes,
        ...priced,
        status: STATUS.PENDING,
        paymentStatus: 'unpaid',
        statusHistory: [{ to: STATUS.PENDING, actorType: 'customer', actorId: req.user._id }],
        idempotencyKey,
      });
    } catch (err) {
      // Unique index on (user, idempotencyKey) lost a race — return the winner.
      if (err.code === 11000 && idempotencyKey) {
        const existing = await Booking.findOne({ user: req.user._id, idempotencyKey });
        if (existing) {
          return res.status(200).json({
            success: true,
            data: { booking: dto.bookingForCustomer(existing) },
            idempotentReplay: true,
          });
        }
      }
      throw err;
    }

    await audit.record({
      actorType: 'user', actor: req.user._id,
      action: 'booking.create', resource: 'Booking', resourceId: booking.bookingId,
      newValue: { fare: booking.fare, distanceKm: booking.distanceKm, carType: booking.carType },
      req,
    });

    res.status(201).json({ success: true, data: { booking: dto.bookingForCustomer(booking) } });
  } catch (err) { next(err); }
});

// --------------------------------------------------------------- list mine

router.get('/', validate({ query: S.bookingListQuery }), async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const skip = (page - 1) * limit;

    // A customer's list is always scoped to themselves. Admins use /api/admin.
    const filter = { user: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = req.query.from;
      if (req.query.to) filter.createdAt.$lte = req.query.to;
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate('driver').populate('payment'),
      Booking.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        bookings: bookings.map(dto.bookingForCustomer),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------- get one mine

router.get('/:id', validate({ params: S.idParam }), async (req, res, next) => {
  try {
    const scope = req.user.role === 'admin' ? {} : { user: req.user._id };
    const booking = await bookingService.findScoped(req.params.id, scope);
    if (!booking) throw notFound('BOOKING_NOT_FOUND', 'We could not find that booking.');

    await booking.populate('driver');
    await booking.populate('payment');

    const payload = req.user.role === 'admin'
      ? dto.bookingForAdmin(booking)
      : dto.bookingForCustomer(booking);

    res.json({ success: true, data: { booking: payload } });
  } catch (err) { next(err); }
});

// ------------------------------------------------------- request dispatch

/**
 * Moves a paid booking into dispatch. Only the owner can trigger it, and only
 * when payment has actually been verified — `paymentStatus` is written by the
 * payment layer after signature verification, never by the client.
 */
router.post('/:id/dispatch', validate({ params: S.idParam }), async (req, res, next) => {
  try {
    const booking = await bookingService.findScoped(req.params.id, { user: req.user._id });
    if (!booking) throw notFound('BOOKING_NOT_FOUND', 'We could not find that booking.');

    if (booking.paymentStatus !== 'paid') {
      throw badRequest('PAYMENT_REQUIRED', 'Complete payment before we assign a driver.');
    }

    const updated = await bookingService.transitionAtomic(
      booking._id, booking.status, STATUS.DISPATCHING,
      { actorType: 'customer', actorId: req.user._id }
    );

    const result = await dispatch.dispatchBooking(updated);
    res.json({
      success: true,
      data: {
        booking: dto.bookingForCustomer(updated),
        driversNotified: result.notified,
      },
    });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------------ cancel

router.delete('/:id', validate({ params: S.idParam, body: S.cancelBookingBody }), async (req, res, next) => {
  try {
    const booking = await bookingService.findScoped(req.params.id, { user: req.user._id });
    if (!booking) throw notFound('BOOKING_NOT_FOUND', 'We could not find that booking.');

    const policy = cancellationPolicy(booking.status);
    if (!policy.allowed) {
      throw badRequest('CANCELLATION_NOT_ALLOWED', policy.reason);
    }

    const fee = Math.round((booking.fare * policy.feePercent) / 100);

    const updated = await bookingService.transitionAtomic(
      booking._id, booking.status, STATUS.CANCELLED,
      {
        actorType: 'customer',
        actorId: req.user._id,
        reason: req.body.reason,
        extraSet: {
          cancelledAt: new Date(),
          cancelledBy: 'customer',
          cancellationReason: req.body.reason,
          cancellationFee: fee,
          ...(booking.paymentStatus === 'paid' ? { paymentStatus: 'refund_requested' } : {}),
        },
      }
    );

    // Free the driver if one was already holding this ride.
    if (booking.driver) {
      await Driver.updateOne(
        { _id: booking.driver, availability: { $in: ['busy', 'on_trip'] } },
        { availability: 'online' }
      );
    }

    await audit.record({
      actorType: 'user', actor: req.user._id,
      action: 'booking.cancel', resource: 'Booking', resourceId: booking.bookingId,
      oldValue: { status: booking.status }, newValue: { status: STATUS.CANCELLED, fee },
      req,
    });

    emitToBooking(booking.bookingId, 'bookingStatus', {
      bookingId: booking.bookingId,
      status: STATUS.CANCELLED,
    });

    res.json({
      success: true,
      data: {
        booking: dto.bookingForCustomer(updated),
        cancellationFee: fee,
        policy: policy.reason,
        refundDue: booking.paymentStatus === 'paid' ? Math.max(0, booking.fare - fee) : 0,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
