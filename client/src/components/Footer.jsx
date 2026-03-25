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
    <footer style={{ background: '#0a0f1a', borderTop: '1px solid var(--border)', paddingTop: '3rem' }}>
      <div className="container">
        {/* Top Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.8rem' }}>🚕</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                Udupi <span style={{ color: 'var(--primary)' }}>Taxi</span>
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.7, maxWidth: '240px' }}>
              Your trusted travel partner since 2010. Reliable, comfortable, and always on time.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: '1rem', color: 'var(--text-light)' }}>Quick Links</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {LINKS['Quick Links'].map(link => (
                <li key={link.label}>
                  <button
                    onClick={() => scrollTo(link.id)}
                    style={{
                      background: 'none', border: 'none', cursor: link.id ? 'pointer' : 'default',
                      color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif',
                      fontSize: '0.875rem', padding: '0', textAlign: 'left',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    → {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: '1rem', color: 'var(--text-light)' }}>Services</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {LINKS['Services'].map(s => (
                <li key={s.label} style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  → {s.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: '1rem', color: 'var(--text-light)' }}>Contact</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <span>📍</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  Near KMC Hospital, Manipal Road, Udupi, Karnataka 576101
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span>📞</span>
                <a href="tel:+919876543210" style={{ color: 'var(--primary)', fontSize: '0.875rem', textDecoration: 'none' }}>
                  +91 98765 43210
                </a>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span>✉️</span>
                <a href="mailto:bookings@udupikaxi.com" style={{ color: 'var(--primary)', fontSize: '0.875rem', textDecoration: 'none' }}>
                  bookings@udupikaxi.com
                </a>
              </div>
            </div>

            {/* Social */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              {SOCIAL.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  title={s.label}
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', textDecoration: 'none', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={{
          borderTop: '1px solid var(--border)', paddingTop: '1.25rem', paddingBottom: '1.25rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            © 2024 Udupi Taxi. All rights reserved.
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Made with ❤️ in Udupi, Karnataka
          </span>
        </div>
      </div>
    </footer>
  );
}
