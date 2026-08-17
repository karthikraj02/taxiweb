const crypto = require('crypto');
const Booking = require('../models/Booking');
const pricing = require('./pricing');
const routing = require('./routing');
const { STATUS, assertTransition } = require('../constants/bookingStates');
const { badRequest, conflict } = require('../utils/errors');

/**
 * Booking domain logic.
 *
 * Centralising this is what makes "the server always calculates the fare"
 * enforceable: routes call `priceTrip`, they never do arithmetic themselves,
 * and there is no code path where a request body reaches `booking.fare`.
 */

/** Collision-resistant public reference. 6 chars from a 32-symbol alphabet. */
function generateBookingId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  let out = 'UDX-';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/**
 * Resolve route + fare from coordinates. The single source of truth for money.
 * Returns everything the caller must persist.
 */
async function priceTrip({ pickup, drop, pickupCoords, dropCoords, carType, tripType, scheduledFor, passengerCount }) {
  const vehicle = pricing.VEHICLES[carType];
  if (!vehicle) {
    throw badRequest('INVALID_VEHICLE_TYPE', `Unknown vehicle type "${carType}"`);
  }
  if (passengerCount && passengerCount > vehicle.capacity) {
    throw badRequest(
      'CAPACITY_EXCEEDED',
      `A ${vehicle.label} seats ${vehicle.capacity} passengers. Please choose a larger vehicle.`
    );
  }

  const route = await routing.resolveRoute(pickupCoords, dropCoords);
  const { total, currency, breakdown } = pricing.quote({
    carType,
    distanceKm: route.distanceKm,
    tripType,
    pickupAt: scheduledFor,
    pickup,
    drop,
  });

  return {
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    distanceProvider: route.provider,
    distanceEstimated: route.estimated,
    fare: total,
    currency,
    fareBreakdown: breakdown,
  };
}

/**
 * Locate a booking by _id or bookingId, scoped to an owner.
 *
 * The scope is applied inside the query, not checked afterwards, so there is
 * no window where an un-owned document is loaded and then conditionally
 * rejected. The original `GET /:id` did scope correctly, but `PUT /:id/status`
 * and the payment verify path did not.
 */
async function findScoped(ref, scope = {}) {
  const or = [{ bookingId: ref }];
  if (/^[0-9a-fA-F]{24}$/.test(ref)) or.push({ _id: ref });
  return Booking.findOne({ $and: [{ $or: or }, scope] });
}

/**
 * Apply a status transition atomically.
 *
 * The `status: expectedFrom` guard in the filter is the concurrency control:
 * if another request changed the status first, this update matches zero
 * documents and we surface a conflict rather than clobbering it.
 */
async function transitionAtomic(bookingId, expectedFrom, to, { actorType, actorId, reason, extraSet = {} } = {}) {
  assertTransition(expectedFrom, to);

  const updated = await Booking.findOneAndUpdate(
    { _id: bookingId, status: expectedFrom },
    {
      $set: { status: to, ...extraSet },
      $push: {
        statusHistory: { from: expectedFrom, to, at: new Date(), actorType, actorId, reason },
      },
    },
    { new: true }
  );

  if (!updated) {
    throw conflict(
      'BOOKING_STATE_CHANGED',
      'This booking was updated by someone else. Refresh and try again.'
    );
  }
  return updated;
}

module.exports = { generateBookingId, priceTrip, findScoped, transitionAtomic, STATUS };
