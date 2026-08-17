import React, { useState, useEffect } from 'react';
import etiosImg from '../img/etios.png';
import dzireImg from '../img/maruti_desire.png';
import innovaImg from '../img/toyota_innova.png';
import tempoImg from '../img/tt.png';
import { quoteTrip, unwrap, apiError } from '../api/index.js';
import { searchKnownPlaces, resolvePlace, KNOWN_PLACES } from '../utils/geocode.js';

const CAR_TYPES = [
  { id: 'etios', label: 'Toyota Etios', image: etiosImg, rate: '₹12/km', min: '₹600' },
  { id: 'dzire', label: 'Maruti Dzire', image: dzireImg, rate: '₹13/km', min: '₹650' },
  { id: 'innova', label: 'Toyota Innova', image: innovaImg, rate: '₹18/km', min: '₹1100' },
  { id: 'tempo', label: 'Tempo Traveller', image: tempoImg, rate: '₹25/km', min: '₹2500' },
];

/** Popular routes now carry coordinates; the server derives the distance. */
const POPULAR_ROUTES = [
  { label: 'Udupi → Mangalore', pickup: 'Udupi Bus Stand', drop: 'Mangalore Central Station' },
  { label: 'Udupi → Mangalore Airport', pickup: 'Udupi Bus Stand', drop: 'Mangalore Airport (IXE)' },
  { label: 'Udupi → Bangalore', pickup: 'Udupi Bus Stand', drop: 'Bangalore (Majestic)' },
  { label: 'Udupi → Murudeshwara', pickup: 'Udupi Bus Stand', drop: 'Murudeshwara' },
];

export default function RideBooking({ onBookNow }) {
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropCoords, setDropCoords] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [carType, setCarType] = useState('etios');
  const [tripType, setTripType] = useState('one-way');
  const [passengerCount, setPassengerCount] = useState(1);

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPickupSugg, setShowPickupSugg] = useState(false);
  const [showDropSugg, setShowDropSugg] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Any change to the trip invalidates the quote, so a stale fare can never be
  // carried into the booking step.
  useEffect(() => { setQuote(null); }, [pickupCoords, dropCoords, carType, tripType, date, time, passengerCount]);

  const selectPlace = (place, which) => {
    if (which === 'pickup') {
      setPickup(place.label);
      setPickupCoords({ lat: place.lat, lng: place.lng });
      setShowPickupSugg(false);
    } else {
      setDrop(place.label);
      setDropCoords({ lat: place.lat, lng: place.lng });
      setShowDropSugg(false);
    }
    setError(null);
  };

  const handleRoute = async (route) => {
    const from = KNOWN_PLACES.find(p => p.label === route.pickup);
    const to = KNOWN_PLACES.find(p => p.label === route.drop);
    if (from) selectPlace(from, 'pickup');
    if (to) selectPlace(to, 'drop');
  };

  /** Combines the date and time inputs into an ISO instant for the server. */
  const scheduledForISO = () => {
    if (!date) return null;
    const iso = new Date(`${date}T${time || '09:00'}:00`);
    return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
  };

  /**
   * Resolves any free text the user typed but did not pick from the list.
   * Returns null and sets an error if a place cannot be resolved — the old code
   * silently substituted `Math.floor(Math.random() * 50) + 10` km here.
   */
  const ensureCoords = async () => {
    let p = pickupCoords;
    let d = dropCoords;

    if (!p && pickup) {
      const resolved = await resolvePlace(pickup);
      if (resolved) { p = { lat: resolved.lat, lng: resolved.lng }; setPickupCoords(p); }
    }
    if (!d && drop) {
      const resolved = await resolvePlace(drop);
      if (resolved) { d = { lat: resolved.lat, lng: resolved.lng }; setDropCoords(d); }
    }

    if (!p || !d) {
      setError('Pick your locations from the suggestions so we can calculate an accurate fare.');
      return null;
    }
    return { p, d };
  };

  const handleEstimate = async () => {
    setError(null);
    const scheduledFor = scheduledForISO();
    if (!scheduledFor) { setError('Choose a pickup date first.'); return; }

    setLoading(true);
    try {
      const coords = await ensureCoords();
      if (!coords) return;

      // The server resolves the route and prices it. This is the same code
      // path that will later charge the card, so the number shown here is the
      // number that gets billed.
      const data = unwrap(await quoteTrip({
        pickup, drop,
        pickupCoords: coords.p, dropCoords: coords.d,
        carType, tripType, scheduledFor, passengerCount,
      }));
      setQuote(data);
    } catch (err) {
      setError(apiError(err, 'We could not calculate a fare for that trip.'));
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = async () => {
    setError(null);
    const scheduledFor = scheduledForISO();
    if (!pickup || !drop) { setError('Enter a pickup and drop location.'); return; }
    if (!scheduledFor) { setError('Choose a pickup date.'); return; }

    const coords = await ensureCoords();
    if (!coords) return;

    onBookNow(carType, {
      pickup, drop,
      pickupCoords: coords.p, dropCoords: coords.d,
      date, time, carType, tripType, passengerCount,
      quote,
    });
  };

  return (
    <div className="section" style={{ background: 'linear-gradient(180deg, var(--bg-dark) 0%, #080f20 100%)', position: 'relative', overflow: 'hidden' }}>
      <div className="cyber-grid-bg" style={{ opacity: 0.3 }} />
      <style>{`
        .suggestions-list {
          position: absolute; top: 100%; left: 0; right: 0;
          background: rgba(8,18,42,0.95);
          border: 1px solid rgba(0,212,255,0.2);
          border-radius: 0.4rem; z-index: 10; margin-top: 0.25rem;
          list-style: none; padding: 0.25rem;
          box-shadow: 0 8px 30px rgba(0,0,0,0.6), 0 0 15px rgba(0,212,255,0.05);
          backdrop-filter: blur(16px);
        }
        .suggestion-item {
          padding: 0.6rem 1rem; cursor: pointer; color: var(--text-light);
          transition: background 0.2s; border-radius: 0.25rem;
          font-size: 0.85rem; font-family: 'Rajdhani', sans-serif; font-weight: 500;
        }
        .suggestion-item:hover { background: rgba(0,212,255,0.08); color: var(--primary); }
        .billing-warning {
          background: rgba(255,170,0,0.06);
          border: 1px solid rgba(255,170,0,0.25);
          border-radius: 0.5rem;
          padding: 0.75rem 1.25rem; margin-bottom: 2rem;
          color: var(--warn); font-size: 0.83rem;
          display: flex; align-items: center; gap: 0.75rem;
          font-family: 'Rajdhani', sans-serif;
        }
      `}</style>
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <div className="badge" style={{ marginBottom: '1rem' }}>🚕 Instant Booking</div>
        </div>
        <h2 className="section-title">Book Your <span>Ride</span></h2>

        {/* Error / guidance banner. Only shown when there is something real to say. */}
        {error && (
          <div className="billing-warning" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        <p className="section-subtitle">Fast, reliable, and comfortable taxi service from Udupi</p>

        {/* Popular Routes */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'center', marginBottom: '2.5rem' }}>
          {POPULAR_ROUTES.map(route => (
            <button
              key={route.label}
              onClick={() => handleRoute(route)}
              style={{
                background: 'rgba(8,18,42,0.7)',
                border: '1px solid rgba(0,212,255,0.15)',
                color: 'var(--text-muted)', padding: '0.45rem 1rem', borderRadius: '0.35rem',
                cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.82rem',
                fontWeight: 600, letterSpacing: '0.04em',
                transition: 'all 0.25s', backdropFilter: 'blur(8px)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(0,212,255,0.4)';
                e.currentTarget.style.color = 'var(--primary)';
                e.currentTarget.style.background = 'rgba(0,212,255,0.06)';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(0,212,255,0.1)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(0,212,255,0.15)';
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.background = 'rgba(8,18,42,0.7)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              📍 {route.label}
            </button>
          ))}
        </div>

        <div style={{
          background: 'rgba(8,18,42,0.8)',
          border: '1px solid rgba(0,212,255,0.15)',
          borderRadius: '0.75rem', padding: '2rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 30px rgba(0,212,255,0.04)',
          maxWidth: '900px', margin: '0 auto',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Top gradient line */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--primary), var(--secondary), transparent)' }} />

          {/* Trip Type Toggle */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {['one-way', 'round-trip'].map(type => (
              <button
                key={type}
                onClick={() => { setTripType(type); setQuote(null); }}
                style={{
                  padding: '0.5rem 1.25rem', borderRadius: '0.35rem',
                  cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700,
                  fontSize: '0.85rem', transition: 'all 0.2s', letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: tripType === type
                    ? 'linear-gradient(135deg, var(--primary), var(--secondary))'
                    : 'rgba(0,212,255,0.04)',
                  color: tripType === type ? '#fff' : 'var(--text-muted)',
                  border: tripType === type ? 'none' : '1px solid rgba(0,212,255,0.1)',
                  boxShadow: tripType === type ? '0 0 15px rgba(0,212,255,0.25)' : 'none',
                }}
              >
                {type === 'one-way' ? '→ One Way' : '↔ Round Trip'}
              </button>
            ))}
          </div>

          {/* Form Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="input-group" style={{ position: 'relative' }}>
              <label htmlFor="pickup-input">📍 Pickup Location</label>
              <input
                id="pickup-input"
                className="input"
                placeholder="From (e.g., Udupi Bus Stand)"
                value={pickup}
                autoComplete="off"
                aria-expanded={showPickupSugg}
                aria-describedby="pickup-hint"
                onChange={e => { setPickup(e.target.value); setPickupCoords(null); setShowPickupSugg(true); }}
                onFocus={() => setShowPickupSugg(true)}
                onBlur={() => setTimeout(() => setShowPickupSugg(false), 200)}
              />
              {pickupCoords && (
                <span id="pickup-hint" style={{ fontSize: '0.68rem', color: 'var(--accent)', fontFamily: 'Rajdhani, sans-serif' }}>
                  ✓ Location set
                </span>
              )}
              {showPickupSugg && searchKnownPlaces(pickup).length > 0 && (
                <ul className="suggestions-list" role="listbox">
                  {searchKnownPlaces(pickup).map(place => (
                    <li
                      key={place.label}
                      role="option"
                      className="suggestion-item"
                      onMouseDown={() => selectPlace(place, 'pickup')}
                    >
                      {place.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="input-group" style={{ position: 'relative' }}>
              <label htmlFor="drop-input">🏁 Drop Location</label>
              <input
                id="drop-input"
                className="input"
                placeholder="To (e.g., Mangalore Airport)"
                value={drop}
                autoComplete="off"
                aria-expanded={showDropSugg}
                onChange={e => { setDrop(e.target.value); setDropCoords(null); setShowDropSugg(true); }}
                onFocus={() => setShowDropSugg(true)}
                onBlur={() => setTimeout(() => setShowDropSugg(false), 200)}
              />
              {dropCoords && (
                <span style={{ fontSize: '0.68rem', color: 'var(--accent)', fontFamily: 'Rajdhani, sans-serif' }}>
                  ✓ Location set
                </span>
              )}
              {showDropSugg && searchKnownPlaces(drop).length > 0 && (
                <ul className="suggestions-list" role="listbox">
                  {searchKnownPlaces(drop).map(place => (
                    <li
                      key={place.label}
                      role="option"
                      className="suggestion-item"
                      onMouseDown={() => selectPlace(place, 'drop')}
                    >
                      {place.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="input-group">
              <label>📅 Date</label>
              <input className="input" type="date" min={today} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="input-group">
              <label>⏰ Time</label>
              <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
            <div className="input-group">
              <label htmlFor="passengers-input">👥 Passengers</label>
              <input
                id="passengers-input"
                className="input" type="number" min="1" max="12"
                value={passengerCount}
                onChange={e => setPassengerCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>

          {/* Car Type Selector */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.875rem', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>🚗 Select Car Type</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
              {CAR_TYPES.map(car => (
                <button
                  key={car.id}
                  onClick={() => { setCarType(car.id); setQuote(null); }}
                  style={{
                    padding: '0.875rem', borderRadius: '0.5rem', cursor: 'pointer',
                    fontFamily: 'Rajdhani, sans-serif', textAlign: 'center', transition: 'all 0.25s',
                    background: carType === car.id ? 'rgba(0,212,255,0.08)' : 'rgba(0,212,255,0.02)',
                    border: carType === car.id ? '2px solid var(--primary)' : '1px solid rgba(0,212,255,0.12)',
                    color: 'var(--text-light)',
                    boxShadow: carType === car.id ? '0 0 15px rgba(0,212,255,0.15)' : 'none',
                  }}
                >
                  <div style={{ marginBottom: '0.4rem', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={car.image} alt={car.label} style={{ height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.15rem', letterSpacing: '0.04em' }}>{car.label}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 600 }}>{car.rate} · Min {car.min}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fare Estimate — every figure here comes from the server */}
          {quote && (
            <div style={{
              background: 'rgba(0,212,255,0.05)',
              border: '1px solid rgba(0,212,255,0.2)',
              borderRadius: '0.5rem', padding: '1rem 1.25rem', marginBottom: '1.5rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
            }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.2rem', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Estimated Fare
                </div>
                <div style={{
                  fontSize: '2.2rem', fontWeight: 800, color: 'var(--primary)',
                  fontFamily: 'Orbitron, sans-serif',
                  textShadow: '0 0 20px rgba(0,212,255,0.4)',
                }}>₹{quote.fare.toLocaleString()}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif' }}>
                  {quote.distanceKm} km · approx {Math.round(quote.durationMinutes)} min
                  {quote.breakdown?.roundTripMultiplier > 1 && ' · round trip'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif', marginTop: '0.3rem' }}>
                  Base ₹{quote.breakdown?.baseFare} (incl. {quote.breakdown?.includedKm} km)
                  {quote.breakdown?.chargeableKm > 0 && ` + ${quote.breakdown.chargeableKm} km @ ₹${quote.breakdown.perKmRate}/km`}
                  {quote.breakdown?.nightSurcharge > 0 && ` + ₹${quote.breakdown.nightSurcharge} night`}
                  {quote.breakdown?.airportSurcharge > 0 && ` + ₹${quote.breakdown.airportSurcharge} airport`}
                  {quote.breakdown?.tax > 0 && ` + ₹${quote.breakdown.tax} tax`}
                </div>
              </div>
              <div className="badge">
                {quote.distanceEstimated ? '≈ Distance estimated' : '✓ Route confirmed'}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handleEstimate} disabled={loading} style={{ flex: '1', minWidth: '140px', justifyContent: 'center' }}>
              {loading ? <span className="spinner-light" /> : '💰 Get Estimate'}
            </button>
            <button className="btn btn-primary" onClick={handleBookNow} style={{ flex: '2', minWidth: '180px', justifyContent: 'center', fontWeight: 700 }}>
              🚕 Book Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}