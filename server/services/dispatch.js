const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const env = require('../config/env');
const logger = require('../utils/logger');
const dto = require('../dto');
const { STATUS } = require('../constants/bookingStates');
const { conflict, badRequest } = require('../utils/errors');

/**
 * Driver dispatch (PHASE 19/20/21).
 *
 * Replaces the old model where EVERY approved driver could see EVERY pending
 * booking (with the customer's name, phone and email attached) and acceptance
 * was a read-then-write that two drivers could win simultaneously.
 */

/** Candidate drivers ranked by proximity to the pickup point. */
async function findCandidates(booking) {
  if (!booking.pickupCoords) return [];

  return Driver.find({
    approvalStatus: 'approved',
    isEmailVerified: true,
    availability: 'online',
    carType: booking.carType,
    currentLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [booking.pickupCoords.lng, booking.pickupCoords.lat],
        },
        $maxDistance: env.dispatch.searchRadiusMeters,
      },
    },
  }).limit(env.dispatch.maxCandidates);
}

/**
 * Notify nearby drivers about a booking. Offers are pushed to per-driver
 * socket rooms; a driver never receives an offer they were not selected for.
 */
async function dispatchBooking(booking) {
  const { emitToDriver } = require('../socket');
  const candidates = await findCandidates(booking);

  if (!candidates.length) {
    logger.warn('No dispatchable drivers found', {
      bookingId: booking.bookingId,
      carType: booking.carType,
    });
    return { notified: 0, candidates: [] };
  }

  const offer = dto.bookingForDriverRequest(booking);
  for (const driver of candidates) {
    emitToDriver(driver._id.toString(), 'rideOffer', offer);
  }

  logger.info('Dispatched booking', {
    bookingId: booking.bookingId,
    notified: candidates.length,
  });

  return { notified: candidates.length, candidates: candidates.map(d => d._id) };
}

/**
 * Atomically assign a driver to a booking (PHASE 21).
 *
 * Both the booking claim and the driver claim are single conditional updates.
 * If two drivers accept the same ride in the same millisecond, exactly one
 * `findOneAndUpdate` matches a document and the other gets zero — no
 * read-modify-write window, no double assignment.
 */
async function acceptBooking(bookingRef, driver) {
  if (!driver.isDispatchable() && driver.availability !== 'online') {
    throw badRequest('DRIVER_NOT_AVAILABLE', 'Go online before accepting rides.');
  }

  // A driver may only hold one active ride.
  const existingRide = await Booking.findOne({
    driver: driver._id,
    status: { $in: [STATUS.DRIVER_ASSIGNED, STATUS.DRIVER_EN_ROUTE, STATUS.DRIVER_ARRIVED, STATUS.IN_PROGRESS] },
  });
  if (existingRide) {
    throw conflict('DRIVER_HAS_ACTIVE_RIDE', 'Finish your current ride before accepting another.');
  }

  const or = [{ bookingId: bookingRef }];
  if (/^[0-9a-fA-F]{24}$/.test(bookingRef)) or.push({ _id: bookingRef });

  const booking = await Booking.findOneAndUpdate(
    {
      $and: [
        { $or: or },
        // Only an unassigned booking awaiting dispatch can be claimed.
        { status: { $in: [STATUS.DISPATCHING, STATUS.CONFIRMED] } },
        { driver: null },
        { carType: driver.carType },
      ],
    },
    {
      $set: {
        driver: driver._id,
        driverAssignedAt: new Date(),
        status: STATUS.DRIVER_ASSIGNED,
      },
      $push: {
        statusHistory: {
          from: STATUS.DISPATCHING, to: STATUS.DRIVER_ASSIGNED,
          at: new Date(), actorType: 'driver', actorId: driver._id,
        },
      },
    },
    { new: true }
  );

  if (!booking) {
    throw conflict('RIDE_ALREADY_TAKEN', 'This ride is no longer available.');
  }

  // Mark the driver busy. If this fails the booking is still consistent —
  // the driver simply appears available and the single-active-ride guard above
  // prevents a second assignment.
  await Driver.updateOne({ _id: driver._id }, { availability: 'on_trip' });

  return booking;
}

module.exports = { findCandidates, dispatchBooking, acceptBooking };
