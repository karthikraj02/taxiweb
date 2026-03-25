const express = require('express');
const { protect } = require('../middleware/auth');
const Driver = require('../models/Driver');
const { getIO } = require('../socket');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const filter = { isAvailable: true };
    if (req.query.carType) filter.carType = req.query.carType;
    const drivers = await Driver.find(filter);
    res.json({ drivers });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    res.json({ driver });
  } catch (err) {
    next(err);
  }
});

router.post('/', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    const driver = await Driver.create(req.body);
    res.status(201).json({ message: 'Driver created', driver });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/location', async (req, res, next) => {
  try {
    const { lat, lng, bookingId } = req.body;
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { currentLocation: { lat, lng } },
      { new: true }
    );
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    if (bookingId) {
      const io = getIO();
      if (io) {
        io.to(`booking:${bookingId}`).emit('driverLocation', { lat, lng });
      }
    }
    res.json({ message: 'Location updated', driver });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
