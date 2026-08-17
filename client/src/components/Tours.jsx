import React from 'react';

const TOURS = [
  {
    name: 'Temple Circuit',
    emoji: '🛕',
    price: '₹3,500',
    duration: 'Full Day (10hrs)',
    highlights: ['Udupi Krishna Temple', 'Kollur Mookambika', 'Sringeri Sharada'],
    desc: 'Explore the divine temples of coastal Karnataka in a single spiritual journey.',
    accent: '#ffaa00',
    accentRgb: '255,170,0',
  },
  {
    name: 'Beach Tour',
    emoji: '🏖️',
    price: '₹2,800',
    duration: 'Half Day (6hrs)',
    highlights: ["Malpe Beach", "St. Mary's Island", 'Kaup Lighthouse'],
    desc: 'Discover the pristine beaches and scenic coastline of Udupi district.',
    accent: '#00d4ff',
    accentRgb: '0,212,255',
  },
  {
    name: 'Western Ghats',
    emoji: '🌿',
    price: '₹4,200',
    duration: 'Full Day (12hrs)',
    highlights: ['Agumbe', 'Kudremukh', 'Chikmagalur'],
    desc: 'Trek into the lush Western Ghats — waterfalls, wildlife, and verdant landscapes.',
    accent: '#00ff88',
    accentRgb: '0,255,136',
  },
  {
    name: 'Mangalore City',
    emoji: '🏙️',
    price: '₹2,200',
    duration: 'Half Day (5hrs)',
    highlights: ['Panambur Beach', 'Mangala Devi Temple', 'Sultan Battery'],
    desc: 'A curated city tour of vibrant Mangalore — culture, coast, and cuisine.',
    accent: '#7b2fff',
    accentRgb: '123,47,255',
  },
];

const DESTINATIONS = [
  'Udupi', 'Mangalore', 'Bangalore', 'Goa', 'Mysore', 'Coorg',
  'Hampi', 'Gokarna', 'Shimoga', 'Hassan', 'Chikmagalur', 'Kundapur',
];

export default function Tours({ onEnquire }) {
  return (
    <div className="section" style={{ background: 'linear-gradient(180deg, #080f20 0%, var(--bg-dark) 100%)', position: 'relative', overflow: 'hidden' }}>
      <div className="cyber-grid-bg" style={{ opacity: 0.4 }} />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <div className="badge" style={{ marginBottom: '1rem' }}>🗺️ Curated Experiences</div>
        </div>
        <h2 className="section-title">Tour <span>Packages</span></h2>
        <p className="section-subtitle">Carefully crafted experiences across Karnataka</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
          {TOURS.map(tour => (
            <div
              key={tour.name}
              style={{
                background: 'rgba(8,18,42,0.8)',
                borderRadius: '0.75rem',
                overflow: 'hidden',
                border: `1px solid rgba(${tour.accentRgb},0.15)`,
                display: 'flex', flexDirection: 'column',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-7px)';
                e.currentTarget.style.boxShadow = `0 20px 50px rgba(0,0,0,0.45), 0 0 20px rgba(${tour.accentRgb},0.12)`;
                e.currentTarget.style.borderColor = `rgba(${tour.accentRgb},0.4)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = `rgba(${tour.accentRgb},0.15)`;
              }}
            >
              <div style={{ height: '2px', background: `linear-gradient(90deg, transparent, ${tour.accent}, transparent)` }} />
              <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  fontSize: '2.5rem', marginBottom: '0.875rem',
                  filter: `drop-shadow(0 0 15px rgba(${tour.accentRgb},0.4))`,
                }}>
                  {tour.emoji}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{
                    fontSize: '1rem', fontWeight: 700,
                    fontFamily: 'Orbitron, sans-serif',
                    letterSpacing: '0.03em', color: 'var(--text-light)',
                  }}>{tour.name}</h3>
                  <span style={{
                    background: `rgba(${tour.accentRgb},0.1)`,
                    color: tour.accent,
                    border: `1px solid rgba(${tour.accentRgb},0.25)`,
                    padding: '0.18rem 0.55rem', borderRadius: '0.25rem',
                    fontSize: '0.65rem', fontWeight: 700,
                    whiteSpace: 'nowrap', marginLeft: '0.5rem',
                    fontFamily: 'Rajdhani, sans-serif',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {tour.duration}
                  </span>
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', lineHeight: 1.65, marginBottom: '1rem', flex: 1, fontFamily: 'Rajdhani, sans-serif' }}>
                  {tour.desc}
                </p>

                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Highlights:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {tour.highlights.map(h => (
                      <span key={h} style={{
                        background: 'rgba(0,212,255,0.04)',
                        border: '1px solid rgba(0,212,255,0.12)',
                        color: 'var(--text-light)', padding: '0.18rem 0.5rem',
                        borderRadius: '0.25rem', fontSize: '0.68rem',
                        fontFamily: 'Rajdhani, sans-serif',
                      }}>
                        ✓ {h}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{
                    fontSize: '1.4rem', fontWeight: 800, color: tour.accent,
                    fontFamily: 'Orbitron, sans-serif',
                    textShadow: `0 0 12px rgba(${tour.accentRgb},0.4)`,
                  }}>{tour.price}</div>
                  <button
                    onClick={onEnquire}
                    className="btn btn-primary"
                    style={{
                      padding: '0.45rem 1.1rem', fontSize: '0.78rem', fontWeight: 700,
                      background: `linear-gradient(135deg, rgba(${tour.accentRgb},0.7), rgba(${tour.accentRgb},0.4))`,
                      boxShadow: `0 0 12px rgba(${tour.accentRgb},0.2)`,
                    }}
                  >
                    Book Tour
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Popular Destinations */}
        <div style={{ textAlign: 'center' }}>
          <h3 style={{
            fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem',
            fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.03em',
            textTransform: 'uppercase',
          }}>
            Popular <span style={{ color: 'var(--primary)', textShadow: '0 0 15px rgba(0,212,255,0.4)' }}>Destinations</span>
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem', fontFamily: 'Rajdhani, sans-serif' }}>
            We cover all major destinations from Udupi
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', justifyContent: 'center' }}>
            {DESTINATIONS.map(dest => (
              <span
                key={dest}
                onClick={onEnquire}
                style={{
                  background: 'rgba(8,18,42,0.7)',
                  border: '1px solid rgba(0,212,255,0.15)',
                  color: 'var(--text-muted)', padding: '0.45rem 1.1rem',
                  borderRadius: '0.35rem', fontSize: '0.82rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.25s',
                  fontFamily: 'Rajdhani, sans-serif',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  backdropFilter: 'blur(8px)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(0,212,255,0.4)';
                  e.currentTarget.style.color = 'var(--primary)';
                  e.currentTarget.style.background = 'rgba(0,212,255,0.06)';
                  e.currentTarget.style.boxShadow = '0 0 12px rgba(0,212,255,0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(0,212,255,0.15)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.background = 'rgba(8,18,42,0.7)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                📍 {dest}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

