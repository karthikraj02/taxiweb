const {
  app, request, makeUser, makeDriver, makeBooking, asDriver, Booking, Driver,
} = require('./helpers');
const dispatchService = require('../services/dispatch');
const { STATUS } = require('../constants/bookingStates');

describeDb('Dispatch and race conditions (integration)', () => {
  async function dispatchableBooking(user, overrides = {}) {
    return makeBooking(user, {
      status: STATUS.DISPATCHING, paymentStatus: 'paid', driver: null, carType: 'dzire', ...overrides,
    });
  }

  it('assigns the booking to the accepting driver', async () => {
    const user = await makeUser();
    const driver = await makeDriver();
    const booking = await dispatchableBooking(user);

    const res = await request(app)
      .post(`/api/driver/requests/${booking.bookingId}/accept`)
      .set('Cookie', asDriver(driver));

    expect(res.status).toBe(200);
    const after = await Booking.findById(booking._id);
    expect(after.driver.toString()).toBe(driver._id.toString());
    expect(after.status).toBe(STATUS.DRIVER_ASSIGNED);
  });

  /** PHASE 21 — the original read-then-write allowed two winners. */
  it('lets exactly one of many concurrent drivers win the ride', async () => {
    const user = await makeUser();
    const drivers = await Promise.all([
      makeDriver(), makeDriver(), makeDriver(), makeDriver(), makeDriver(),
    ]);
    const booking = await dispatchableBooking(user);

    const results = await Promise.all(
      drivers.map(d => dispatchService.acceptBooking(booking.bookingId, d)
        .then(() => 'won').catch(err => err.code))
    );

    expect(results.filter(r => r === 'won')).toHaveLength(1);
    expect(results.filter(r => r === 'RIDE_ALREADY_TAKEN')).toHaveLength(4);

    const after = await Booking.findById(booking._id);
    expect(after.driver).toBeTruthy();
    expect(after.status).toBe(STATUS.DRIVER_ASSIGNED);
  });

  it('refuses a second acceptance after the first', async () => {
    const user = await makeUser();
    const first = await makeDriver();
    const second = await makeDriver();
    const booking = await dispatchableBooking(user);

    await request(app).post(`/api/driver/requests/${booking.bookingId}/accept`)
      .set('Cookie', asDriver(first));
    const res = await request(app).post(`/api/driver/requests/${booking.bookingId}/accept`)
      .set('Cookie', asDriver(second));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RIDE_ALREADY_TAKEN');
  });

  it('stops a driver holding two rides at once', async () => {
    const user = await makeUser();
    const driver = await makeDriver();
    const first = await dispatchableBooking(user);
    const second = await dispatchableBooking(user);

    await request(app).post(`/api/driver/requests/${first.bookingId}/accept`)
      .set('Cookie', asDriver(driver));
    const res = await request(app).post(`/api/driver/requests/${second.bookingId}/accept`)
      .set('Cookie', asDriver(driver));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DRIVER_HAS_ACTIVE_RIDE');
  });

  it('marks the driver on_trip on acceptance and online on completion', async () => {
    const user = await makeUser();
    const driver = await makeDriver();
    const booking = await dispatchableBooking(user);

    await request(app).post(`/api/driver/requests/${booking.bookingId}/accept`)
      .set('Cookie', asDriver(driver));
    expect((await Driver.findById(driver._id)).availability).toBe('on_trip');

    for (const action of ['en_route', 'arrived', 'start', 'complete']) {
      const res = await request(app).post(`/api/driver/rides/${booking.bookingId}/advance`)
        .set('Cookie', asDriver(driver)).send({ action });
      expect(res.status).toBe(200);
    }

    expect((await Driver.findById(driver._id)).availability).toBe('online');
    expect((await Booking.findById(booking._id)).status).toBe(STATUS.COMPLETED);
  });

  it('refuses to skip a lifecycle step', async () => {
    const user = await makeUser();
    const driver = await makeDriver();
    const booking = await dispatchableBooking(user);

    await request(app).post(`/api/driver/requests/${booking.bookingId}/accept`)
      .set('Cookie', asDriver(driver));

    // driver_assigned -> complete is not a legal edge.
    const res = await request(app).post(`/api/driver/rides/${booking.bookingId}/advance`)
      .set('Cookie', asDriver(driver)).send({ action: 'complete' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ILLEGAL_STATUS_TRANSITION');
  });

  it('does not offer a ride to a driver with the wrong vehicle class', async () => {
    const user = await makeUser();
    const driver = await makeDriver({ carType: 'innova' });
    const booking = await dispatchableBooking(user, { carType: 'dzire' });

    const res = await request(app).post(`/api/driver/requests/${booking.bookingId}/accept`)
      .set('Cookie', asDriver(driver));

    expect(res.status).toBe(409);
  });

  it('does not surface unpaid bookings as ride requests', async () => {
    const user = await makeUser();
    const driver = await makeDriver();
    await dispatchableBooking(user, { paymentStatus: 'unpaid' });

    const res = await request(app).get('/api/driver/requests').set('Cookie', asDriver(driver));
    expect(res.body.data.requests).toHaveLength(0);
  });
});
