const routing = require('../../services/routing');

const UDUPI = { lat: 13.3409, lng: 74.7421 };
const MANGALORE = { lat: 12.9141, lng: 74.8560 };

describe('Routing service (no random distance)', () => {
  it('computes a plausible great-circle distance', () => {
    const km = routing.haversineKm(UDUPI, MANGALORE);
    // Udupi to Mangalore is roughly 48 km straight line.
    expect(km).toBeGreaterThan(40);
    expect(km).toBeLessThan(60);
  });

  it('returns zero for identical points', () => {
    expect(routing.haversineKm(UDUPI, UDUPI)).toBeCloseTo(0, 5);
  });

  it('is symmetric', () => {
    expect(routing.haversineKm(UDUPI, MANGALORE))
      .toBeCloseTo(routing.haversineKm(MANGALORE, UDUPI), 6);
  });

  /**
   * The original client did `Math.floor(Math.random() * 50) + 10` whenever it
   * could not resolve a distance, and the server priced that number. Repeated
   * resolution of the same route must be identical.
   */
  it('is deterministic for the same coordinates', async () => {
    const runs = [];
    for (let i = 0; i < 10; i++) {
      runs.push((await routing.resolveRoute(UDUPI, MANGALORE)).distanceKm);
    }
    expect(new Set(runs).size).toBe(1);
  });

  it('labels the geometric fallback as an estimate', async () => {
    const route = await routing.resolveRoute(UDUPI, MANGALORE);
    expect(route.provider).toBe('haversine');
    expect(route.estimated).toBe(true);
  });

  it('applies the configured road factor rather than raw straight-line distance', async () => {
    const straight = routing.haversineKm(UDUPI, MANGALORE);
    const route = await routing.resolveRoute(UDUPI, MANGALORE);
    expect(route.distanceKm).toBeGreaterThan(straight);
  });

  it('returns a positive ETA', async () => {
    const route = await routing.resolveRoute(UDUPI, MANGALORE);
    expect(route.durationMinutes).toBeGreaterThan(0);
  });

  it.each([
    [{ lat: 91, lng: 0 }, 'latitude above range'],
    [{ lat: -91, lng: 0 }, 'latitude below range'],
    [{ lat: 0, lng: 181 }, 'longitude above range'],
    [{ lat: 0, lng: -181 }, 'longitude below range'],
    [{ lat: 'abc', lng: 0 }, 'non-numeric latitude'],
    [null, 'missing point'],
  ])('rejects invalid coordinates (%s)', async (bad) => {
    await expect(routing.resolveRoute(bad, MANGALORE))
      .rejects.toThrow(expect.objectContaining({ code: 'INVALID_COORDINATES' }));
  });
});
