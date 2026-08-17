/**
 * Explicit response shapes (PHASE 27).
 *
 * The old API returned whole Mongoose documents. `GET /api/drivers` was public
 * and returned every driver's phone, home address, photo paths and live GPS.
 * Nothing is serialised now except through one of these functions, and each
 * one is an allow-list: adding a field to a schema does not silently publish it.
 */

function publicUser(user) {
  if (!user) return null;
  return {
    id: user._id,
    name: user.name,
    email: user.email || null,
    phone: user.phone || null,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}

/** What a customer may see about the driver on their own active booking. */
function driverForCustomer(driver) {
  if (!driver) return null;
  return {
    id: driver._id,
    name: driver.name,
    // Contact number is intentionally included: the customer needs to reach
    // the driver for the ride they have booked. It is NOT exposed anywhere else.
    phone: driver.phone,
    carType: driver.carType,
    carNumber: driver.carNumber,
    rating: driver.rating,
    ratingCount: driver.ratingCount,
  };
}

/** Fleet listing for anonymous visitors — no PII, no live location. */
function driverPublicSummary(driver) {
  if (!driver) return null;
  return {
    id: driver._id,
    name: driver.name?.split(' ')[0] || 'Driver',   // first name only
    carType: driver.carType,
    rating: driver.rating,
    ratingCount: driver.ratingCount,
  };
}

/** Full driver record for admin screens. Still excludes OTP material. */
function driverForAdmin(driver) {
  if (!driver) return null;
  return {
    id: driver._id,
    name: driver.name,
    email: driver.email,
    phone: driver.phone,
    address: driver.address,
    carType: driver.carType,
    carNumber: driver.carNumber,
    licenseNumber: driver.licenseNumber,
    isEmailVerified: driver.isEmailVerified,
    approvalStatus: driver.approvalStatus,
    approvedAt: driver.approvedAt,
    rejectionReason: driver.rejectionReason,
    availability: driver.availability,
    rating: driver.rating,
    ratingCount: driver.ratingCount,
    documents: (driver.documents || []).map(d => ({
      id: d._id,
      type: d.type,
      status: d.status,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      uploadedAt: d.uploadedAt,
      rejectionReason: d.rejectionReason,
    })),
    locationUpdatedAt: driver.locationUpdatedAt,
    createdAt: driver.createdAt,
  };
}

/** A driver's own profile. */
function driverSelf(driver) {
  if (!driver) return null;
  return {
    ...driverForAdmin(driver),
    currentLocation: driver.currentLocation?.coordinates
      ? { lng: driver.currentLocation.coordinates[0], lat: driver.currentLocation.coordinates[1] }
      : null,
  };
}

function paymentSummary(payment) {
  if (!payment) return null;
  return {
    id: payment._id,
    status: payment.status,
    amount: payment.amountPaise / 100,
    currency: payment.currency,
    receipt: payment.receipt,
    paidAt: payment.paidAt,
    refundAmount: payment.refundAmountPaise ? payment.refundAmountPaise / 100 : 0,
    refundedAt: payment.refundedAt,
    isDemo: payment.isDemo || false,
    // razorpayOrderId is included because the checkout widget needs it;
    // razorpaySignature is never returned.
    razorpayOrderId: payment.razorpayOrderId,
  };
}

function bookingForCustomer(booking) {
  if (!booking) return null;
  const driver = booking.driver && typeof booking.driver === 'object' ? booking.driver : null;
  const payment = booking.payment && typeof booking.payment === 'object' ? booking.payment : null;
  return {
    id: booking._id,
    bookingId: booking.bookingId,
    pickup: booking.pickup,
    drop: booking.drop,
    pickupCoords: booking.pickupCoords,
    dropCoords: booking.dropCoords,
    scheduledFor: booking.scheduledFor,
    carType: booking.carType,
    tripType: booking.tripType,
    passengerCount: booking.passengerCount,
    distanceKm: booking.distanceKm,
    durationMinutes: booking.durationMinutes,
    distanceEstimated: booking.distanceEstimated,
    fare: booking.fare,
    currency: booking.currency,
    fareBreakdown: booking.fareBreakdown,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    // Driver details are only released once a driver is actually assigned.
    driver: driver ? driverForCustomer(driver) : null,
    payment: payment ? paymentSummary(payment) : null,
    cancellationFee: booking.cancellationFee,
    cancelledAt: booking.cancelledAt,
    startedAt: booking.startedAt,
    completedAt: booking.completedAt,
    createdAt: booking.createdAt,
  };
}

/**
 * What a driver sees about a ride request BEFORE accepting: enough to decide,
 * without handing every registered driver the customer's phone number.
 */
function bookingForDriverRequest(booking) {
  if (!booking) return null;
  return {
    id: booking._id,
    bookingId: booking.bookingId,
    pickup: booking.pickup,
    drop: booking.drop,
    pickupCoords: booking.pickupCoords,
    scheduledFor: booking.scheduledFor,
    carType: booking.carType,
    tripType: booking.tripType,
    passengerCount: booking.passengerCount,
    distanceKm: booking.distanceKm,
    durationMinutes: booking.durationMinutes,
    fare: booking.fare,
    currency: booking.currency,
    status: booking.status,
    createdAt: booking.createdAt,
  };
}

/** After acceptance the assigned driver needs to contact the customer. */
function bookingForAssignedDriver(booking) {
  if (!booking) return null;
  const customer = booking.user && typeof booking.user === 'object' ? booking.user : null;
  return {
    ...bookingForDriverRequest(booking),
    dropCoords: booking.dropCoords,
    notes: booking.notes,
    paymentStatus: booking.paymentStatus,
    customer: customer ? { name: customer.name, phone: customer.phone } : null,
  };
}

function bookingForAdmin(booking) {
  if (!booking) return null;
  const customer = booking.user && typeof booking.user === 'object' ? booking.user : null;
  const driver = booking.driver && typeof booking.driver === 'object' ? booking.driver : null;
  return {
    ...bookingForCustomer(booking),
    customer: customer ? publicUser(customer) : booking.user,
    driver: driver ? driverForAdmin(driver) : null,
    statusHistory: booking.statusHistory,
    cancelledBy: booking.cancelledBy,
    cancellationReason: booking.cancellationReason,
  };
}

function message(msg) {
  if (!msg) return null;
  return {
    id: msg._id,
    bookingId: msg.bookingId,
    senderType: msg.senderType,
    senderName: msg.senderName,
    body: msg.body,
    clientMessageId: msg.clientMessageId,
    createdAt: msg.createdAt,
    readAt: msg.readAt,
  };
}

function review(r) {
  if (!r) return null;
  const user = r.user && typeof r.user === 'object' ? r.user : null;
  return {
    id: r._id,
    rating: r.rating,
    comment: r.comment,
    // Reviews are public, so the reviewer is shown as "Firstname L."
    author: user ? abbreviateName(user.name) : 'Verified customer',
    createdAt: r.createdAt,
  };
}

function abbreviateName(name = '') {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

module.exports = {
  publicUser,
  driverForCustomer,
  driverPublicSummary,
  driverForAdmin,
  driverSelf,
  paymentSummary,
  bookingForCustomer,
  bookingForDriverRequest,
  bookingForAssignedDriver,
  bookingForAdmin,
  message,
  review,
};
