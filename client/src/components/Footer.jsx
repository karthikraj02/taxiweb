import React from 'react';

const LINKS = {
  'Quick Links': [
    { label: 'Home', id: 'home' },
    { label: 'Book a Ride', id: 'ride' },
    { label: 'Our Fleet', id: 'fleet' },
    { label: 'Tour Packages', id: 'tours' },
    { label: 'Track Ride', id: 'track' },
    { label: 'Contact Us', id: 'contact' },
  ],
  'Services': [
    { label: 'Airport Transfers' },
    { label: 'Outstation Cabs' },
    { label: 'Local Taxi' },
    { label: 'Tour Packages' },
    { label: 'Corporate Travel' },
    { label: 'Wedding Car' },
  ],
};

const SOCIAL = [
  { icon: '📘', label: 'Facebook', href: '#' },
  { icon: '🐦', label: 'Twitter', href: '#' },
  { icon: '📸', label: 'Instagram', href: '#' },
  { icon: '▶️', label: 'YouTube', href: '#' },
];

export default function Footer() {
  const scrollTo = (id) => {
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer style={{
      background: '#020710',
      borderTop: '1px solid rgba(0,212,255,0.1)',
      paddingTop: '3.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(0,212,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.02) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }} />

      {/* Top glow line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.4), rgba(123,47,255,0.4), transparent)',
      }} />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        {/* Top Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(123,47,255,0.12))',
                border: '1px solid rgba(0,212,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem',
              }}>🚕</div>
              <span style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '1.1rem', fontWeight: 700,
                color: 'var(--text-light)', letterSpacing: '0.04em',
              }}>
                Udupi{' '}
                <span style={{
                  background: 'linear-gradient(135deg, #00d4ff, #7b2fff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>Taxi</span>
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', lineHeight: 1.75, maxWidth: '230px', fontFamily: 'Rajdhani, sans-serif' }}>
              Your trusted travel partner since 2010. Reliable, comfortable, and always on time.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 style={{
              fontWeight: 700, marginBottom: '1.1rem', color: 'var(--primary)',
              fontFamily: 'Rajdhani, sans-serif', fontSize: '0.78rem',
              textTransform: 'uppercase', letterSpacing: '0.12em',
            }}>Quick Links</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {LINKS['Quick Links'].map(link => (
                <li key={link.label}>
                  <button
                    onClick={() => scrollTo(link.id)}
                    style={{
                      background: 'none', border: 'none', cursor: link.id ? 'pointer' : 'default',
                      color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif',
                      fontSize: '0.875rem', fontWeight: 500, padding: '0', textAlign: 'left',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <span style={{ color: 'rgba(0,212,255,0.4)', marginRight: '0.4rem' }}>›</span>
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 style={{
              fontWeight: 700, marginBottom: '1.1rem', color: 'var(--primary)',
              fontFamily: 'Rajdhani, sans-serif', fontSize: '0.78rem',
              textTransform: 'uppercase', letterSpacing: '0.12em',
            }}>Services</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {LINKS['Services'].map(s => (
                <li key={s.label} style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'Rajdhani, sans-serif' }}>
                  <span style={{ color: 'rgba(0,212,255,0.4)', marginRight: '0.4rem' }}>›</span>
                  {s.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{
              fontWeight: 700, marginBottom: '1.1rem', color: 'var(--primary)',
              fontFamily: 'Rajdhani, sans-serif', fontSize: '0.78rem',
              textTransform: 'uppercase', letterSpacing: '0.12em',
            }}>Contact</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.9rem', marginTop: '2px' }}>📍</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.83rem', lineHeight: 1.55, fontFamily: 'Rajdhani, sans-serif' }}>
                  Near KMC Hospital, Manipal Road, Udupi, Karnataka 576101
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem' }}>📞</span>
                <a href="tel:+919731470096" style={{ color: 'var(--primary)', fontSize: '0.875rem', textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 }}>
                  +91 97314 70096
                </a>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem' }}>✉️</span>
                <a href="mailto:bookings@udupikaxi.com" style={{ color: 'var(--primary)', fontSize: '0.875rem', textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 }}>
                  bookings@udupikaxi.com
                </a>
              </div>
            </div>

            {/* Social */}
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
              {SOCIAL.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  title={s.label}
                  style={{
                    width: '36px', height: '36px', borderRadius: '0.4rem',
                    background: 'rgba(0,212,255,0.05)',
                    border: '1px solid rgba(0,212,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.95rem', textDecoration: 'none', transition: 'all 0.25s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)';
                    e.currentTarget.style.background = 'rgba(0,212,255,0.1)';
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(0,212,255,0.15)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.15)';
                    e.currentTarget.style.background = 'rgba(0,212,255,0.05)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={{
          borderTop: '1px solid rgba(0,212,255,0.1)',
          paddingTop: '1.25rem', paddingBottom: '1.5rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.04em' }}>
            © 2024 Udupi Taxi. All rights reserved.
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'Rajdhani, sans-serif' }}>
            <a href="https://beautiful-alpaca-6b1495.netlify.app/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
              Made with <span style={{ color: 'var(--danger)' }}>❤️</span> in Udupi, Karnataka
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}

