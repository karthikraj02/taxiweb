import React, { useState, useEffect } from 'react';
import etiosImg from '../img/etios.png';
import dzireImg from '../img/maruti_desire.png';
import innovaImg from '../img/toyota_innova.png';
import tempoImg from '../img/tt.png';
import { quoteTrip, unwrap, apiError } from '../api/index.js';
import { Arrow, Swap } from './Icons.jsx';
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
    <div className="section">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Book online</span>
          <h2 className="section-title">Get your fare in seconds</h2>
          <p className="section-subtitle">Choose your pickup and drop, pick a vehicle and see the price before you book.</p>
        </div>

        <div className="chips" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
          {POPULAR_ROUTES.map(route => (
            <button key={route.label} className="chip" onClick={() => handleRoute(route)}>
              {route.label}
            </button>
          ))}
        </div>

        <div className="panel">
          {/* Only shown when there is something real to say */}
          {error && <div className="alert-error" role="alert">{error}</div>}

          <div className="segmented" role="tablist" aria-label="Trip type">
            {['one-way', 'round-trip'].map(type => (
              <button
                key={type}
                role="tab"
                aria-selected={tripType === type}
                className={tripType === type ? 'active' : ''}
                onClick={() => { setTripType(type); setQuote(null); }}
              >
                {type === 'one-way' ? <><Arrow size={16} /> One way</> : <><Swap size={16} /> Round trip</>}
              </button>
            ))}
          </div>

          <div className="form-grid">
            <div className="input-group" style={{ position: 'relative' }}>
              <label htmlFor="pickup-input">Pickup location</label>
              <input
                id="pickup-input"
                className="input"
                placeholder="e.g. Udupi Bus Stand"
                value={pickup}
                autoComplete="off"
                aria-expanded={showPickupSugg}
                aria-describedby="pickup-hint"
                onChange={e => { setPickup(e.target.value); setPickupCoords(null); setShowPickupSugg(true); }}
                onFocus={() => setShowPickupSugg(true)}
                onBlur={() => setTimeout(() => setShowPickupSugg(false), 200)}
              />
              {pickupCoords && <span id="pickup-hint" className="field-ok">Location set</span>}
              {showPickupSugg && searchKnownPlaces(pickup).length > 0 && (
                <ul className="suggestions-list" role="listbox">
                  {searchKnownPlaces(pickup).map(place => (
                    <li key={place.label} role="option" className="suggestion-item" onMouseDown={() => selectPlace(place, 'pickup')}>
                      {place.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="input-group" style={{ position: 'relative' }}>
              <label htmlFor="drop-input">Drop location</label>
              <input
                id="drop-input"
                className="input"
                placeholder="e.g. Mangalore Airport"
                value={drop}
                autoComplete="off"
                aria-expanded={showDropSugg}
                onChange={e => { setDrop(e.target.value); setDropCoords(null); setShowDropSugg(true); }}
                onFocus={() => setShowDropSugg(true)}
                onBlur={() => setTimeout(() => setShowDropSugg(false), 200)}
              />
              {dropCoords && <span className="field-ok">Location set</span>}
              {showDropSugg && searchKnownPlaces(drop).length > 0 && (
                <ul className="suggestions-list" role="listbox">
                  {searchKnownPlaces(drop).map(place => (
                    <li key={place.label} role="option" className="suggestion-item" onMouseDown={() => selectPlace(place, 'drop')}>
                      {place.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="input-group">
              <label htmlFor="date-input">Date</label>
              <input id="date-input" className="input" type="date" min={today} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="input-group">
              <label htmlFor="time-input">Time</label>
              <input id="time-input" className="input" type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
            <div className="input-group">
              <label htmlFor="passengers-input">Passengers</label>
              <input
                id="passengers-input"
                className="input" type="number" min="1" max="12"
                value={passengerCount}
                onChange={e => setPassengerCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>

          <span className="field-label" style={{ marginTop: '0.5rem' }}>Vehicle</span>
          <div className="car-options">
            {CAR_TYPES.map(car => (
              <button
                key={car.id}
                className={`car-option${carType === car.id ? ' selected' : ''}`}
                aria-pressed={carType === car.id}
                onClick={() => { setCarType(car.id); setQuote(null); }}
              >
                <img src={car.image} alt="" />
                <b>{car.label}</b>
                <span>{car.rate} · min {car.min}</span>
              </button>
            ))}
          </div>

          {/* Every figure here comes from the server */}
          {quote && (
            <div className="fare-box">
              <div>
                <div className="label">Estimated fare</div>
                <div className="amount">₹{quote.fare.toLocaleString()}</div>
                <div className="note">
                  {quote.distanceKm} km · approx {Math.round(quote.durationMinutes)} min
                  {quote.breakdown?.roundTripMultiplier > 1 && ' · round trip'}
                </div>
                <div className="note" style={{ marginTop: '0.25rem' }}>
                  Base ₹{quote.breakdown?.baseFare} (incl. {quote.breakdown?.includedKm} km)
                  {quote.breakdown?.chargeableKm > 0 && ` + ${quote.breakdown.chargeableKm} km @ ₹${quote.breakdown.perKmRate}/km`}
                  {quote.breakdown?.nightSurcharge > 0 && ` + ₹${quote.breakdown.nightSurcharge} night`}
                  {quote.breakdown?.airportSurcharge > 0 && ` + ₹${quote.breakdown.airportSurcharge} airport`}
                  {quote.breakdown?.tax > 0 && ` + ₹${quote.breakdown.tax} tax`}
                </div>
              </div>
              <span className="badge">{quote.distanceEstimated ? 'Distance estimated' : 'Route confirmed'}</span>
            </div>
          )}

          <div className="actions">
            <button className="btn btn-secondary btn-lg" onClick={handleEstimate} disabled={loading} style={{ flex: 1, minWidth: '150px' }}>
              {loading ? <span className="spinner-light" /> : 'Get estimate'}
            </button>
            <button className="btn btn-primary btn-lg" onClick={handleBookNow} style={{ flex: 2, minWidth: '180px' }}>
              Book now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
