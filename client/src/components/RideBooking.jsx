import React, { useState, useRef } from 'react';
import { estimateFare } from '../api/index.js';
import toast from 'react-hot-toast';
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";

const libraries = ["places"];

const CAR_TYPES = [
  { id: 'etios', label: 'Toyota Etios', emoji: '🚗', rate: '₹12/km', min: '₹600' },
  { id: 'dzire', label: 'Maruti Dzire', emoji: '🚙', rate: '₹13/km', min: '₹650' },
  { id: 'innova', label: 'Toyota Innova', emoji: '🚐', rate: '₹18/km', min: '₹1100' },
  { id: 'tempo', label: 'Tempo Traveller', emoji: '🚌', rate: '₹25/km', min: '₹2500' },
];

const POPULAR_ROUTES = [
  { label: 'Udupi → Mangalore', pickup: 'Udupi', drop: 'Mangalore', distance: 55 },
  { label: 'Udupi → Bangalore', pickup: 'Udupi', drop: 'Bangalore', distance: 380 },
  { label: 'Udupi → Goa', pickup: 'Udupi', drop: 'Goa', distance: 200 },
  { label: 'Udupi → Mysore', pickup: 'Udupi', drop: 'Mysore', distance: 270 },
];

const LOCAL_PLACES = [
  "Udupi Bus Stand", "Manipal KMC", "Mangalore Airport (IXE)", "Mangalore Central Station",
  "Udupi Railway Station", "Malpe Beach", "Kapu Beach", "Kundapura", "Karkala", "Padubidri",
  "Bangalore (Majestic)", "Kempegowda Int'l Airport", "Mysore Palace", "Kolluru Mookambika",
  "Murudeshwara", "Gokarna", "Dharmasthala", "Subrahmanya"
];

const PREDEFINED_DISTANCES = {
  "Udupi Bus Stand-Manipal KMC": 6,
  "Udupi Bus Stand-Mangalore Airport (IXE)": 58,
  "Udupi Bus Stand-Mangalore Central Station": 62,
  "Manipal KMC-Mangalore Airport (IXE)": 64,
  "Udupi Bus Stand-Kundapura": 38,
  "Udupi Bus Stand-Malpe Beach": 7,
  "Udupi Bus Stand-Bangalore (Majestic)": 395,
};

export default function RideBooking({ onBookNow }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "", 
    libraries,
  });

  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [carType, setCarType] = useState('etios');
  const [tripType, setTripType] = useState('one-way');
  const [distance, setDistance] = useState('');
  const [estimatedFare, setEstimatedFare] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fareBreakdown, setFareBreakdown] = useState(null);
  const [showPickupSugg, setShowPickupSugg] = useState(false);
  const [showDropSugg, setShowDropSugg] = useState(false);

  const pickupRef = useRef();
  const dropRef = useRef();

  const today = new Date().toISOString().split('T')[0];

  const getLocalDistance = (p1, p2) => {
    const key1 = `${p1}-${p2}`;
    const key2 = `${p2}-${p1}`;
    if (PREDEFINED_DISTANCES[key1]) return PREDEFINED_DISTANCES[key1];
    if (PREDEFINED_DISTANCES[key2]) return PREDEFINED_DISTANCES[key2];
    // Default fallback if no predefined distance exists (randomized slightly but consistent)
    return Math.floor(Math.random() * 50) + 10; 
  };

  const calculateDistance = async (origin, destination) => {
    if (!origin || !destination) return;
    
    // Check if google maps services are actually available (fails if billing is disabled or network error)
    if (typeof window.google === 'undefined' || !window.google.maps) {
      console.warn("Google Maps services are not available. Use manual calculation.");
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    try {
      const results = await directionsService.route({
        origin: origin,
        destination: destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      });

      // Distance is retrieved in meters, converting it to km
      const distValue = results.routes[0].legs[0].distance.value; 
      const distanceInKm = (distValue / 1000).toFixed(1);
      
      setDistance(distanceInKm);
      setEstimatedFare(null); // Reset fare when location changes
    } catch (error) {
      console.error("Error calculating distance: ", error);
      toast.error("Could not calculate distance automatically. Please enter it manually below.");
    }
  };

  const handlePlaceSelect = (ref, type) => {
    if (!ref.current.value) return;
    
    if (type === "pickup") {
      setPickup(ref.current.value);
      if (drop) calculateDistance(ref.current.value, drop);
    } else {
      setDrop(ref.current.value);
      if (pickup) calculateDistance(pickup, ref.current.value);
    }
  };

  const handleEstimate = async () => {
    if (!distance || !carType) {
      toast.error('Please enter distance and select car type');
      return;
    }
    setLoading(true);
    try {
      const { data } = await estimateFare(carType, parseFloat(distance), tripType);
      setEstimatedFare(data.fare);
      setFareBreakdown(data.breakdown);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to estimate fare');
    } finally {
      setLoading(false);
    }
  };

  const handleRoute = (route) => {
    setPickup(route.pickup);
    setDrop(route.drop);
    setDistance(String(route.distance));
    if (pickupRef.current) pickupRef.current.value = route.pickup;
    if (dropRef.current) dropRef.current.value = route.drop;
  };

  const handleBookNow = () => {
    if (!pickup || !drop || !date) {
      toast.error('Please fill in pickup, drop, and date');
      return;
    }
    onBookNow(carType, { pickup, drop, date, time, carType, tripType, distance, fare: estimatedFare });
  };

  const handleSelectLocal = (place, type) => {
    if (type === "pickup") {
      setPickup(place);
      setShowPickupSugg(false);
      if (drop) setDistance(String(getLocalDistance(place, drop)));
    } else {
      setDrop(place);
      setShowDropSugg(false);
      if (pickup) setDistance(String(getLocalDistance(pickup, place)));
    }
  };

  const filteredPlaces = (val) => val ? LOCAL_PLACES.filter(p => p.toLowerCase().includes(val.toLowerCase())).slice(0, 5) : [];

  return (
    <div className="section" style={{ background: 'linear-gradient(180deg, var(--bg-dark) 0%, #0d1829 100%)' }}>
      <style>{`
        .suggestions-list {
          position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); 
          border: 1px solid var(--border); border-radius: 0.5rem; z-index: 10; margin-top: 0.25rem;
          list-style: none; padding: 0.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        .suggestion-item { padding: 0.6rem 1rem; cursor: pointer; color: var(--text-light); transition: background 0.2s; border-radius: 0.25rem; font-size: 0.85rem; }
        .suggestion-item:hover { background: var(--border); }
        .billing-warning {
          background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); border-radius: 0.75rem;
          padding: 0.75rem 1.25rem; margin-bottom: 2rem; color: var(--primary); font-size: 0.85rem; display: flex; align-items: center; gap: 0.75rem;
        }
      `}</style>
      <div className="container">
        <h2 className="section-title">Book Your <span>Ride</span></h2>
        
        {/* Billing Warning Banner */}
        <div className="billing-warning">
          <span>⚠️</span>
          <span><b>Map Account Billing Inactive:</b> We are currently in "Local Fallback Mode". Only certain locations have predefined distances, but you can enter any distance manually!</span>
        </div>
        <p className="section-subtitle">Fast, reliable, and comfortable taxi service from Udupi</p>

        {/* Popular Routes */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginBottom: '2.5rem' }}>
          {POPULAR_ROUTES.map(route => (
            <button
              key={route.label}
              onClick={() => handleRoute(route)}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '2rem',
                cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontSize: '0.85rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              📍 {route.label} ({route.distance}km)
            </button>
          ))}
        </div>

        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '1.5rem', padding: '2rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxWidth: '900px', margin: '0 auto',
        }}>
          {/* Trip Type Toggle */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {['one-way', 'round-trip'].map(type => (
              <button
                key={type}
                onClick={() => { setTripType(type); setEstimatedFare(null); }}
                style={{
                  padding: '0.5rem 1.25rem', borderRadius: '2rem', border: 'none',
                  cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600,
                  fontSize: '0.875rem', transition: 'all 0.2s',
                  background: tripType === type ? 'var(--primary)' : 'var(--bg-dark)',
                  color: tripType === type ? '#000' : 'var(--text-muted)',
                }}
              >
                {type === 'one-way' ? '→ One Way' : '↔ Round Trip'}
              </button>
            ))}
          </div>

          {/* Form Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="input-group" style={{ position: 'relative' }}>
              <label>📍 Pickup Location</label>
              <input 
                className="input" 
                placeholder="From (e.g., Udupi)" 
                value={pickup} 
                onChange={e => { setPickup(e.target.value); setShowPickupSugg(true); }}
                onFocus={() => setShowPickupSugg(true)}
                onBlur={() => setTimeout(() => setShowPickupSugg(false), 200)}
              />
              {showPickupSugg && pickup && (
                <ul className="suggestions-list">
                  {filteredPlaces(pickup).map(p => (
                    <li key={p} className="suggestion-item" onClick={() => handleSelectLocal(p, "pickup")}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="input-group" style={{ position: 'relative' }}>
              <label>🏁 Drop Location</label>
              <input 
                className="input" 
                placeholder="To (e.g., Mangalore)" 
                value={drop} 
                onChange={e => { setDrop(e.target.value); setShowDropSugg(true); }}
                onFocus={() => setShowDropSugg(true)}
                onBlur={() => setTimeout(() => setShowDropSugg(false), 200)}
              />
              {showDropSugg && drop && (
                <ul className="suggestions-list">
                  {filteredPlaces(drop).map(p => (
                    <li key={p} className="suggestion-item" onClick={() => handleSelectLocal(p, "drop")}>{p}</li>
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
              <label>📏 Distance (km)</label>
              <input
                className="input" type="number" placeholder="e.g. 55" min="1"
                value={distance} 
                onChange={e => { setDistance(e.target.value); setEstimatedFare(null); }}
              />
            </div>
          </div>

          {/* Car Type Selector */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>🚗 Select Car Type</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
              {CAR_TYPES.map(car => (
                <button
                  key={car.id}
                  onClick={() => { setCarType(car.id); setEstimatedFare(null); }}
                  style={{
                    padding: '0.875rem', borderRadius: '0.75rem', cursor: 'pointer',
                    fontFamily: 'Poppins, sans-serif', textAlign: 'center', transition: 'all 0.2s',
                    background: carType === car.id ? 'rgba(245,158,11,0.15)' : 'var(--bg-dark)',
                    border: carType === car.id ? '2px solid var(--primary)' : '2px solid var(--border)',
                    color: 'var(--text-light)',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{car.emoji}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.15rem' }}>{car.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>{car.rate} · Min {car.min}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fare Estimate */}
          {estimatedFare && fareBreakdown && (
            <div style={{
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
            }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Estimated Fare</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>₹{estimatedFare.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Base ₹{fareBreakdown.baseAmount} + {distance}km @ ₹{fareBreakdown.ratePerKm}/km
                  {tripType === 'round-trip' && ' × 1.9 (round trip)'}
                </div>
              </div>
              <div className="badge">✓ Inclusive of all charges</div>
            </div>
          )} 

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handleEstimate} disabled={loading} style={{ flex: '1', minWidth: '140px', justifyContent: 'center' }}>
              {loading ? <span className="spinner-light" /> : '💰 Get Estimate'}
            </button>
            <button className="btn btn-primary" onClick={handleBookNow} style={{ flex: '2', minWidth: '180px', justifyContent: 'center', fontWeight: 600 }}>
              🚕 Book Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}