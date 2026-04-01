const express = require('express');
const { PRICING, ROUND_TRIP_MULTIPLIER } = require('../constants/pricing');
const router = express.Router();

router.post('/estimate', (req, res) => {
  const { carType, distance, tripType } = req.body;
  if (!carType || !distance) {
    return res.status(400).json({ message: 'carType and distance are required' });
  }
  const pricing = PRICING[carType];
  if (!pricing) {
    return res.status(400).json({ message: 'Invalid car type' });
  }
  const km = parseFloat(distance);
  if (isNaN(km) || km <= 0) {
    return res.status(400).json({ message: 'Invalid distance' });
  }
  let fare;
  if (km <= pricing.minKm) {
    fare = pricing.base;
  } else {
    fare = pricing.base + (km - pricing.minKm) * pricing.rate;
  }
  if (tripType === 'round-trip') {
    fare = Math.round(fare * ROUND_TRIP_MULTIPLIER);
  }
  fare = Math.round(fare);
  res.json({
    carType,
    distance: km,
    tripType: tripType || 'one-way',
    fare,
    breakdown: {
      baseAmount: pricing.base,
      ratePerKm: pricing.rate,
      minKm: pricing.minKm,
      multiplier: tripType === 'round-trip' ? ROUND_TRIP_MULTIPLIER : 1
    }
  });
});

router.get('/tariffs', (req, res) => {
  res.json(PRICING);
});

module.exports = router;
