const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const Booking = require('../models/Booking');
const { PRICING, ROUND_TRIP_MULTIPLIER } = require('../constants/pricing');
const router = express.Router();

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many booking requests, please try again later' }
});

function generateBookingId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'UDX-';
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function calculateFare(carType, distance, tripType) {
  const pricing = PRICING[carType];
  if (!pricing) return 0;
  const km = parseFloat(distance) || 0;
  let fare = km <= pricing.minKm ? pricing.base : pricing.base + (km - pricing.minKm) * pricing.rate;
  if (tripType === 'round-trip') fare = Math.round(fare * ROUND_TRIP_MULTIPLIER);
  return Math.round(fare);
}

router.use(protect);
router.use(bookingLimiter);

router.post('/', async (req, res, next) => {
  try {
    const { pickup, drop, pickupCoords, dropCoords, date, time, carType, tripType, distance } = req.body;
    if (!pickup || !drop || !date || !carType) {
      return res.status(400).json({ message: 'pickup, drop, date, and carType are required' });
    }
    const fare = calculateFare(carType, distance || 50, tripType || 'one-way');
    let bookingId;
    let attempts = 0;
    do {
      bookingId = generateBookingId();
      attempts++;
      if (attempts >= 10) {
        return res.status(500).json({ message: 'Unable to generate unique booking ID, please try again' });
      }
    } while (await Booking.findOne({ bookingId }));

    const booking = await Booking.create({
      bookingId,
      user: req.user._id,
      pickup, drop, pickupCoords, dropCoords,
      date: new Date(date), time,
      carType, tripType: tripType || 'one-way',
      distance: parseFloat(distance) || 50,
      fare,
      status: 'pending'
    });
    res.status(201).json({ message: 'Booking created successfully', booking });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter = req.user.role === 'admin' ? {} : { user: req.user._id };
    const [bookings, total] = await Promise.all([
      Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('driver').populate('payment'),
      Booking.countDocuments(filter)
    ]);
    res.json({ bookings, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      $or: [{ _id: req.params.id }, { bookingId: req.params.id }],
      ...(req.user.role !== 'admin' ? { user: req.user._id } : {})
    }).populate('driver').populate('payment');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/status', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'driver_assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ message: 'Status updated', booking });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ message: 'Cannot cancel a booking that is already in progress or completed' });
    }
    booking.status = 'cancelled';
    await booking.save();
    res.json({ message: 'Booking cancelled successfully', booking });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
