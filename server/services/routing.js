/**
 * Distance and ETA resolution (PHASE 10).
 *
 * The old client code did `Math.floor(Math.random() * 50) + 10` when it could
 * not resolve a distance, and the server then priced that random number. That
 * is gone. Distance is now resolved server-side by a configured provider, and
 * when a provider fails the request errors rather than inventing a number.
 *
 * Providers:
 *   google    — Google Routes/Distance Matrix (requires GOOGLE_MAPS_API_KEY)
 *   osrm      — public or self-hosted OSRM
 *   haversine — explicitly configured geometric fallback. Straight-line
 *               distance x HAVERSINE_ROAD_FACTOR. Documented and labelled in
 *               the response as an estimate, never silently presented as a
 *               routed distance.
 */
const env = require('../config/env');
const logger = require('../utils/logger');
const { badRequest, unavailable } = require('../utils/errors');

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function assertCoords(point, label) {
  if (
    !point ||
    typeof point.lat !== 'number' ||
    typeof point.lng !== 'number' ||
    Number.isNaN(point.lat) ||
    Number.isNaN(point.lng)
  ) {
    throw badRequest('INVALID_COORDINATES', `${label} coordinates are required`);
  }
  if (point.lat < -90 || point.lat > 90) {
    throw badRequest('INVALID_COORDINATES', `${label} latitude must be between -90 and 90`);
  }
  if (point.lng < -180 || point.lng > 180) {
    throw badRequest('INVALID_COORDINATES', `${label} longitude must be between -180 and 180`);
  }
}

/** Great-circle distance in kilometres. */
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.routing.timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function viaOsrm(pickup, drop) {
  const url =
    `${env.routing.osrmBaseUrl}/route/v1/driving/` +
    `${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}?overview=false&alternatives=false`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`OSRM responded ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(`OSRM returned code ${data.code}`);
  }
  const route = data.routes[0];
  return {
    distanceKm: route.distance / 1000,
    durationMinutes: route.duration / 60,
    provider: 'osrm',
    estimated: false,
  };
}

async function viaGoogle(pickup, drop) {
  const url =
    'https://maps.googleapis.com/maps/api/distancematrix/json' +
    `?origins=${pickup.lat},${pickup.lng}` +
    `&destinations=${drop.lat},${drop.lng}` +
    `&mode=driving&units=metric&key=${env.routing.googleMapsApiKey}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Google Distance Matrix responded ${res.status}`);
  const data = await res.json();
  if (data.status !== 'OK') throw new Error(`Google status ${data.status}`);
  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new Error(`Google element status ${element?.status || 'MISSING'}`);
  }
  return {
    distanceKm: element.distance.value / 1000,
    durationMinutes: element.duration.value / 60,
    provider: 'google',
    estimated: false,
  };
}

function viaHaversine(pickup, drop) {
  const straight = haversineKm(pickup, drop);
  const distanceKm = straight * env.routing.haversineRoadFactor;
  // ~35 km/h effective average including stops; coarse but explicit.
  const durationMinutes = (distanceKm / 35) * 60;
  return {
    distanceKm,
    durationMinutes,
    provider: 'haversine',
    estimated: true,
  };
}

/**
 * Resolve road distance and ETA between two coordinates.
 *
 * Throws SERVICE_UNAVAILABLE if the configured provider fails. It deliberately
 * does NOT silently downgrade to the geometric estimate — a fare built on a
 * guess must not be presented as a routed fare.
 */
async function resolveRoute(pickup, drop) {
  assertCoords(pickup, 'Pickup');
  assertCoords(drop, 'Drop');

  const provider = env.routing.provider;

  if (provider === 'haversine') {
    const result = viaHaversine(pickup, drop);
    return { ...result, distanceKm: Number(result.distanceKm.toFixed(2)), durationMinutes: Math.round(result.durationMinutes) };
  }

  try {
    const result = provider === 'google'
      ? await viaGoogle(pickup, drop)
      : await viaOsrm(pickup, drop);
    return {
      ...result,
      distanceKm: Number(result.distanceKm.toFixed(2)),
      durationMinutes: Math.round(result.durationMinutes),
    };
  } catch (err) {
    logger.error('Routing provider failed', { provider, error: err.message });
    throw unavailable(
      'ROUTING_UNAVAILABLE',
      'We could not calculate the route for this trip right now. Please try again shortly.'
    );
  }
}

module.exports = { resolveRoute, haversineKm, assertCoords };
