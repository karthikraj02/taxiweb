const S = require('../../validators/schemas');

const UDUPI = { lat: 13.3409, lng: 74.7421 };
const MANGALORE = { lat: 12.9141, lng: 74.8560 };
const validTrip = {
  pickup: 'Udupi Bus Stand',
  drop: 'Mangalore Central',
  pickupCoords: UDUPI,
  dropCoords: MANGALORE,
  carType: 'dzire',
  tripType: 'one-way',
  scheduledFor: new Date(Date.now() + 3600e3).toISOString(),
  passengerCount: 2,
};

describe('Request validation', () => {
  describe('NoSQL operator injection', () => {
    it('rejects a Mongo operator object in the login email', () => {
      expect(S.loginBody.safeParse({ email: { $ne: null }, password: 'x' }).success).toBe(false);
    });

    it('rejects an operator object in the password', () => {
      expect(S.loginBody.safeParse({
        email: 'a@b.com', password: { $gt: '' },
      }).success).toBe(false);
    });

    it('rejects an array smuggled in where a string is expected', () => {
      expect(S.loginBody.safeParse({ email: ['a@b.com'], password: 'x' }).success).toBe(false);
    });

    it('rejects operator objects in the OTP fields', () => {
      expect(S.verifyOtpBody.safeParse({ phone: '+919876543210', otp: { $ne: null } }).success).toBe(false);
    });
  });

  describe('mass assignment', () => {
    it('rejects a self-assigned role on registration', () => {
      const res = S.registerBody.safeParse({
        name: 'A B', email: 'a@b.com', password: 'CorrectHorse7Battery', role: 'admin',
      });
      expect(res.success).toBe(false);
    });

    it('rejects approvalStatus on driver registration', () => {
      const res = S.driverRegisterBody.safeParse({
        name: 'D E', email: 'd@e.com', phone: '+919876543210', approvalStatus: 'approved',
      });
      expect(res.success).toBe(false);
    });

    it('rejects isEmailVerified on driver registration', () => {
      const res = S.driverRegisterBody.safeParse({
        name: 'D E', email: 'd@e.com', phone: '+919876543210', isEmailVerified: true,
      });
      expect(res.success).toBe(false);
    });
  });

  describe('fare and distance are not client inputs', () => {
    it('accepts a well-formed trip with no money fields', () => {
      expect(S.createBookingBody.safeParse(validTrip).success).toBe(true);
    });

    it.each(['fare', 'distance', 'distanceKm', 'amount', 'total'])(
      'rejects a booking that tries to supply %s',
      (field) => {
        const res = S.createBookingBody.safeParse({ ...validTrip, [field]: 1 });
        expect(res.success).toBe(false);
      }
    );

    it('rejects a booking that tries to preset status or driver', () => {
      expect(S.createBookingBody.safeParse({ ...validTrip, status: 'completed' }).success).toBe(false);
      expect(S.createBookingBody.safeParse({ ...validTrip, paymentStatus: 'paid' }).success).toBe(false);
    });

    it('rejects an amount field on a payment order request', () => {
      expect(S.createOrderBody.safeParse({ bookingId: 'UDX-ABC123', amount: 1 }).success).toBe(false);
      expect(S.createOrderBody.safeParse({ bookingId: 'UDX-ABC123' }).success).toBe(true);
    });

    it('requires a non-empty signature on payment verification', () => {
      const base = { razorpayOrderId: 'order_ABC123', razorpayPaymentId: 'pay_XYZ789' };
      expect(S.verifyPaymentBody.safeParse({ ...base, razorpaySignature: '' }).success).toBe(false);
      expect(S.verifyPaymentBody.safeParse(base).success).toBe(false);
      expect(S.verifyPaymentBody.safeParse({
        ...base, razorpaySignature: 'a'.repeat(64),
      }).success).toBe(true);
    });
  });

  describe('coordinates', () => {
    it.each([
      [91, 0], [-91, 0], [0, 181], [0, -181],
    ])('rejects out-of-range coordinates lat=%p lng=%p', (lat, lng) => {
      expect(S.coords.safeParse({ lat, lng }).success).toBe(false);
    });

    it('accepts coordinates at the valid boundaries', () => {
      expect(S.coords.safeParse({ lat: 90, lng: 180 }).success).toBe(true);
      expect(S.coords.safeParse({ lat: -90, lng: -180 }).success).toBe(true);
    });

    it('rejects a driver location outside the valid range', () => {
      expect(S.driverLocationBody.safeParse({ lat: 200, lng: 0 }).success).toBe(false);
      expect(S.driverLocationBody.safeParse({ lat: 13.3, lng: 74.7 }).success).toBe(true);
    });

    it('rejects a driverId field — location is bound to the session, not the body', () => {
      expect(S.driverLocationBody.safeParse({
        lat: 13.3, lng: 74.7, driverId: '507f1f77bcf86cd799439011',
      }).success).toBe(false);
    });
  });

  describe('password policy', () => {
    it.each([
      'short', 'alllowercase123', 'ALLUPPERCASE123', 'NoDigitsHereAtAll', 'password',
    ])('rejects weak password %p', (pw) => {
      expect(S.password.safeParse(pw).success).toBe(false);
    });

    it('accepts a compliant password', () => {
      expect(S.password.safeParse('CorrectHorse7Battery').success).toBe(true);
    });
  });

  describe('field formats', () => {
    it.each(['notanemail', 'a@', '@b.com', 'a b@c.com'])('rejects bad email %p', (e) => {
      expect(S.email.safeParse(e).success).toBe(false);
    });

    it('normalises email casing', () => {
      expect(S.email.parse('  UsEr@Example.COM  ')).toBe('user@example.com');
    });

    it.each(['12345', 'abcdefghij', '+0123456789', ''])('rejects bad phone %p', (p) => {
      expect(S.phone.safeParse(p).success).toBe(false);
    });

    it.each(['12345', '1234567', 'abcdef', '12345a'])('rejects bad OTP %p', (o) => {
      expect(S.otpCode.safeParse(o).success).toBe(false);
    });

    it('rejects an over-long contact message', () => {
      expect(S.contactBody.safeParse({
        name: 'A B', message: 'x'.repeat(2001),
      }).success).toBe(false);
    });

    it('rejects a rating outside 1-5', () => {
      for (const r of [0, 6, -1, 4.5]) {
        expect(S.reviewBody.safeParse({ rating: r }).success).toBe(false);
      }
      expect(S.reviewBody.safeParse({ rating: 5 }).success).toBe(true);
    });

    it('rejects a passenger count above the maximum', () => {
      expect(S.createBookingBody.safeParse({ ...validTrip, passengerCount: 99 }).success).toBe(false);
    });
  });
});
