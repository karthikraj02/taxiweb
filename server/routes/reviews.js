const express = require('express');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Driver = require('../models/Driver');
const bookingService = require('../services/booking');
const dto = require('../dto');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const S = require('../validators/schemas');
const { STATUS } = require('../constants/bookingStates');
const { notFound, badRequest, conflict } = require('../utils/errors');

const router = express.Router();

/**
 * PHASE 38 — real published reviews.
 * Replaces three hardcoded testimonials that were presented as customer reviews.
 */
router.get('/', async (req, res, next) => {
  try {
    // `{ $ne: null, $ne: '' }` is a duplicate key — the second clause silently
    // replaced the first. $nin covers both cases correctly.
    const reviews = await Review.find({ isPublished: true, comment: { $nin: [null, ''] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name');

    res.json({ success: true, data: { reviews: reviews.map(dto.review) } });
  } catch (err) { next(err); }
});

/** PHASE 43 — a review requires a completed ride the caller actually took. */
router.post('/booking/:id', protect, validate({ params: S.idParam, body: S.reviewBody }), async (req, res, next) => {
  try {
    const booking = await bookingService.findScoped(req.params.id, { user: req.user._id });
    if (!booking) throw notFound('BOOKING_NOT_FOUND', 'We could not find that booking.');
    if (booking.status !== STATUS.COMPLETED) {
      throw badRequest('RIDE_NOT_COMPLETED', 'You can review a ride once it has been completed.');
    }
    if (!booking.driver) {
      throw badRequest('NO_DRIVER', 'This booking has no driver to review.');
    }

    let review;
    try {
      review = await Review.create({
        booking: booking._id,
        user: req.user._id,
        driver: booking.driver,
        rating: req.body.rating,
        comment: req.body.comment,
      });
    } catch (err) {
      // Unique index on booking enforces one review per ride.
      if (err.code === 11000) {
        throw conflict('ALREADY_REVIEWED', 'You have already reviewed this ride.');
      }
      throw err;
    }

    // Recompute the driver's aggregate from the reviews themselves rather than
    // incrementally mutating a counter that can drift.
    const agg = await Review.aggregate([
      { $match: { driver: new mongoose.Types.ObjectId(booking.driver) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    if (agg[0]) {
      await Driver.updateOne(
        { _id: booking.driver },
        { rating: Math.round(agg[0].avg * 10) / 10, ratingCount: agg[0].count }
      );
    }

    res.status(201).json({ success: true, data: { review: dto.review(review) } });
  } catch (err) { next(err); }
});

module.exports = router;
