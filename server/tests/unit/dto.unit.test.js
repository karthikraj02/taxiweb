const dto = require('../../dto');

/**
 * These tests exist because the original API returned raw Mongoose documents.
 * `GET /api/drivers` was public and leaked every driver's phone number, home
 * address, document paths and live GPS. The DTOs are allow-lists; this suite
 * asserts the deny side.
 */
const fullDriver = {
  _id: 'd1',
  name: 'Ravi Kumar Shetty',
  email: 'ravi@example.com',
  phone: '+919876543210',
  address: '12 Temple Road, Udupi',
  carType: 'dzire',
  carNumber: 'KA20AB1234',
  licenseNumber: 'KA2020123456',
  rating: 4.8,
  ratingCount: 22,
  isEmailVerified: true,
  approvalStatus: 'approved',
  availability: 'online',
  otpHash: '$2a$12$somehashvalue',
  otpExpiry: new Date(),
  otpAttempts: 2,
  sessionsValidFrom: new Date(),
  currentLocation: { type: 'Point', coordinates: [74.7421, 13.3409] },
  documents: [{ _id: 'doc1', type: 'rc', storageKey: 'drivers/d1/secret-key.pdf', mimeType: 'application/pdf', sizeBytes: 100, status: 'approved' }],
};

const fullUser = {
  _id: 'u1',
  name: 'Asha Rao',
  email: 'asha@example.com',
  phone: '+919812345678',
  password: '$2a$12$hashedpassword',
  otpHash: '$2a$12$otphash',
  role: 'user',
  isVerified: true,
  failedLoginAttempts: 3,
  lockUntil: new Date(),
};

const serialise = (v) => JSON.stringify(v);

describe('Response DTOs (PII containment)', () => {
  describe('driverPublicSummary — anonymous fleet listing', () => {
    const out = dto.driverPublicSummary(fullDriver);

    it.each(['phone', 'email', 'address', 'licenseNumber', 'otpHash', 'currentLocation', 'documents'])(
      'omits %s',
      (field) => expect(out[field]).toBeUndefined()
    );

    it('does not leak the values anywhere in the serialised payload', () => {
      const json = serialise(out);
      expect(json).not.toContain('+919876543210');
      expect(json).not.toContain('Temple Road');
      expect(json).not.toContain('74.7421');
      expect(json).not.toContain('$2a$');
    });

    it('shows only a first name', () => {
      expect(out.name).toBe('Ravi');
      expect(out.name).not.toContain('Shetty');
    });

    it('keeps the fields the fleet page legitimately needs', () => {
      expect(out.carType).toBe('dzire');
      expect(out.rating).toBe(4.8);
    });
  });

  describe('driverForCustomer — assigned driver on my own booking', () => {
    const out = dto.driverForCustomer(fullDriver);

    it('includes the contact number, which the rider needs', () => {
      expect(out.phone).toBe('+919876543210');
    });

    it.each(['address', 'email', 'licenseNumber', 'otpHash', 'documents', 'currentLocation'])(
      'still omits %s',
      (field) => expect(out[field]).toBeUndefined()
    );
  });

  describe('driverForAdmin', () => {
    const out = dto.driverForAdmin(fullDriver);

    it('never exposes OTP material even to an admin', () => {
      expect(serialise(out)).not.toContain('$2a$12$somehashvalue');
      expect(out.otpHash).toBeUndefined();
      expect(out.otpAttempts).toBeUndefined();
    });

    it('never exposes raw document storage keys', () => {
      expect(serialise(out)).not.toContain('secret-key.pdf');
      expect(out.documents[0].storageKey).toBeUndefined();
      expect(out.documents[0].type).toBe('rc');
    });
  });

  describe('publicUser', () => {
    const out = dto.publicUser(fullUser);

    it('never exposes the password hash', () => {
      expect(out.password).toBeUndefined();
      expect(serialise(out)).not.toContain('$2a$');
    });

    it.each(['otpHash', 'failedLoginAttempts', 'lockUntil', 'sessionsValidFrom'])(
      'omits internal field %s',
      (field) => expect(out[field]).toBeUndefined()
    );
  });

  describe('bookingForDriverRequest — pre-acceptance offer', () => {
    const booking = {
      _id: 'b1', bookingId: 'UDX-ABC123',
      pickup: 'Udupi', drop: 'Mangalore',
      pickupCoords: { lat: 13.3, lng: 74.7 }, dropCoords: { lat: 12.9, lng: 74.8 },
      carType: 'dzire', fare: 1000, distanceKm: 60, status: 'dispatching',
      user: { _id: 'u1', name: 'Asha Rao', phone: '+919812345678', email: 'asha@example.com' },
      notes: 'Call when you arrive',
    };

    it('withholds customer contact details before the driver accepts', () => {
      const out = dto.bookingForDriverRequest(booking);
      const json = serialise(out);
      expect(json).not.toContain('+919812345678');
      expect(json).not.toContain('asha@example.com');
      expect(out.customer).toBeUndefined();
    });

    it('releases them once the driver is assigned', () => {
      const out = dto.bookingForAssignedDriver(booking);
      expect(out.customer.phone).toBe('+919812345678');
      // Still no email — the driver has no need for it.
      expect(serialise(out)).not.toContain('asha@example.com');
    });
  });

  describe('paymentSummary', () => {
    it('never returns the Razorpay signature', () => {
      const out = dto.paymentSummary({
        _id: 'p1', status: 'paid', amountPaise: 100000, currency: 'INR',
        receipt: 'rcpt_1', razorpayOrderId: 'order_1',
        razorpayPaymentId: 'pay_1', razorpaySignature: 'deadbeefsignature',
      });
      expect(serialise(out)).not.toContain('deadbeefsignature');
      expect(out.razorpaySignature).toBeUndefined();
    });

    it('converts paise to rupees for display', () => {
      const out = dto.paymentSummary({ _id: 'p1', amountPaise: 123400, currency: 'INR', status: 'paid' });
      expect(out.amount).toBe(1234);
    });
  });

  describe('review', () => {
    it('abbreviates the reviewer name rather than publishing it in full', () => {
      const out = dto.review({
        _id: 'r1', rating: 5, comment: 'Great ride',
        user: { name: 'Asha Rao', email: 'asha@example.com' },
      });
      expect(out.author).toBe('Asha R.');
      expect(serialise(out)).not.toContain('asha@example.com');
    });
  });
});
