const {
  app, request, makeUser, makeAdmin, makeDriver, makeBooking,
  asUser, asDriver, Booking, Driver,
} = require('./helpers');
const { STATUS } = require('../constants/bookingStates');

/**
 * IDOR and privilege-escalation coverage (PHASE 58).
 * Each case maps to a concrete hole found in the original codebase.
 */
describeDb('Authorization / IDOR (integration)', () => {
  describe('booking ownership', () => {
    it("does not let a customer read another customer's booking", async () => {
      const owner = await makeUser();
      const attacker = await makeUser();
      const booking = await makeBooking(owner);

      const res = await request(app)
        .get(`/api/bookings/${booking.bookingId}`)
        .set('Cookie', asUser(attacker));

      expect(res.status).toBe(404);   // not 403 — do not confirm it exists
    });

    it("does not let a customer cancel another customer's booking", async () => {
      const owner = await makeUser();
      const attacker = await makeUser();
      const booking = await makeBooking(owner);

      const res = await request(app)
        .delete(`/api/bookings/${booking._id}`)
        .set('Cookie', asUser(attacker))
        .send({ reason: 'not mine' });

      expect(res.status).toBe(404);
      const after = await Booking.findById(booking._id);
      expect(after.status).toBe(STATUS.PENDING);
    });

    it('only lists the calling user\'s own bookings', async () => {
      const me = await makeUser();
      const other = await makeUser();
      await makeBooking(me);
      await makeBooking(other);
      await makeBooking(other);

      const res = await request(app).get('/api/bookings').set('Cookie', asUser(me));
      expect(res.status).toBe(200);
      expect(res.body.data.bookings).toHaveLength(1);
    });

    it('requires authentication for every booking route', async () => {
      const user = await makeUser();
      const booking = await makeBooking(user);
      for (const call of [
        request(app).get('/api/bookings'),
        request(app).get(`/api/bookings/${booking.bookingId}`),
        request(app).post('/api/bookings').send({}),
        request(app).delete(`/api/bookings/${booking._id}`).send({}),
      ]) {
        const res = await call;
        expect(res.status).toBe(401);
      }
    });
  });

  describe('admin-only routes', () => {
    it('refuses a normal user access to admin endpoints', async () => {
      const user = await makeUser();
      for (const path of ['/api/admin/stats', '/api/admin/bookings', '/api/admin/drivers', '/api/admin/payments', '/api/admin/audit-logs']) {
        const res = await request(app).get(path).set('Cookie', asUser(user));
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
      }
    });

    it('allows an admin through', async () => {
      const admin = await makeAdmin();
      const res = await request(app).get('/api/admin/stats').set('Cookie', asUser(admin));
      expect(res.status).toBe(200);
    });

    it('refuses a driver token on admin endpoints', async () => {
      const driver = await makeDriver();
      const res = await request(app).get('/api/admin/stats').set('Cookie', asDriver(driver));
      expect(res.status).toBe(401);
    });
  });

  describe('driver location (the unauthenticated GPS write)', () => {
    it('rejects an unauthenticated location update', async () => {
      const res = await request(app).put('/api/drivers/me/location').send({ lat: 1, lng: 1 });
      expect(res.status).toBe(401);
    });

    it('rejects a customer trying to write a location', async () => {
      const user = await makeUser();
      const res = await request(app).put('/api/drivers/me/location')
        .set('Cookie', asUser(user)).send({ lat: 1, lng: 1 });
      expect(res.status).toBe(401);
    });

    it('binds the update to the authenticated driver only', async () => {
      const driverA = await makeDriver();
      const driverB = await makeDriver();

      const res = await request(app).put('/api/drivers/me/location')
        .set('Cookie', asDriver(driverA))
        .send({ lat: 13.5, lng: 74.5 });
      expect(res.status).toBe(200);

      const a = await Driver.findById(driverA._id);
      const b = await Driver.findById(driverB._id);
      expect(a.currentLocation.coordinates).toEqual([74.5, 13.5]);
      // B is untouched — there is no route parameter to target them with.
      expect(b.currentLocation.coordinates).toEqual([74.7421, 13.3409]);
    });

    it('rejects out-of-range coordinates', async () => {
      const driver = await makeDriver();
      const res = await request(app).put('/api/drivers/me/location')
        .set('Cookie', asDriver(driver)).send({ lat: 999, lng: 999 });
      expect(res.status).toBe(400);
    });
  });

  describe('unapproved drivers', () => {
    it('blocks ride requests for a driver pending review', async () => {
      const driver = await makeDriver({ approvalStatus: 'pending_review' });
      const res = await request(app).get('/api/driver/requests').set('Cookie', asDriver(driver));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('DRIVER_NOT_APPROVED');
    });

    it('blocks a driver who verified email but has no approval', async () => {
      const driver = await makeDriver({ approvalStatus: 'pending_documents', isEmailVerified: true });
      const res = await request(app).get('/api/driver/requests').set('Cookie', asDriver(driver));
      expect(res.status).toBe(403);
    });

    it('blocks a suspended driver at authentication', async () => {
      const driver = await makeDriver({ approvalStatus: 'suspended' });
      const res = await request(app).get('/api/driver/status').set('Cookie', asDriver(driver));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('DRIVER_SUSPENDED');
    });

    it('lets a pending driver still read their own status', async () => {
      const driver = await makeDriver({ approvalStatus: 'pending_review' });
      const res = await request(app).get('/api/driver/status').set('Cookie', asDriver(driver));
      expect(res.status).toBe(200);
      expect(res.body.data.canAcceptRides).toBe(false);
    });
  });

  describe('driver ride lifecycle ownership', () => {
    it("refuses to advance another driver's ride", async () => {
      const customer = await makeUser();
      const assigned = await makeDriver();
      const attacker = await makeDriver();
      const booking = await makeBooking(customer, {
        status: STATUS.DRIVER_ASSIGNED, driver: assigned._id, paymentStatus: 'paid',
      });

      const res = await request(app)
        .post(`/api/driver/rides/${booking.bookingId}/advance`)
        .set('Cookie', asDriver(attacker))
        .send({ action: 'en_route' });

      expect(res.status).toBe(404);
      const after = await Booking.findById(booking._id);
      expect(after.status).toBe(STATUS.DRIVER_ASSIGNED);
    });
  });

  describe('public driver listing (PII leak)', () => {
    it('does not expose phone, address or GPS', async () => {
      await makeDriver({ address: '12 Temple Road, Udupi' });
      const res = await request(app).get('/api/drivers');

      expect(res.status).toBe(200);
      const json = JSON.stringify(res.body);
      expect(json).not.toContain('+919800000001');
      expect(json).not.toContain('Temple Road');
      expect(json).not.toContain('74.7421');
      expect(json).not.toMatch(/driver_\w+@example\.com/);
    });

    it('excludes drivers who are not approved', async () => {
      await makeDriver({ approvalStatus: 'pending_review' });
      const res = await request(app).get('/api/drivers');
      expect(res.body.data.drivers).toHaveLength(0);
    });
  });
});
