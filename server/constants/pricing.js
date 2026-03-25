// Pricing config per car type
// base: minimum fare (applies up to minKm)
// rate: per-km rate beyond minKm
// minKm: minimum chargeable distance
// round-trip multiplier is 1.9x (5% discount vs 2x for return journey)
const PRICING = {
  etios:  { base: 600,  rate: 12, minKm: 50 },
  dzire:  { base: 650,  rate: 13, minKm: 50 },
  innova: { base: 1100, rate: 18, minKm: 61 },
  tempo:  { base: 2500, rate: 25, minKm: 100 }
};

// 1.9x instead of 2x: 5% discount on round-trip bookings to incentivize
const ROUND_TRIP_MULTIPLIER = 1.9;

module.exports = { PRICING, ROUND_TRIP_MULTIPLIER };
