const request = require('supertest');
const mongoose = require('mongoose');

// Requiring the app pulls in every model, which setup.js then indexes.
const createApp = require('../app');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const tokens = require('../services/tokens');
const { STATUS } = require('../constants/bookingStates');

const app = createApp();

const STRONG_PASSWORD = 'CorrectHorse7Battery';

/** Coordinates around Udupi, so haversine distances are realistic. */
const UDUPI = { lat: 13.3409, lng: 74.7421 };
const MANGALORE = { lat: 12.9141, lng: 74.8560 };

async function makeUser(overrides = {}) {
  const suffix = new mongoose.Types.ObjectId().toString().slice(-8);
  const user = new User({
    name: 'Test Customer',
    email: `user_${suffix}@example.com`,
    phone: `+9198${suffix.replace(/\D/g, '0').padEnd(8, '0').slice(0, 8)}`,
    password: STRONG_PASSWORD,
    isVerified: true,
    ...overrides,
  });
  await user.save();
  return user;
}

async function makeAdmin(overrides = {}) {
  return makeUser({ name: 'Admin', role: 'admin', ...overrides });
}

async function makeDriver(overrides = {}) {
  const suffix = new mongoose.Types.ObjectId().toString().slice(-8);
  const driver = new Driver({
    name: 'Test Driver',
    email: `driver_${suffix}@example.com`,
    phone: '+919800000001',
    carType: 'dzire',
    carNumber: 'KA20AB1234',
    isEmailVerified: true,
    approvalStatus: 'approved',
    availability: 'online',
    currentLocation: { type: 'Point', coordinates: [UDUPI.lng, UDUPI.lat] },
    locationUpdatedAt: new Date(),
    ...overrides,
  });
  await driver.save();
  return driver;
}

/** An access-token cookie for a subject, bypassing the login round trip. */
function authCookie(subjectType, subject) {
  const token = tokens.signAccessToken(subjectType, subject);
  const name = tokens.ACCESS_COOKIE[subjectType];
  return `${name}=${token}`;
}

const asUser = (user) => authCookie('user', user);
const asDriver = (driver) => authCookie('driver', driver);

/** A booking owned by `user`, defaulting to a payable pending state. */
async function makeBooking(user, overrides = {}) {
  const bookingService = require('../services/booking');
  return Booking.create({
    bookingId: bookingService.generateBookingId(),
    user: user._id,
    pickup: 'Udupi Bus Stand',
    drop: 'Mangalore Central',
    pickupCoords: UDUPI,
    dropCoords: MANGALORE,
    scheduledFor: new Date(Date.now() + 3600 * 1000),
    carType: 'dzire',
    tripType: 'one-way',
    passengerCount: 2,
    distanceKm: 60,
    durationMinutes: 90,
    fare: 1000,
    currency: 'INR',
    fareBreakdown: { total: 1000 },
    status: STATUS.PENDING,
    paymentStatus: 'unpaid',
    ...overrides,
  });
}

const validTripBody = (overrides = {}) => ({
  pickup: 'Udupi Bus Stand',
  drop: 'Mangalore Central',
  pickupCoords: UDUPI,
  dropCoords: MANGALORE,
  carType: 'dzire',
  tripType: 'one-way',
  scheduledFor: new Date(Date.now() + 3600 * 1000).toISOString(),
  passengerCount: 2,
  ...overrides,
});

module.exports = {
  app, request,
  makeUser, makeAdmin, makeDriver, makeBooking,
  asUser, asDriver, authCookie,
  validTripBody,
  STRONG_PASSWORD, UDUPI, MANGALORE,
  User, Driver, Booking, Payment,
};
