const express = require('express');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const dto = require('../dto');
const { protectDriver, requireApprovedDriver } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const S = require('../validators/schemas');
const { locationLimiter } = require('../middleware/rateLimiters');
const { ACTIVE_RIDE_STATUSES } = require('../constants/bookingStates');
const { forbidden } = require('../utils/errors');
const { emitToBooking } = require('../socket');

const router = express.Router();

// -------------------------------------------------------------- public list

/**
 * PHASE 27. This endpoint used to be unauthenticated and returned full driver
 * documents — phone numbers, home addresses, photo paths and live GPS for
 * every driver in the fleet. It now returns a minimal marketing summary.
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = { approvalStatus: 'approved' };
    if (req.query.carType) filter.carType = req.query.carType;

    const drivers = await Driver.find(filter)
      .select('name carType rating ratingCount')
      .sort({ rating: -1 })
      .limit(20);

    res.json({ success: true, data: { drivers: drivers.map(dto.driverPublicSummary) } });
  } catch (err) { next(err); }
});

// ------------------------------------------------------- driver's own location

/**
 * PHASE 16/17/18.
 *
 * The old route was `PUT /api/drivers/:id/location` with NO authentication
 * middleware at all. Anyone could set any driver's coordinates and, by passing
 * a bookingId, broadcast a fake position into that booking's tracking room.
 *
 * The id is now taken from the authenticated session, so the parameter that
 * made impersonation possible no longer exists.
 */
router.put(
  '/me/location',
  protectDriver,
  requireApprovedDriver,
  locationLimiter,
  validate({ body: S.driverLocationBody }),
  async (req, res, next) => {
    try {
      const { lat, lng, accuracy, heading, speed } = req.body;

      req.driver.currentLocation = { type: 'Point', coordinates: [lng, lat] };
      req.driver.locationAccuracy = accuracy;
      req.driver.locationHeading = heading;
      req.driver.locationSpeed = speed;
      req.driver.locationUpdatedAt = new Date();
      await req.driver.save();

      // Position is only broadcast to bookings this driver is actually
      // assigned to — the driver cannot name the room.
      const activeRides = await Booking.find({
        driver: req.driver._id,
        status: { $in: ACTIVE_RIDE_STATUSES },
      }).select('bookingId');

      for (const ride of activeRides) {
        emitToBooking(ride.bookingId, 'driverLocation', {
          bookingId: ride.bookingId,
          lat, lng, heading, speed, accuracy,
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        data: { updatedAt: req.driver.locationUpdatedAt, broadcastTo: activeRides.length },
      });
    } catch (err) { next(err); }
  }
);

// ---------------------------------------------------------- availability

router.put(
  '/me/availability',
  protectDriver,
  requireApprovedDriver,
  validate({ body: S.driverAvailabilityBody }),
  async (req, res, next) => {
    try {
      // PHASE 20 — a driver on an active trip cannot flip themselves available.
      const activeRide = await Booking.findOne({
        driver: req.driver._id,
        status: { $in: ACTIVE_RIDE_STATUSES },
      });
      if (activeRide) {
        throw forbidden(
          'DRIVER_ON_TRIP',
          'You are on an active trip. Complete it before changing availability.'
        );
      }
      if (req.body.availability === 'online' && !req.driver.currentLocation?.coordinates?.length) {
        throw forbidden(
          'LOCATION_REQUIRED',
          'Share your location before going online so we can match you to nearby rides.'
        );
      }

      req.driver.availability = req.body.availability;
      await req.driver.save();

      res.json({ success: true, data: { availability: req.driver.availability } });
    } catch (err) { next(err); }
  }
);

module.exports = router;
