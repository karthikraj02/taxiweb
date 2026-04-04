const express = require('express');
const { protectDriver } = require('../middleware/auth');
const Booking = require('../models/Booking');
const { getIO } = require('../socket');

const router = express.Router();

router.use(protectDriver);

// GET /api/driver/requests
// Returns pending bookings that match the driver's car type
router.get('/requests', async (req, res, next) => {
  try {
    const filter = { status: 'pending' };
    if (req.driver.carType) filter.carType = req.driver.carType;
    const requests = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('user', 'name phone email');
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

// POST /api/driver/requests/:id/accept
// Assigns the driver to a booking and sets status to driver_assigned
router.post('/requests/:id/accept', async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      $or: [{ _id: req.params.id }, { bookingId: req.params.id }],
      status: 'pending',
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found or already accepted' });
    }
    booking.driver = req.driver._id;
    booking.status = 'driver_assigned';
    await booking.save();

    const io = getIO();
    if (io) {
      io.to(`booking:${booking.bookingId}`).emit('bookingStatus', {
        status: 'driver_assigned',
        bookingId: booking.bookingId,
        driver: {
          name: req.driver.name,
          phone: req.driver.phone,
          carNumber: req.driver.carNumber,
          carType: req.driver.carType,
        },
      });
    }

    res.json({ message: 'Booking accepted', booking });
  } catch (err) {
    next(err);
  }
});

// POST /api/driver/requests/:id/reject
// Removes the driver from a booking and resets status to pending
router.post('/requests/:id/reject', async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      $and: [
        { $or: [{ _id: req.params.id }, { bookingId: req.params.id }] },
        { $or: [{ status: 'pending' }, { status: 'driver_assigned', driver: req.driver._id }] },
      ],
    });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    booking.driver = undefined;
    booking.status = 'pending';
    await booking.save();
    res.json({ message: 'Booking rejected', booking });
  } catch (err) {
    next(err);
  }
});

// GET /api/driver/stats
// Returns total completed rides for the logged-in driver
router.get('/stats', async (req, res, next) => {
  try {
    const totalRides = await Booking.countDocuments({
      driver: req.driver._id,
      status: 'completed',
    });
    const activeRide = await Booking.findOne({
      driver: req.driver._id,
      status: { $in: ['driver_assigned', 'en_route', 'arrived', 'in_progress'] },
    })
      .sort({ createdAt: -1 })
      .populate('user', 'name phone email');

    res.json({ totalRides, activeRide: activeRide || null });
  } catch (err) {
    next(err);
  }
});

// GET /api/driver/active-ride
// Returns the current active ride for the driver (for chatbox)
router.get('/active-ride', async (req, res, next) => {
  try {
    const activeRide = await Booking.findOne({
      driver: req.driver._id,
      status: { $in: ['driver_assigned', 'en_route', 'arrived', 'in_progress'] },
    })
      .sort({ createdAt: -1 })
      .populate('user', 'name phone email');
    res.json({ activeRide: activeRide || null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
