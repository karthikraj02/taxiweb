import React from 'react';

const TOURS = [
  {
    name: 'Temple Circuit',
    emoji: '🛕',
    price: '₹3,500',
    duration: 'Full Day (10hrs)',
    highlights: ['Udupi Krishna Temple', 'Kollur Mookambika', 'Sringeri Sharada'],
    desc: 'Explore the divine temples of coastal Karnataka in a single spiritual journey.',
    accent: '#f59e0b',
  },
  {
    name: 'Beach Tour',
    emoji: '🏖️',
    price: '₹2,800',
    duration: 'Half Day (6hrs)',
    highlights: ["Malpe Beach", "St. Mary's Island", 'Kaup Lighthouse'],
    desc: 'Discover the pristine beaches and scenic coastline of Udupi district.',
    accent: '#3b82f6',
  },
  {
    name: 'Western Ghats',
    emoji: '🌿',
    price: '₹4,200',
    duration: 'Full Day (12hrs)',
    highlights: ['Agumbe', 'Kudremukh', 'Chikmagalur'],
    desc: 'Trek into the lush Western Ghats — waterfalls, wildlife, and verdant landscapes.',
    accent: '#10b981',
  },
  {
    name: 'Mangalore City',
    emoji: '🏙️',
    price: '₹2,200',
    duration: 'Half Day (5hrs)',
    highlights: ['Panambur Beach', 'Mangala Devi Temple', 'Sultan Battery'],
    desc: 'A curated city tour of vibrant Mangalore — culture, coast, and cuisine.',
    accent: '#8b5cf6',
  },
];

const DESTINATIONS = [
  'Udupi', 'Mangalore', 'Bangalore', 'Goa', 'Mysore', 'Coorg',
  'Hampi', 'Gokarna', 'Shimoga', 'Hassan', 'Chikmagalur', 'Kundapur',
];

export default function Tours({ onEnquire }) {
  return (
    <div className="section" style={{ background: 'linear-gradient(180deg, #0d1829 0%, var(--bg-dark) 100%)' }}>
      <div className="container">
        <h2 className="section-title">Tour <span>Packages</span></h2>
        <p className="section-subtitle">Carefully crafted experiences across Karnataka</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
          {TOURS.map(tour => (
            <div
              key={tour.name}
              style={{
                background: 'var(--bg-card)', borderRadius: '1rem',
                overflow: 'hidden', border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ height: '3px', background: tour.accent }} />
              <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{tour.emoji}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{tour.name}</h3>
                  <span style={{
                    background: `${tour.accent}15`, color: tour.accent,
                    padding: '0.2rem 0.6rem', borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 600,
                    whiteSpace: 'nowrap', marginLeft: '0.5rem',
                  }}>
                    {tour.duration}
                  </span>
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1rem', flex: 1 }}>
                  {tour.desc}
                </p>

                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Highlights:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {tour.highlights.map(h => (
                      <span key={h} style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                        color: 'var(--text-light)', padding: '0.2rem 0.5rem',
                        borderRadius: '0.35rem', fontSize: '0.72rem',
                      }}>
                        ✓ {h}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: tour.accent }}>{tour.price}</div>
                  <button
                    onClick={onEnquire}
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 600 }}
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
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Popular <span style={{ color: 'var(--primary)' }}>Destinations</span>
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            We cover all major destinations from Udupi
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
            {DESTINATIONS.map(dest => (
              <span
                key={dest}
                onClick={onEnquire}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  color: 'var(--text-light)', padding: '0.5rem 1.25rem',
                  borderRadius: '2rem', fontSize: '0.875rem', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
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
