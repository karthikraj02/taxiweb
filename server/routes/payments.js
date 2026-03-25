const express = require('express');
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const router = express.Router();

router.post('/razorpay/order', protect, async (req, res, next) => {
  try {
    const { bookingId, amount } = req.body;
    if (!bookingId) return res.status(400).json({ message: 'bookingId is required' });

    const booking = await Booking.findOne({
      $or: [{ _id: bookingId }, { bookingId: bookingId }],
      user: req.user._id
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const amountInPaise = Math.round((amount || booking.fare || 500) * 100);
    const receipt = `rcpt_${booking.bookingId}_${Date.now()}`;

    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: { bookingId: booking.bookingId }
      });
      const payment = await Payment.create({
        booking: booking._id,
        user: req.user._id,
        razorpayOrderId: order.id,
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        status: 'created'
      });
      booking.payment = payment._id;
      await booking.save();
      return res.json({ order, payment: payment._id, keyId: process.env.RAZORPAY_KEY_ID });
    } else {
      const mockOrderId = `order_mock_${Date.now()}`;
      const payment = await Payment.create({
        booking: booking._id,
        user: req.user._id,
        razorpayOrderId: mockOrderId,
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        status: 'created'
      });
      booking.payment = payment._id;
      await booking.save();
      return res.json({
        order: { id: mockOrderId, amount: amountInPaise, currency: 'INR', receipt },
        payment: payment._id,
        keyId: 'rzp_test_mock',
        isMock: true
      });
    }
  } catch (err) {
    next(err);
  }
});

router.post('/razorpay/verify', protect, async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body;

    if (process.env.RAZORPAY_KEY_SECRET && razorpaySignature) {
      const body = razorpayOrderId + '|' + razorpayPaymentId;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');
      if (expectedSignature !== razorpaySignature) {
        return res.status(400).json({ message: 'Invalid payment signature' });
      }
    }

    const payment = await Payment.findOne({ razorpayOrderId });
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.status = 'paid';
    await payment.save();

    const booking = await Booking.findById(payment.booking);
    if (booking) {
      booking.status = 'confirmed';
      await booking.save();
    }

    res.json({ message: 'Payment verified successfully', payment, booking });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
