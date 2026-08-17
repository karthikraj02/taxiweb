const express = require('express');
const pricing = require('../services/pricing');
const bookingService = require('../services/booking');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const S = require('../validators/schemas');
const { bookingLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

/** Public tariff card. Rates only — no computation, nothing user-specific. */
router.get('/tariffs', (req, res) => {
  res.json({ success: true, data: { tariffs: pricing.tariffs(), currency: 'INR' } });
});

/**
 * PHASE 9/10 — quote endpoint.
 *
 * Takes coordinates, not a distance. The server resolves the route and prices
 * it, so the number shown in the UI is produced by exactly the same code path
 * that will later charge the card. The old `/estimate` accepted a `distance`
 * the client had made up.
 */
router.post('/quote', protect, bookingLimiter, validate({ body: S.quoteBody }), async (req, res, next) => {
  try {
    const priced = await bookingService.priceTrip(req.body);
    res.json({
      success: true,
      data: {
        fare: priced.fare,
        currency: priced.currency,
        distanceKm: priced.distanceKm,
        durationMinutes: priced.durationMinutes,
        distanceEstimated: priced.distanceEstimated,
        breakdown: priced.fareBreakdown,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
