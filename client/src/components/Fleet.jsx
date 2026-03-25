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
    accent: '#3b82f6',
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
    accent: '#10b981',
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
    accent: '#f59e0b',
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
    accent: '#ef4444',
    features: ['AC', '12 Seater', 'GPS', 'Group Travel'],
  },
];

export default function Fleet({ onBookNow }) {
  return (
    <div className="section" style={{ background: 'var(--bg-dark)' }}>
      <div className="container">
        <h2 className="section-title">Our <span>Fleet</span></h2>
        <p className="section-subtitle">Choose the perfect vehicle for your journey</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
          {CARS.map(car => (
            <div
              key={car.id}
              style={{
                background: 'var(--bg-card)',
                borderRadius: '1rem',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex',
                flexDirection: 'column',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px ${car.accent}30`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {/* Colored top border */}
              <div style={{ height: '4px', background: car.accent }} />

              <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Car Emoji */}
                <div style={{ textAlign: 'center', fontSize: '4rem', marginBottom: '0.75rem', filter: `drop-shadow(0 4px 12px ${car.accent}40)` }}>
                  {car.emoji}
                </div>

                {/* Name */}
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, textAlign: 'center', marginBottom: '1rem' }}>
                  {car.name}
                </h3>

                {/* Features */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem', justifyContent: 'center' }}>
                  {car.features.map(f => (
                    <span key={f} style={{
                      background: `${car.accent}15`, color: car.accent,
                      border: `1px solid ${car.accent}30`, padding: '0.2rem 0.6rem',
                      borderRadius: '2rem', fontSize: '0.72rem', fontWeight: 500,
                    }}>
                      {f}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div style={{
                  display: 'flex', justifyContent: 'space-around',
                  background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem',
                  padding: '0.75rem', marginBottom: '1rem',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem' }}>💺 {car.seats}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Seats</div>
                  </div>
                  <div style={{ width: '1px', background: 'var(--border)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem' }}>🧳 {car.luggage}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Luggage</div>
                  </div>
                </div>

                {/* Tariff */}
                <div style={{
                  background: `${car.accent}10`, border: `1px solid ${car.accent}30`,
                  borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1.25rem', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: car.accent }}>{car.rate}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Minimum fare: {car.min}</div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => onBookNow(car.id)}
                  style={{ width: '100%', justifyContent: 'center', fontWeight: 600 }}
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
