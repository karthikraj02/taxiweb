import React from 'react';

const STATS = [
  { value: '500+', label: 'Happy Rides' },
  { value: '4', label: 'Car Types' },
  { value: '24/7', label: 'Service' },
  { value: '2010', label: 'Est.' },
];

const MARQUEE_TEXT = 'Popular Routes: Udupi → Mangalore • Udupi → Bangalore • Udupi → Goa • Udupi → Mysore • Udupi → Coorg • Udupi → Hampi • ';

export default function Hero({ onBookNow }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Main Hero */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        paddingTop: '70px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background decorations */}
        <div style={{
          position: 'absolute', top: '10%', right: '5%',
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', left: '5%',
          width: '300px', height: '300px',
          background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />

        <div className="container" style={{ width: '100%' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '3rem', flexWrap: 'wrap',
          }}>
            {/* Left Content */}
            <div style={{ flex: '1 1 400px', maxWidth: '600px' }} className="animate-slide-up">
              <div className="badge" style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                🚗 Premium Taxi Service in Udupi
              </div>

              <h1 style={{
                fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
                fontWeight: 800,
                lineHeight: 1.15,
                marginBottom: '1.25rem',
                letterSpacing: '-0.02em',
              }}>
                Ride in Comfort,<br />
                Arrive in{' '}
                <span style={{ color: 'var(--primary)' }}>Style</span>
              </h1>

              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '2rem', lineHeight: 1.7, maxWidth: '480px' }}>
                Your trusted taxi partner in Udupi & coastal Karnataka. Outstation trips, local rides, and tour packages — all with professional drivers and comfortable vehicles.
              </p>

              {/* Stats */}
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
                {STATS.map(stat => (
                  <div key={stat.label}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--primary)' }}>{stat.value}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={onBookNow} style={{ fontSize: '1rem', padding: '0.875rem 2rem', fontWeight: 600 }}>
                  🚕 Book a Ride Now
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => document.getElementById('fleet')?.scrollIntoView({ behavior: 'smooth' })}
                  style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}
                >
                  View Fleet
                </button>
              </div>
            </div>

            {/* Right - Taxi Illustration */}
            <div style={{
              flex: '1 1 280px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <div className="animate-bounce" style={{ fontSize: 'clamp(6rem, 15vw, 10rem)', lineHeight: 1, marginBottom: '1rem', filter: 'drop-shadow(0 20px 40px rgba(245,158,11,0.3))' }}>
                🚕
              </div>
              <div style={{
                display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center',
              }}>
                {['AC Cabs', 'GPS Tracked', 'Safe & Reliable', '24/7'].map(tag => (
                  <span key={tag} style={{
                    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
                    color: 'var(--primary)', padding: '0.35rem 0.85rem', borderRadius: '2rem',
                    fontSize: '0.8rem', fontWeight: 500,
                  }}>
                    ✓ {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Marquee */}
      <div className="marquee-container">
        <div className="marquee-track">
          {[...Array(3)].map((_, i) => (
            <span key={i} style={{ color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 500, paddingRight: '4rem' }}>
              {MARQUEE_TEXT}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
