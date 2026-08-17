const crypto = require('crypto');
const {
  app, request, makeUser, makeBooking, asUser, Booking, Payment,
} = require('./helpers');
const { STATUS } = require('../constants/bookingStates');

/**
 * Payment security (PHASE 11/12). These are the tests that would have caught
 * the original free-ride bug.
 */
describeDb('Payments (integration)', () => {
  const SECRET = process.env.RAZORPAY_KEY_SECRET || 'razorpay_test_secret_value';

  const sign = (orderId, paymentId) =>
    crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');

  async function seedOrder(user, booking, amountPaise) {
    return Payment.create({
      booking: booking._id,
      user: user._id,
      razorpayOrderId: `order_${crypto.randomBytes(6).toString('hex')}`,
      amountPaise: amountPaise ?? booking.fare * 100,
      currency: 'INR',
      receipt: `rcpt_${booking.bookingId}`,
      status: 'created',
    });
  }

  describe('the original bypass', () => {
    it('rejects an empty signature outright', async () => {
      const user = await makeUser();
      const booking = await makeBooking(user, { status: STATUS.PAYMENT_PENDING, paymentStatus: 'pending' });
      const payment = await seedOrder(user, booking);

      const res = await request(app).post('/api/payments/razorpay/verify')
        .set('Cookie', asUser(user))
        .send({
          razorpayOrderId: payment.razorpayOrderId,
          razorpayPaymentId: `pay_demo_${Date.now()}`,
          razorpaySignature: '',
        });

      expect(res.status).toBe(400);

      const afterPayment = await Payment.findById(payment._id);
      const afterBooking = await Booking.findById(booking._id);
      expect(afterPayment.status).toBe('created');
      expect(afterBooking.paymentStatus).not.toBe('paid');
      expect(afterBooking.status).not.toBe(STATUS.CONFIRMED);
    });

    it('rejects a forged signature', async () => {
      const user = await makeUser();
      const booking = await makeBooking(user, { status: STATUS.PAYMENT_PENDING });
      const payment = await seedOrder(user, booking);

      const res = await request(app).post('/api/payments/razorpay/verify')
        .set('Cookie', asUser(user))
        .send({
          razorpayOrderId: payment.razorpayOrderId,
          razorpayPaymentId: 'pay_forged',
          razorpaySignature: 'f'.repeat(64),
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYMENT_SIGNATURE');
      expect((await Payment.findById(payment._id)).status).toBe('created');
    });
  });

  describe('payment ownership', () => {
    it("does not let one user verify another user's payment", async () => {
      const owner = await makeUser();
      const attacker = await makeUser();
      const booking = await makeBooking(owner, { status: STATUS.PAYMENT_PENDING });
      const payment = await seedOrder(owner, booking);

      const res = await request(app).post('/api/payments/razorpay/verify')
        .set('Cookie', asUser(attacker))
        .send({
          razorpayOrderId: payment.razorpayOrderId,
          razorpayPaymentId: 'pay_x',
          razorpaySignature: sign(payment.razorpayOrderId, 'pay_x'),
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PAYMENT_NOT_FOUND');
    });

    it("does not let a user open an order against someone else's booking", async () => {
      const owner = await makeUser();
      const attacker = await makeUser();
      const booking = await makeBooking(owner);

      const res = await request(app).post('/api/payments/razorpay/order')
        .set('Cookie', asUser(attacker))
        .send({ bookingId: booking.bookingId });

      expect(res.status).toBe(404);
    });

    it('only returns the calling user\'s payments', async () => {
      const me = await makeUser();
      const other = await makeUser();
      await seedOrder(me, await makeBooking(me));
      await seedOrder(other, await makeBooking(other));

      const res = await request(app).get('/api/payments').set('Cookie', asUser(me));
      expect(res.body.data.payments).toHaveLength(1);
    });
  });

  describe('amount integrity', () => {
    it('ignores any client-supplied amount when creating an order', async () => {
      const user = await makeUser();
      const booking = await makeBooking(user, { fare: 2500 });

      const res = await request(app).post('/api/payments/razorpay/order')
        .set('Cookie', asUser(user))
        .send({ bookingId: booking.bookingId, amount: 1 });

      // .strict() rejects the extra key rather than quietly honouring the fare.
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('derives the charge from the stored fare', async () => {
      const user = await makeUser();
      const booking = await makeBooking(user, { fare: 2500 });
      const payment = await seedOrder(user, booking);
      expect(payment.amountPaise).toBe(250000);
    });
  });

  describe('booking state coupling', () => {
    it('never marks a booking paid without a verified payment', async () => {
      const user = await makeUser();
      const booking = await makeBooking(user);
      const fresh = await Booking.findById(booking._id);
      expect(fresh.paymentStatus).toBe('unpaid');
      expect(fresh.status).toBe(STATUS.PENDING);
    });

    it('refuses dispatch until payment is verified', async () => {
      const user = await makeUser();
      const booking = await makeBooking(user, { status: STATUS.PAYMENT_PENDING, paymentStatus: 'pending' });

      const res = await request(app).post(`/api/bookings/${booking.bookingId}/dispatch`)
        .set('Cookie', asUser(user));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PAYMENT_REQUIRED');
    });

    it('refuses a second order for an already-paid booking', async () => {
      const user = await makeUser();
      const booking = await makeBooking(user, { status: STATUS.CONFIRMED, paymentStatus: 'paid' });

      const res = await request(app).post('/api/payments/razorpay/order')
        .set('Cookie', asUser(user))
        .send({ bookingId: booking.bookingId });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_PAID');
    });
  });
});
