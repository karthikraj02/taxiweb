import React from 'react';

const CARS = [
  {
    id: 'etios',
    name: 'Toyota Etios',
    emoji: '🚗',
    seats: 4,
    luggage: '2 bags',
    rate: '₹12/km',
    min: '₹600',
    accent: '#00d4ff',
    accentRgb: '0,212,255',
    features: ['AC', '4 Seater', 'GPS', 'Music System'],
  },
  {
    id: 'dzire',
    name: 'Maruti Dzire',
    emoji: '🚙',
    seats: 4,
    luggage: '2 bags',
    rate: '₹13/km',
    min: '₹650',
    accent: '#00ff88',
    accentRgb: '0,255,136',
    features: ['AC', '4 Seater', 'GPS', 'Comfortable'],
  },
  {
    id: 'innova',
    name: 'Toyota Innova',
    emoji: '🚐',
    seats: 7,
    luggage: '4 bags',
    rate: '₹18/km',
    min: '₹1100',
    accent: '#ffaa00',
    accentRgb: '255,170,0',
    features: ['AC', '7 Seater', 'GPS', 'Spacious'],
  },
  {
    id: 'tempo',
    name: 'Tempo Traveller',
    emoji: '🚌',
    seats: 12,
    luggage: '8 bags',
    rate: '₹25/km',
    min: '₹2500',
    accent: '#ff0080',
    accentRgb: '255,0,128',
    features: ['AC', '12 Seater', 'GPS', 'Group Travel'],
  },
];

export default function Fleet({ onBookNow }) {
  return (
    <div className="section" style={{ background: 'var(--bg-dark)', position: 'relative', overflow: 'hidden' }}>
      {/* Background grid */}
      <div className="cyber-grid-bg" />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <div className="badge" style={{ marginBottom: '1rem' }}>⚡ Vehicle Selection</div>
        </div>
        <h2 className="section-title">Our <span>Fleet</span></h2>
        <p className="section-subtitle">Choose the perfect vehicle for your journey</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: '1.5rem' }}>
          {CARS.map(car => (
            <div
              key={car.id}
              style={{
                background: 'rgba(8,18,42,0.8)',
                borderRadius: '0.75rem',
                overflow: 'hidden',
                border: `1px solid rgba(${car.accentRgb}, 0.18)`,
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                position: 'relative',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = `0 20px 50px rgba(0,0,0,0.5), 0 0 25px rgba(${car.accentRgb},0.15)`;
                e.currentTarget.style.borderColor = `rgba(${car.accentRgb},0.5)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = `rgba(${car.accentRgb},0.18)`;
              }}
            >
              {/* Gradient top bar */}
              <div style={{
                height: '3px',
                background: `linear-gradient(90deg, transparent, ${car.accent}, transparent)`,
              }} />

              <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Car Emoji with glow */}
                <div style={{
                  textAlign: 'center', fontSize: '3.8rem',
                  marginBottom: '0.875rem',
                  filter: `drop-shadow(0 0 20px rgba(${car.accentRgb},0.5))`,
                }}>
                  {car.emoji}
                </div>

                {/* Name */}
                <h3 style={{
                  fontSize: '1.05rem', fontWeight: 700, textAlign: 'center',
                  marginBottom: '1rem', color: 'var(--text-light)',
                  fontFamily: 'Orbitron, sans-serif',
                  letterSpacing: '0.03em',
                }}>
                  {car.name}
                </h3>

                {/* Features */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem', justifyContent: 'center' }}>
                  {car.features.map(f => (
                    <span key={f} style={{
                      background: `rgba(${car.accentRgb},0.07)`,
                      color: car.accent,
                      border: `1px solid rgba(${car.accentRgb},0.2)`,
                      padding: '0.18rem 0.6rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      fontFamily: 'Rajdhani, sans-serif',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}>
                      {f}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div style={{
                  display: 'flex', justifyContent: 'space-around',
                  background: 'rgba(0,212,255,0.03)',
                  border: '1px solid rgba(0,212,255,0.08)',
                  borderRadius: '0.4rem',
                  padding: '0.75rem', marginBottom: '1rem',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.05rem' }}>💺 {car.seats}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Seats</div>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(0,212,255,0.1)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.05rem' }}>🧳 {car.luggage}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Luggage</div>
                  </div>
                </div>

                {/* Tariff */}
                <div style={{
                  background: `rgba(${car.accentRgb},0.06)`,
                  border: `1px solid rgba(${car.accentRgb},0.2)`,
                  borderRadius: '0.4rem', padding: '0.75rem', marginBottom: '1.25rem', textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: '1.5rem', fontWeight: 800, color: car.accent,
                    fontFamily: 'Orbitron, sans-serif',
                    textShadow: `0 0 15px rgba(${car.accentRgb},0.4)`,
                  }}>{car.rate}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Min: {car.min}</div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => onBookNow(car.id)}
                  style={{
                    width: '100%', justifyContent: 'center', fontWeight: 700,
                    background: `linear-gradient(135deg, rgba(${car.accentRgb},0.8), rgba(${car.accentRgb},0.4))`,
                    boxShadow: `0 0 15px rgba(${car.accentRgb},0.2)`,
                    color: '#fff',
                  }}
                >
                  Book {car.name.split(' ')[1]}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

