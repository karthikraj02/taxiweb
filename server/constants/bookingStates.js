/**
 * Booking state machine (PHASE 8).
 *
 * Every transition is validated server-side. The previous implementation let an
 * admin PUT any status onto any booking and let the Socket.IO simulator emit
 * `completed` for a booking that was still `pending` — the DB and the UI could
 * disagree completely. Legal transitions are now data, not convention.
 */

const STATUS = {
  PENDING: 'pending',
  PAYMENT_PENDING: 'payment_pending',
  PAYMENT_FAILED: 'payment_failed',
  CONFIRMED: 'confirmed',
  DISPATCHING: 'dispatching',
  DRIVER_ASSIGNED: 'driver_assigned',
  DRIVER_EN_ROUTE: 'driver_en_route',
  DRIVER_ARRIVED: 'driver_arrived',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

const ALL_STATUSES = Object.values(STATUS);

/** status -> array of statuses it may legally move to */
const TRANSITIONS = {
  [STATUS.PENDING]: [STATUS.PAYMENT_PENDING, STATUS.CANCELLED, STATUS.EXPIRED],
  [STATUS.PAYMENT_PENDING]: [STATUS.CONFIRMED, STATUS.PAYMENT_FAILED, STATUS.CANCELLED, STATUS.EXPIRED],
  [STATUS.PAYMENT_FAILED]: [STATUS.PAYMENT_PENDING, STATUS.CANCELLED, STATUS.EXPIRED],
  [STATUS.CONFIRMED]: [STATUS.DISPATCHING, STATUS.CANCELLED, STATUS.EXPIRED],
  [STATUS.DISPATCHING]: [STATUS.DRIVER_ASSIGNED, STATUS.CANCELLED, STATUS.EXPIRED],
  [STATUS.DRIVER_ASSIGNED]: [STATUS.DRIVER_EN_ROUTE, STATUS.DISPATCHING, STATUS.CANCELLED],
  [STATUS.DRIVER_EN_ROUTE]: [STATUS.DRIVER_ARRIVED, STATUS.CANCELLED],
  [STATUS.DRIVER_ARRIVED]: [STATUS.IN_PROGRESS, STATUS.CANCELLED],
  [STATUS.IN_PROGRESS]: [STATUS.COMPLETED],
  // Terminal
  [STATUS.COMPLETED]: [],
  [STATUS.CANCELLED]: [],
  [STATUS.EXPIRED]: [],
};

/** Statuses where a driver is actively working the ride. */
const ACTIVE_RIDE_STATUSES = [
  STATUS.DRIVER_ASSIGNED,
  STATUS.DRIVER_EN_ROUTE,
  STATUS.DRIVER_ARRIVED,
  STATUS.IN_PROGRESS,
];

/** Statuses from which a customer may still cancel (PHASE 42). */
const CUSTOMER_CANCELLABLE = [
  STATUS.PENDING,
  STATUS.PAYMENT_PENDING,
  STATUS.PAYMENT_FAILED,
  STATUS.CONFIRMED,
  STATUS.DISPATCHING,
  STATUS.DRIVER_ASSIGNED,
  STATUS.DRIVER_EN_ROUTE,
  STATUS.DRIVER_ARRIVED,
];

const TERMINAL = [STATUS.COMPLETED, STATUS.CANCELLED, STATUS.EXPIRED];

function canTransition(from, to) {
  if (!ALL_STATUSES.includes(from) || !ALL_STATUSES.includes(to)) return false;
  return (TRANSITIONS[from] || []).includes(to);
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    const { badRequest } = require('../utils/errors');
    throw badRequest(
      'ILLEGAL_STATUS_TRANSITION',
      `Cannot move a booking from "${from}" to "${to}"`,
      { from, to, allowed: TRANSITIONS[from] || [] }
    );
  }
}

/**
 * Cancellation policy (PHASE 42). Percentages are of the fare.
 * Returned as a decision object so the caller can apply it to a refund.
 */
function cancellationPolicy(status) {
  switch (status) {
    case STATUS.PENDING:
    case STATUS.PAYMENT_PENDING:
    case STATUS.PAYMENT_FAILED:
      return { allowed: true, feePercent: 0, reason: 'No charge before payment.' };
    case STATUS.CONFIRMED:
    case STATUS.DISPATCHING:
      return { allowed: true, feePercent: 0, reason: 'Free cancellation before a driver is assigned.' };
    case STATUS.DRIVER_ASSIGNED:
      return { allowed: true, feePercent: 10, reason: 'A driver has been assigned; a 10% fee applies.' };
    case STATUS.DRIVER_EN_ROUTE:
      return { allowed: true, feePercent: 15, reason: 'The driver is en route; a 15% fee applies.' };
    case STATUS.DRIVER_ARRIVED:
      return { allowed: true, feePercent: 25, reason: 'The driver has arrived; a 25% fee applies.' };
    default:
      return { allowed: false, feePercent: 0, reason: 'This booking can no longer be cancelled.' };
  }
}

module.exports = {
  STATUS,
  ALL_STATUSES,
  TRANSITIONS,
  ACTIVE_RIDE_STATUSES,
  CUSTOMER_CANCELLABLE,
  TERMINAL,
  canTransition,
  assertTransition,
  cancellationPolicy,
};
