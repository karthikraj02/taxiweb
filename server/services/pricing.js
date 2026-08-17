/**
 * Centralised pricing service (PHASE 9).
 *
 * This is the ONLY place a fare is produced. Routes never accept a `fare` or
 * `amount` from the client; they call `quote()` with server-derived distance
 * and store the result. The payment layer re-reads the stored fare from the
 * database rather than trusting the request body.
 *
 * All rates are configurable via environment variables so pricing can change
 * without a code deploy.
 */
const num = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * base:        minimum fare, covers everything up to minKm
 * perKmRate:   charged on each km beyond minKm
 * minKm:       minimum chargeable distance
 * capacity:    passenger capacity, validated at booking time
 */
const VEHICLES = {
  etios: {
    label: 'Toyota Etios',
    base: num('PRICE_ETIOS_BASE', 600),
    perKmRate: num('PRICE_ETIOS_RATE', 12),
    minKm: num('PRICE_ETIOS_MIN_KM', 50),
    capacity: 4,
  },
  dzire: {
    label: 'Maruti Dzire',
    base: num('PRICE_DZIRE_BASE', 650),
    perKmRate: num('PRICE_DZIRE_RATE', 13),
    minKm: num('PRICE_DZIRE_MIN_KM', 50),
    capacity: 4,
  },
  innova: {
    label: 'Toyota Innova',
    base: num('PRICE_INNOVA_BASE', 1100),
    perKmRate: num('PRICE_INNOVA_RATE', 18),
    minKm: num('PRICE_INNOVA_MIN_KM', 61),
    capacity: 7,
  },
  tempo: {
    label: 'Tempo Traveller',
    base: num('PRICE_TEMPO_BASE', 2500),
    perKmRate: num('PRICE_TEMPO_RATE', 25),
    minKm: num('PRICE_TEMPO_MIN_KM', 100),
    capacity: 12,
  },
};

const VEHICLE_TYPES = Object.keys(VEHICLES);

const RULES = {
  roundTripMultiplier: num('PRICE_ROUND_TRIP_MULTIPLIER', 1.9),
  // Night surcharge applies to pickups between these hours (local time).
  nightSurchargePercent: num('PRICE_NIGHT_SURCHARGE_PERCENT', 10),
  nightStartHour: num('PRICE_NIGHT_START_HOUR', 22),
  nightEndHour: num('PRICE_NIGHT_END_HOUR', 5),
  airportSurcharge: num('PRICE_AIRPORT_SURCHARGE', 150),
  taxPercent: num('PRICE_TAX_PERCENT', 5),
  maxDistanceKm: num('PRICE_MAX_DISTANCE_KM', 2000),
};

const AIRPORT_KEYWORDS = ['airport', 'ixe', 'blr ', 'kempegowda'];

function isAirportTrip(pickup = '', drop = '') {
  const haystack = `${pickup} ${drop}`.toLowerCase();
  return AIRPORT_KEYWORDS.some(k => haystack.includes(k));
}

function isNightPickup(pickupAt) {
  if (!pickupAt) return false;
  const hour = new Date(pickupAt).getHours();
  if (RULES.nightStartHour > RULES.nightEndHour) {
    // Window wraps midnight, e.g. 22:00–05:00
    return hour >= RULES.nightStartHour || hour < RULES.nightEndHour;
  }
  return hour >= RULES.nightStartHour && hour < RULES.nightEndHour;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Produce an itemised, auditable fare.
 *
 * @param {object} input
 * @param {string} input.carType
 * @param {number} input.distanceKm  server-calculated distance, never client-supplied
 * @param {'one-way'|'round-trip'} [input.tripType]
 * @param {Date|string} [input.pickupAt]
 * @param {string} [input.pickup]
 * @param {string} [input.drop]
 * @param {number} [input.tolls]
 * @param {number} [input.parking]
 * @param {number} [input.discount]
 * @returns {{total:number, currency:string, breakdown:object}}
 */
function quote({
  carType,
  distanceKm,
  tripType = 'one-way',
  pickupAt = null,
  pickup = '',
  drop = '',
  tolls = 0,
  parking = 0,
  discount = 0,
}) {
  const { badRequest } = require('../utils/errors');

  const vehicle = VEHICLES[carType];
  if (!vehicle) {
    throw badRequest('INVALID_VEHICLE_TYPE', `Unknown vehicle type "${carType}"`, {
      allowed: VEHICLE_TYPES,
    });
  }

  const km = Number(distanceKm);
  if (!Number.isFinite(km) || km <= 0) {
    throw badRequest('INVALID_DISTANCE', 'Distance must be a positive number of kilometres');
  }
  if (km > RULES.maxDistanceKm) {
    throw badRequest('DISTANCE_TOO_LARGE', `Distance exceeds the ${RULES.maxDistanceKm} km limit`);
  }
  if (!['one-way', 'round-trip'].includes(tripType)) {
    throw badRequest('INVALID_TRIP_TYPE', 'tripType must be "one-way" or "round-trip"');
  }

  const chargeableKm = Math.max(0, km - vehicle.minKm);
  const distanceComponent = round2(chargeableKm * vehicle.perKmRate);
  let subtotal = round2(vehicle.base + distanceComponent);

  const roundTripApplied = tripType === 'round-trip';
  if (roundTripApplied) {
    subtotal = round2(subtotal * RULES.roundTripMultiplier);
  }

  const nightApplied = isNightPickup(pickupAt);
  const nightSurcharge = nightApplied
    ? round2((subtotal * RULES.nightSurchargePercent) / 100)
    : 0;

  const airportApplied = isAirportTrip(pickup, drop);
  const airportSurcharge = airportApplied ? RULES.airportSurcharge : 0;

  const extras = round2(Math.max(0, Number(tolls) || 0) + Math.max(0, Number(parking) || 0));
  const safeDiscount = Math.max(0, Number(discount) || 0);

  const preTax = round2(
    Math.max(0, subtotal + nightSurcharge + airportSurcharge + extras - safeDiscount)
  );
  const tax = round2((preTax * RULES.taxPercent) / 100);
  const total = Math.round(preTax + tax); // rupees, whole units

  return {
    total,
    currency: 'INR',
    breakdown: {
      vehicle: vehicle.label,
      carType,
      distanceKm: round2(km),
      baseFare: vehicle.base,
      includedKm: vehicle.minKm,
      chargeableKm: round2(chargeableKm),
      perKmRate: vehicle.perKmRate,
      distanceComponent,
      tripType,
      roundTripMultiplier: roundTripApplied ? RULES.roundTripMultiplier : 1,
      subtotal,
      nightSurcharge,
      nightSurchargeApplied: nightApplied,
      airportSurcharge,
      airportSurchargeApplied: airportApplied,
      tolls: Math.max(0, Number(tolls) || 0),
      parking: Math.max(0, Number(parking) || 0),
      discount: safeDiscount,
      taxPercent: RULES.taxPercent,
      tax,
      total,
    },
  };
}

/** Public tariff card for the marketing page — no computation, just rates. */
function tariffs() {
  return Object.entries(VEHICLES).map(([id, v]) => ({
    id,
    label: v.label,
    baseFare: v.base,
    perKmRate: v.perKmRate,
    includedKm: v.minKm,
    capacity: v.capacity,
  }));
}

module.exports = { quote, tariffs, VEHICLES, VEHICLE_TYPES, RULES };
