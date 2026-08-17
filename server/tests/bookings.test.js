const {
  app, request, makeUser, makeAdmin, makeDriver, makeBooking,
  asUser, validTripBody, Booking, Driver,
} = require('./helpers');
const { STATUS } = require('../constants/bookingStates');

describeDb('Bookings (integration)', () => {
  describe('creation', () => {
    it('creates a booking and prices it server-side', async () => {
      const user = await makeUser();
      const res = await request(app).post('/api/bookings')
        .set('Cookie', asUser(user)).send(validTripBody());

      expect(res.status).toBe(201);
      const b = res.body.data.booking;
      expect(b.fare).toBeGreaterThan(0);
      expect(b.distanceKm).toBeGreaterThan(0);
      expect(b.status).toBe(STATUS.PENDING);
      expect(b.paymentStatus).toBe('unpaid');
    });

    it('ignores a client-supplied fare by rejecting the request', async () => {
      const user = await makeUser();
      const res = await request(app).post('/api/bookings')
        .set('Cookie', asUser(user))
        .send({ ...validTripBody(), fare: 1, distanceKm: 1 });

      expect(res.status).toBe(400);
      expect(await Booking.countDocuments({})).toBe(0);
    });

    it('produces the same fare for the same trip every time', async () => {
      const user = await makeUser();
      const fares = [];
      for (let i = 0; i < 3; i++) {
        const res = await request(app).post('/api/bookings')
          .set('Cookie', asUser(user)).send(validTripBody());
        fares.push(res.body.data.booking.fare);
      }
      expect(new Set(fares).size).toBe(1);
    });

    it('matches the quote endpoint exactly', async () => {
      const user = await makeUser();
      const body = validTripBody();

      const quote = await request(app).post('/api/pricing/quote')
        .set('Cookie', asUser(user)).send(body);
      const booking = await request(app).post('/api/bookings')
        .set('Cookie', asUser(user)).send(body);

      expect(booking.body.data.booking.fare).toBe(quote.body.data.fare);
    });

    it('rejects a pickup time in the past', async () => {
      const user = await makeUser();
      const res = await request(app).post('/api/bookings')
        .set('Cookie', asUser(user))
        .send(validTripBody({ scheduledFor: new Date(Date.now() - 86400e3).toISOString() }));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SCHEDULE_IN_PAST');
    });

    it('rejects more passengers than the vehicle seats', async () => {
      const user = await makeUser();
      const res = await request(app).post('/api/bookings')
        .set('Cookie', asUser(user))
        .send(validTripBody({ carType: 'dzire', passengerCount: 7 }));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CAPACITY_EXCEEDED');
    });
  });

  describe('idempotency (PHASE 30)', () => {
    it('returns the same booking for a repeated Idempotency-Key', async () => {
      const user = await makeUser();
      const key = 'client-key-abc-123';
      const body = validTripBody();

      const first = await request(app).post('/api/bookings')
        .set('Cookie', asUser(user)).set('Idempotency-Key', key).send(body);
      const second = await request(app).post('/api/bookings')
        .set('Cookie', asUser(user)).set('Idempotency-Key', key).send(body);

      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body.idempotentReplay).toBe(true);
      expect(second.body.data.booking.bookingId).toBe(first.body.data.booking.bookingId);
      expect(await Booking.countDocuments({})).toBe(1);
    });

    it('survives concurrent double submission', async () => {
      const user = await makeUser();
      const key = 'concurrent-key';
      const body = validTripBody();

      await Promise.all([
        request(app).post('/api/bookings').set('Cookie', asUser(user)).set('Idempotency-Key', key).send(body),
        request(app).post('/api/bookings').set('Cookie', asUser(user)).set('Idempotency-Key', key).send(body),
      ]);

      expect(await Booking.countDocuments({})).toBe(1);
    });

    it('creates separate bookings without a key', async () => {
      const user = await makeUser();
      await request(app).post('/api/bookings').set('Cookie', asUser(user)).send(validTripBody());
      await request(app).post('/api/bookings').set('Cookie', asUser(user)).send(validTripBody());
      expect(await Booking.countDocuments({})).toBe(2);
    });
  });

  describe('state machine enforcement', () => {
    it('refuses an admin jump from pending to completed', async () => {
      const admin = await makeAdmin();
      const user = await makeUser();
      const booking = await makeBooking(user);

      const res = await request(app).put(`/api/admin/bookings/${booking.bookingId}/status`)
        .set('Cookie', asUser(admin))
        .send({ status: STATUS.COMPLETED });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ILLEGAL_STATUS_TRANSITION');
      expect((await Booking.findById(booking._id)).status).toBe(STATUS.PENDING);
    });

    it('refuses to reopen a completed booking', async () => {
      const admin = await makeAdmin();
      const user = await makeUser();
      const booking = await makeBooking(user, { status: STATUS.COMPLETED });

      const res = await request(app).put(`/api/admin/bookings/${booking.bookingId}/status`)
        .set('Cookie', asUser(admin))
        .send({ status: STATUS.IN_PROGRESS });

      expect(res.status).toBe(400);
    });

    it('records every transition in history', async () => {
      const admin = await makeAdmin();
      const user = await makeUser();
      const booking = await makeBooking(user);

      await request(app).put(`/api/admin/bookings/${booking.bookingId}/status`)
        .set('Cookie', asUser(admin)).send({ status: STATUS.PAYMENT_PENDING, reason: 'manual' });

      const after = await Booking.findById(booking._id);
      expect(after.statusHistory.at(-1)).toMatchObject({
        from: STATUS.PENDING, to: STATUS.PAYMENT_PENDING, actorType: 'admin',
      });
    });
  });

  describe('cancellation policy', () => {
    it('is free before a driver is assigned', async () => {
      const user = await makeUser();
      const booking = await makeBooking(user, { status: STATUS.CONFIRMED, paymentStatus: 'paid', fare: 1000 });

      const res = await request(app).delete(`/api/bookings/${booking._id}`)
        .set('Cookie', asUser(user)).send({ reason: 'plans changed' });

      expect(res.status).toBe(200);
      expect(res.body.data.cancellationFee).toBe(0);
      expect(res.body.data.refundDue).toBe(1000);
    });

    it('charges a fee once the driver has arrived', async () => {
      const user = await makeUser();
      const driver = await makeDriver();
      const booking = await makeBooking(user, {
        status: STATUS.DRIVER_ARRIVED, driver: driver._id, paymentStatus: 'paid', fare: 1000,
      });

      const res = await request(app).delete(`/api/bookings/${booking._id}`)
        .set('Cookie', asUser(user)).send({ reason: 'changed mind' });

      expect(res.status).toBe(200);
      expect(res.body.data.cancellationFee).toBe(250);   // 25%
    });

    it('refuses cancellation once the trip is under way', async () => {
      const user = await makeUser();
      const booking = await makeBooking(user, { status: STATUS.IN_PROGRESS });

      const res = await request(app).delete(`/api/bookings/${booking._id}`)
        .set('Cookie', asUser(user)).send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANCELLATION_NOT_ALLOWED');
    });

    it('releases the driver on cancellation', async () => {
      const user = await makeUser();
      const driver = await makeDriver({ availability: 'on_trip' });
      const booking = await makeBooking(user, {
        status: STATUS.DRIVER_ASSIGNED, driver: driver._id, paymentStatus: 'paid',
      });

      await request(app).delete(`/api/bookings/${booking._id}`)
        .set('Cookie', asUser(user)).send({});

      expect((await Driver.findById(driver._id)).availability).toBe('online');
    });
  });
});
