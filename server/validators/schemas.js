const { z } = require('zod');
const { VEHICLE_TYPES } = require('../services/pricing');
const { ALL_STATUSES } = require('../constants/bookingStates');

/**
 * Single validation system for the whole API (PHASE 28).
 *
 * Every schema uses `.strict()` where the shape is fixed, so unexpected keys
 * are rejected rather than silently ignored. That matters for mass-assignment:
 * the old `Driver.create(req.body)` would happily accept `approvalStatus`.
 */

// --- primitives ---------------------------------------------------------

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id');

// Accepts either a Mongo _id or a human booking reference like UDX-A1B2C3.
const bookingRef = z.string().trim().min(3).max(64)
  .regex(/^[A-Za-z0-9-]+$/, 'Not a valid booking reference');

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

// E.164, optionally with a leading +. Deliberately strict: this feeds an SMS API.
const phone = z.string().trim()
  .regex(/^\+?[1-9]\d{7,14}$/, 'Enter a valid phone number in international format');

const password = z.string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine(v => /[a-z]/.test(v), 'Password must contain a lowercase letter')
  .refine(v => /[A-Z]/.test(v), 'Password must contain an uppercase letter')
  .refine(v => /[0-9]/.test(v), 'Password must contain a number');

const otpCode = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code');

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

const coords = z.object({ lat: latitude, lng: longitude }).strict();

const carType = z.enum(VEHICLE_TYPES);
const tripType = z.enum(['one-way', 'round-trip']);

const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
}).partial().transform(v => ({ page: v.page ?? 1, limit: v.limit ?? 10 }));

// --- auth ---------------------------------------------------------------

const registerBody = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: email.optional(),
  phone: phone.optional(),
  password,
}).strict().refine(v => v.email || v.phone, {
  message: 'Provide an email address or a phone number',
  path: ['email'],
});

const loginBody = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
}).strict();

const requestOtpBody = z.object({ phone }).strict();
const verifyOtpBody = z.object({ phone, otp: otpCode }).strict();

const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
}).strict();

const forgotPasswordBody = z.object({ email }).strict();
const resetPasswordBody = z.object({
  email,
  otp: otpCode,
  newPassword: password,
}).strict();

// --- pricing / bookings -------------------------------------------------

const quoteBody = z.object({
  pickup: z.string().trim().min(2).max(300),
  drop: z.string().trim().min(2).max(300),
  pickupCoords: coords,
  dropCoords: coords,
  carType,
  tripType: tripType.default('one-way'),
  scheduledFor: z.coerce.date(),
  passengerCount: z.coerce.number().int().min(1).max(12).default(1),
}).strict();

/**
 * Note what is ABSENT: fare, distance, amount. Those are server-derived.
 * If a client sends them, .strict() rejects the request outright.
 */
const createBookingBody = quoteBody.extend({
  notes: z.string().trim().max(500).optional(),
}).strict();

const cancelBookingBody = z.object({
  reason: z.string().trim().max(300).optional(),
}).strict();

const adminBookingStatusBody = z.object({
  status: z.enum(ALL_STATUSES),
  reason: z.string().trim().max(300).optional(),
}).strict();

const bookingListQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(ALL_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().max(100).optional(),
}).strict();

// --- payments -----------------------------------------------------------

const createOrderBody = z.object({
  bookingId: bookingRef,
}).strict();

const verifyPaymentBody = z.object({
  razorpayOrderId: z.string().trim().min(5).max(100),
  razorpayPaymentId: z.string().trim().min(5).max(100),
  razorpaySignature: z.string().trim().min(10).max(200),
}).strict();

const refundBody = z.object({
  reason: z.string().trim().min(3).max(300),
  amountPaise: z.coerce.number().int().min(100).optional(),
}).strict();

// --- drivers ------------------------------------------------------------

const driverRegisterBody = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  phone,
  address: z.string().trim().max(300).optional(),
  carType: carType.optional(),
  carNumber: z.string().trim().min(4).max(20).optional(),
  licenseNumber: z.string().trim().min(4).max(30).optional(),
}).strict();

const driverRequestOtpBody = z.object({ email }).strict();
const driverVerifyOtpBody = z.object({ email, otp: otpCode }).strict();

const driverLocationBody = z.object({
  lat: latitude,
  lng: longitude,
  accuracy: z.coerce.number().min(0).max(10000).optional(),
  heading: z.coerce.number().min(0).max(360).optional(),
  speed: z.coerce.number().min(0).max(120).optional(),
  timestamp: z.coerce.date().optional(),
}).strict();

const driverAvailabilityBody = z.object({
  availability: z.enum(['offline', 'online']),
}).strict();

const driverApprovalBody = z.object({
  decision: z.enum(['approved', 'rejected', 'suspended']),
  reason: z.string().trim().max(300).optional(),
}).strict();

const driverRideActionBody = z.object({
  action: z.enum(['en_route', 'arrived', 'start', 'complete']),
}).strict();

// --- misc ---------------------------------------------------------------

const contactBody = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(100),
  email: email.optional().or(z.literal('')),
  phone: phone.optional().or(z.literal('')),
  message: z.string().trim().min(10, 'Please tell us a little more').max(2000),
}).strict();

const reviewBody = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
}).strict();

const idParam = z.object({ id: bookingRef }).strict();
const objectIdParam = z.object({ id: objectId }).strict();

module.exports = {
  objectId, bookingRef, email, phone, password, otpCode, coords, carType, tripType, pagination,
  registerBody, loginBody, requestOtpBody, verifyOtpBody,
  changePasswordBody, forgotPasswordBody, resetPasswordBody,
  quoteBody, createBookingBody, cancelBookingBody, adminBookingStatusBody, bookingListQuery,
  createOrderBody, verifyPaymentBody, refundBody,
  driverRegisterBody, driverRequestOtpBody, driverVerifyOtpBody,
  driverLocationBody, driverAvailabilityBody, driverApprovalBody, driverRideActionBody,
  contactBody, reviewBody, idParam, objectIdParam,
};
