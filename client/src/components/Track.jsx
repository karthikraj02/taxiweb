import React, { useState } from 'react';
import { getBooking } from '../api/index.js';
import { useSocket } from '../hooks/useSocket.js';
import toast from 'react-hot-toast';

const STATUS_STEPS = [
  { key: 'pending', label: 'Booked', desc: 'Booking confirmed', icon: '📋' },
  { key: 'driver_assigned', label: 'Driver Assigned', desc: 'Driver on the way', icon: '🚗' },
  { key: 'en_route', label: 'En Route to Pickup', desc: 'Driver is coming to you', icon: '🛣️' },
  { key: 'arrived', label: 'Arrived', desc: 'Driver at pickup location', icon: '📍' },
  { key: 'in_progress', label: 'Trip Started', desc: 'Enjoy your ride', icon: '🚕' },
  { key: 'completed', label: 'Completed', desc: 'Trip completed. Thank you!', icon: '✅' },
];

const STATUS_ORDER = STATUS_STEPS.map(s => s.key);

function SimpleMap({ driverLocation }) {
  const UDUPI = { lat: 13.3409, lng: 74.7421 };
  return (
    <div style={{
      width: '100%', height: '300px', borderRadius: '0.75rem', overflow: 'hidden',
      background: 'linear-gradient(135deg, #1a2744 0%, #0f172a 100%)',
      border: '1px solid var(--border)', position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Grid lines */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
        {[...Array(8)].map((_, i) => (
          <React.Fragment key={i}>
            <line x1={`${i * 12.5}%`} y1="0" x2={`${i * 12.5}%`} y2="100%" stroke="#94a3b8" strokeWidth="1" />
            <line x1="0" y1={`${i * 12.5}%`} x2="100%" y2={`${i * 12.5}%`} stroke="#94a3b8" strokeWidth="1" />
          </React.Fragment>
        ))}
      </svg>

      {/* Destination pin */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)' }}>
        <div style={{ fontSize: '2rem', filter: 'drop-shadow(0 2px 8px rgba(245,158,11,0.5))' }}>📍</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', textAlign: 'center', fontWeight: 600 }}>Udupi</div>
      </div>

      {/* Driver pin */}
      {driverLocation && (
        <div style={{
          position: 'absolute',
          top: `${30 + (driverLocation.lat - UDUPI.lat) * -500}%`,
          left: `${50 + (driverLocation.lng - UDUPI.lng) * 500}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'top 2s ease, left 2s ease',
        }}>
          <div className="animate-pulse" style={{ fontSize: '1.8rem', filter: 'drop-shadow(0 2px 8px rgba(16,185,129,0.5))' }}>🚕</div>
        </div>
      )}

      {!driverLocation && (
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🗺️</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Live tracking will appear here</p>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '0.5rem', left: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        Udupi, Karnataka · {UDUPI.lat}°N {UDUPI.lng}°E
      </div>
    </div>
  );
}

export default function Track() {
  const [inputId, setInputId] = useState('');
  const [activeBookingId, setActiveBookingId] = useState('');
  const [bookingInfo, setBookingInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const { driverLocation, bookingStatus, connected } = useSocket(activeBookingId);

  const currentStatusKey = bookingStatus || bookingInfo?.booking?.status || null;
  const currentStepIndex = currentStatusKey ? STATUS_ORDER.indexOf(currentStatusKey) : -1;

  const handleTrack = async () => {
    if (!inputId.trim()) { toast.error('Please enter a booking ID'); return; }
    setLoading(true);
    try {
      const { data } = await getBooking(inputId.trim());
      setBookingInfo(data);
      setActiveBookingId(inputId.trim());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking not found');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    const demoId = 'UDX-DEMO01';
    setInputId(demoId);
    setActiveBookingId(demoId);
    setBookingInfo({
      booking: {
        bookingId: demoId,
        pickup: 'Udupi Bus Stand',
        drop: 'Mangalore Airport',
        carType: 'dzire',
        status: 'en_route',
        fare: 850,
        date: new Date().toISOString(),
      }
    });
    toast.success('Demo tracking started!');
  };

  return (
    <div className="section" style={{ background: 'var(--bg-dark)' }}>
      <div className="container">
        <h2 className="section-title">Track Your <span>Ride</span></h2>
        <p className="section-subtitle">Real-time driver location and trip status</p>

        {/* Input Section */}
        <div style={{ maxWidth: '500px', margin: '0 auto 2.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: '200px' }}
            placeholder="Enter Booking ID (e.g. UDX-ABC123)"
            value={inputId}
            onChange={e => setInputId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTrack()}
          />
          <button className="btn btn-primary" onClick={handleTrack} disabled={loading} style={{ fontWeight: 600 }}>
            {loading ? <span className="spinner" /> : '🔍 Track'}
          </button>
          <button className="btn btn-secondary" onClick={handleDemo} style={{ width: '100%', justifyContent: 'center' }}>
            🎬 Demo Mode
          </button>
        </div>

        {bookingInfo ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {/* Map */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ fontWeight: 600 }}>Live Map</h3>
                <span style={{
                  background: connected ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
                  color: connected ? 'var(--accent)' : 'var(--text-muted)',
                  padding: '0.2rem 0.75rem', borderRadius: '2rem', fontSize: '0.75rem',
                }}>
                  {connected ? '🟢 Live' : '⚫ Offline'}
                </span>
              </div>
              <SimpleMap driverLocation={driverLocation} />

              {/* Booking Info */}
              <div className="card" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Booking ID</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{bookingInfo.booking?.bookingId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Route</span>
                  <span style={{ fontSize: '0.875rem' }}>{bookingInfo.booking?.pickup} → {bookingInfo.booking?.drop}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Car Type</span>
                  <span style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>{bookingInfo.booking?.carType}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Fare</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>₹{bookingInfo.booking?.fare?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div>
              <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Trip Status</h3>
              <div className="card">
                {STATUS_STEPS.map((step, idx) => {
                  const isDone = currentStepIndex > idx;
                  const isCurrent = currentStepIndex === idx;
                  return (
                    <div key={step.key} style={{ display: 'flex', gap: '1rem', marginBottom: idx < STATUS_STEPS.length - 1 ? '0' : '0' }}>
                      {/* Timeline */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: isDone ? 'var(--accent)' : isCurrent ? 'var(--primary)' : 'var(--bg-dark)',
                          border: `2px solid ${isDone ? 'var(--accent)' : isCurrent ? 'var(--primary)' : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1rem', flexShrink: 0, transition: 'all 0.3s',
                        }}>
                          {isDone ? '✓' : step.icon}
                        </div>
                        {idx < STATUS_STEPS.length - 1 && (
                          <div style={{ width: '2px', flex: 1, minHeight: '24px', background: isDone ? 'var(--accent)' : 'var(--border)', margin: '2px 0', transition: 'background 0.3s' }} />
                        )}
                      </div>
                      {/* Content */}
                      <div style={{ paddingBottom: idx < STATUS_STEPS.length - 1 ? '1.25rem' : '0' }}>
                        <div style={{ fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--primary)' : isDone ? 'var(--accent)' : 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.4rem' }}>
                          {step.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{step.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Driver Card */}
              <div className="card" style={{ marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Driver Info</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>🧑‍✈️</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Ravi Kumar</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>KA-20 AB 1234 · Dzire</div>
                    <div style={{ color: '#fbbf24', fontSize: '0.85rem' }}>★★★★★ 4.8</div>
                  </div>
                  <a href="tel:+919876543210" style={{ marginLeft: 'auto' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem 0.875rem', fontSize: '0.8rem' }}>
                      📞 Call
                    </button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📡</div>
            <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Enter Your Booking ID</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 1rem' }}>
              Enter the booking ID you received after booking, or try Demo Mode to see live tracking in action.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
