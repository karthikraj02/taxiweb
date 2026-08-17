const pricing = require('../../services/pricing');

describe('Pricing service (server-authoritative fare)', () => {
  it('charges the base fare inside the included distance', () => {
    const { total, breakdown } = pricing.quote({ carType: 'dzire', distanceKm: 30 });
    expect(breakdown.chargeableKm).toBe(0);
    // 650 base + 5% tax
    expect(total).toBe(Math.round(650 * 1.05));
  });

  it('charges per km beyond the included distance', () => {
    const { breakdown } = pricing.quote({ carType: 'dzire', distanceKm: 60 });
    expect(breakdown.chargeableKm).toBe(10);
    expect(breakdown.distanceComponent).toBe(130);   // 10 km x 13
    expect(breakdown.subtotal).toBe(780);            // 650 + 130
  });

  it('applies the round-trip multiplier', () => {
    const oneWay = pricing.quote({ carType: 'dzire', distanceKm: 60 });
    const round = pricing.quote({ carType: 'dzire', distanceKm: 60, tripType: 'round-trip' });
    expect(round.breakdown.subtotal).toBeCloseTo(oneWay.breakdown.subtotal * 1.9, 2);
    expect(round.total).toBeGreaterThan(oneWay.total);
  });

  it('is deterministic — the same input always yields the same fare', () => {
    const input = { carType: 'innova', distanceKm: 87.4, tripType: 'one-way' };
    const runs = Array.from({ length: 20 }, () => pricing.quote(input).total);
    expect(new Set(runs).size).toBe(1);
  });

  it('applies a night surcharge inside the night window', () => {
    const night = new Date(); night.setHours(23, 0, 0, 0);
    const day = new Date(); day.setHours(13, 0, 0, 0);

    const atNight = pricing.quote({ carType: 'dzire', distanceKm: 60, pickupAt: night });
    const atNoon = pricing.quote({ carType: 'dzire', distanceKm: 60, pickupAt: day });

    expect(atNight.breakdown.nightSurchargeApplied).toBe(true);
    expect(atNoon.breakdown.nightSurchargeApplied).toBe(false);
    expect(atNight.total).toBeGreaterThan(atNoon.total);
  });

  it('applies an airport surcharge when either endpoint is an airport', () => {
    const q = pricing.quote({
      carType: 'dzire', distanceKm: 60,
      pickup: 'Udupi Bus Stand', drop: 'Mangalore Airport (IXE)',
    });
    expect(q.breakdown.airportSurchargeApplied).toBe(true);
    expect(q.breakdown.airportSurcharge).toBeGreaterThan(0);
  });

  it('rejects an unknown vehicle type', () => {
    expect(() => pricing.quote({ carType: 'spaceship', distanceKm: 10 }))
      .toThrow(expect.objectContaining({ code: 'INVALID_VEHICLE_TYPE' }));
  });

  it.each([0, -5, NaN, Infinity, null, undefined, 'abc'])(
    'rejects a non-positive or non-numeric distance: %p',
    (distanceKm) => {
      expect(() => pricing.quote({ carType: 'dzire', distanceKm }))
        .toThrow(expect.objectContaining({ code: 'INVALID_DISTANCE' }));
    }
  );

  it('rejects an absurd distance rather than pricing it', () => {
    expect(() => pricing.quote({ carType: 'dzire', distanceKm: 999999 }))
      .toThrow(expect.objectContaining({ code: 'DISTANCE_TOO_LARGE' }));
  });

  it('never returns a negative total even with a huge discount', () => {
    const { total } = pricing.quote({ carType: 'dzire', distanceKm: 60, discount: 999999 });
    expect(total).toBeGreaterThanOrEqual(0);
  });

  it('ignores negative tolls and parking used as a discount vector', () => {
    const clean = pricing.quote({ carType: 'dzire', distanceKm: 60 });
    const tampered = pricing.quote({ carType: 'dzire', distanceKm: 60, tolls: -5000, parking: -5000 });
    expect(tampered.total).toBe(clean.total);
  });

  it('exposes an itemised breakdown that sums to the total', () => {
    const { breakdown, total } = pricing.quote({
      carType: 'innova', distanceKm: 120, tripType: 'one-way', tolls: 50, parking: 20,
    });
    const preTax = breakdown.subtotal + breakdown.nightSurcharge
      + breakdown.airportSurcharge + breakdown.tolls + breakdown.parking - breakdown.discount;
    expect(Math.round(preTax + breakdown.tax)).toBe(total);
  });
});
