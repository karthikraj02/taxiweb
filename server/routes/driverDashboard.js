const express = require('express');
const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const dispatch = require('../services/dispatch');
const bookingService = require('../services/booking');
const audit = require('../services/audit');
const dto = require('../dto');
const { protectDriver, requireApprovedDriver } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const S = require('../validators/schemas');
const { STATUS, ACTIVE_RIDE_STATUSES } = require('../constants/bookingStates');
const { notFound } = require('../utils/errors');
const { emitToBooking } = require('../socket');

const router = express.Router();

router.use(protectDriver);

/** Registration status is readable before approval; everything else is gated. */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      approvalStatus: req.driver.approvalStatus,
      isEmailVerified: req.driver.isEmailVerified,
      canAcceptRides: req.driver.isActive(),
      documentCount: req.driver.documents?.length || 0,
      availability: req.driver.availability,
    },
  });
});

router.use(requireApprovedDriver);

// --------------------------------------------------------- ride requests

/**
 * PHASE 19/27.
 *
 * The old endpoint returned every pending booking in the system, populated
 * with the customer's name, phone and email, to any "verified" driver. This
 * one returns only geographically relevant offers, matched to the driver's
 * vehicle class, and withholds customer contact details until the driver has
 * actually been assigned.
 */
router.get('/requests', async (req, res, next) => {
  try {
    if (req.driver.availability !== 'online') {
      return res.json({ success: true, data: { requests: [], reason: 'You are offline.' } });
    }
    if (!req.driver.currentLocation?.coordinates?.length) {
      return res.json({ success: true, data: { requests: [], reason: 'Share your location to see nearby rides.' } });
    }

    const env = require('../config/env');
    const requests = await Booking.find({
      status: { $in: [STATUS.DISPATCHING, STATUS.CONFIRMED] },
      driver: null,
      carType: req.driver.carType,
      paymentStatus: 'paid',
      pickupCoords: { $exists: true },
    })
      .sort({ createdAt: -1 })
      .limit(20);

    // Geo filter in application space: pickupCoords is an embedded lat/lng doc
    // rather than a GeoJSON field, so $near is not available on Booking.
    const { haversineKm } = require('../services/routing');
    const origin = {
      lng: req.driver.currentLocation.coordinates[0],
      lat: req.driver.currentLocation.coordinates[1],
    };
    const radiusKm = env.dispatch.searchRadiusMeters / 1000;

    const nearby = requests
      .map(b => ({ booking: b, distanceKm: haversineKm(origin, b.pickupCoords) }))
      .filter(x => x.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({
      success: true,
      data: {
        requests: nearby.map(x => ({
          ...dto.bookingForDriverRequest(x.booking),
          distanceToPickupKm: Number(x.distanceKm.toFixed(1)),
        })),
      },
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------- accept

/** PHASE 21 — atomic claim; see services/dispatch.acceptBooking. */
router.post('/requests/:id/accept', validate({ params: S.idParam }), async (req, res, next) => {
  try {
    const booking = await dispatch.acceptBooking(req.params.id, req.driver);
    await booking.populate('user', 'name phone');

    await audit.record({
      actorType: 'driver', actor: req.driver._id,
      action: 'booking.accept', resource: 'Booking', resourceId: booking.bookingId, req,
    });

    emitToBooking(booking.bookingId, 'bookingStatus', {
      bookingId: booking.bookingId,
      status: STATUS.DRIVER_ASSIGNED,
      driver: dto.driverForCustomer(req.driver),
    });

    res.json({ success: true, data: { booking: dto.bookingForAssignedDriver(booking) } });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------- decline

/**
 * Declining is per-driver and does not mutate the booking. The old
 * implementation reset `status` to pending and cleared `driver` on a filter
 * that matched ANY pending booking, so a driver could detach another driver's
 * assigned ride.
 */
router.post('/requests/:id/decline', validate({ params: S.idParam }), async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Offer declined.' });
  } catch (err) { next(err); }
});

// ----------------------------------------------------------- ride lifecycle

const ACTION_TO_STATUS = {
  en_route: STATUS.DRIVER_EN_ROUTE,
  arrived: STATUS.DRIVER_ARRIVED,
  start: STATUS.IN_PROGRESS,
  complete: STATUS.COMPLETED,
};

router.post(
  '/rides/:id/advance',
  validate({ params: S.idParam, body: S.driverRideActionBody }),
  async (req, res, next) => {
    try {
      // Scoped to this driver: a driver cannot advance a ride that is not theirs.
      const booking = await bookingService.findScoped(req.params.id, { driver: req.driver._id });
      if (!booking) throw notFound('BOOKING_NOT_FOUND', 'We could not find that ride.');

      const target = ACTION_TO_STATUS[req.body.action];
      const extraSet = {};
      if (target === STATUS.IN_PROGRESS) extraSet.startedAt = new Date();
      if (target === STATUS.COMPLETED) extraSet.completedAt = new Date();

      // transitionAtomic validates legality AND guards against a concurrent change.
      const updated = await bookingService.transitionAtomic(
        booking._id, booking.status, target,
        { actorType: 'driver', actorId: req.driver._id, extraSet }
      );

      if (target === STATUS.COMPLETED) {
        // PHASE 20 — free the driver.
        await Driver.updateOne(
          { _id: req.driver._id, availability: 'on_trip' },
          { availability: 'online' }
        );
      }

      await audit.record({
        actorType: 'driver', actor: req.driver._id,
        action: `booking.${req.body.action}`, resource: 'Booking', resourceId: booking.bookingId,
        oldValue: { status: booking.status }, newValue: { status: target }, req,
      });

      emitToBooking(booking.bookingId, 'bookingStatus', {
        bookingId: booking.bookingId,
        status: target,
      });

      res.json({ success: true, data: { booking: dto.bookingForAssignedDriver(updated) } });
    } catch (err) { next(err); }
  }
);

// ------------------------------------------------------------------- stats

router.get('/stats', async (req, res, next) => {
  try {
    const [totalRides, activeRide, earningsAgg] = await Promise.all([
      Booking.countDocuments({ driver: req.driver._id, status: STATUS.COMPLETED }),
      Booking.findOne({ driver: req.driver._id, status: { $in: ACTIVE_RIDE_STATUSES } })
        .sort({ createdAt: -1 }).populate('user', 'name phone'),
      Booking.aggregate([
        { $match: { driver: req.driver._id, status: STATUS.COMPLETED, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$fare' } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalRides,
        totalEarnings: earningsAgg[0]?.total || 0,
        rating: req.driver.rating,
        ratingCount: req.driver.ratingCount,
        availability: req.driver.availability,
        activeRide: activeRide ? dto.bookingForAssignedDriver(activeRide) : null,
      },
    });
  } catch (err) { next(err); }
});

router.get('/rides', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const filter = { driver: req.driver._id };

    const [rides, total] = await Promise.all([
      Booking.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Booking.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        rides: rides.map(dto.bookingForDriverRequest),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
