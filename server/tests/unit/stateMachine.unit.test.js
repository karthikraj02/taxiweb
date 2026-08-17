const {
  STATUS, canTransition, assertTransition, cancellationPolicy, TERMINAL, ALL_STATUSES,
} = require('../../constants/bookingStates');

describe('Booking state machine', () => {
  it('permits the normal happy path end to end', () => {
    const path = [
      STATUS.PENDING, STATUS.PAYMENT_PENDING, STATUS.CONFIRMED, STATUS.DISPATCHING,
      STATUS.DRIVER_ASSIGNED, STATUS.DRIVER_EN_ROUTE, STATUS.DRIVER_ARRIVED,
      STATUS.IN_PROGRESS, STATUS.COMPLETED,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it('blocks the specific illegal jumps called out in the brief', () => {
    expect(canTransition(STATUS.PENDING, STATUS.COMPLETED)).toBe(false);
    expect(canTransition(STATUS.COMPLETED, STATUS.IN_PROGRESS)).toBe(false);
    expect(canTransition(STATUS.CANCELLED, STATUS.DRIVER_ASSIGNED)).toBe(false);
  });

  it('treats completed, cancelled and expired as terminal', () => {
    for (const terminal of TERMINAL) {
      for (const target of ALL_STATUSES) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it('never lets a booking skip payment on the way to confirmed', () => {
    expect(canTransition(STATUS.PENDING, STATUS.CONFIRMED)).toBe(false);
    expect(canTransition(STATUS.PENDING, STATUS.DRIVER_ASSIGNED)).toBe(false);
  });

  it('throws a typed error on an illegal transition', () => {
    expect(() => assertTransition(STATUS.PENDING, STATUS.COMPLETED))
      .toThrow(expect.objectContaining({ code: 'ILLEGAL_STATUS_TRANSITION', statusCode: 400 }));
  });

  it('rejects unknown status strings from either side', () => {
    expect(canTransition('banana', STATUS.COMPLETED)).toBe(false);
    expect(canTransition(STATUS.PENDING, 'banana')).toBe(false);
    expect(canTransition(undefined, undefined)).toBe(false);
  });

  describe('cancellation policy', () => {
    it('is free before a driver is assigned', () => {
      expect(cancellationPolicy(STATUS.CONFIRMED)).toMatchObject({ allowed: true, feePercent: 0 });
      expect(cancellationPolicy(STATUS.DISPATCHING)).toMatchObject({ allowed: true, feePercent: 0 });
    });

    it('charges progressively more the further along the ride is', () => {
      const assigned = cancellationPolicy(STATUS.DRIVER_ASSIGNED).feePercent;
      const enRoute = cancellationPolicy(STATUS.DRIVER_EN_ROUTE).feePercent;
      const arrived = cancellationPolicy(STATUS.DRIVER_ARRIVED).feePercent;
      expect(assigned).toBeLessThan(enRoute);
      expect(enRoute).toBeLessThan(arrived);
    });

    it('refuses cancellation once the trip is under way or finished', () => {
      expect(cancellationPolicy(STATUS.IN_PROGRESS).allowed).toBe(false);
      expect(cancellationPolicy(STATUS.COMPLETED).allowed).toBe(false);
      expect(cancellationPolicy(STATUS.CANCELLED).allowed).toBe(false);
    });
  });
});
