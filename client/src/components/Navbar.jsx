import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar({ onAuthClick }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { label: 'Home', id: 'home' },
    { label: 'Ride', id: 'ride' },
    { label: 'Fleet', id: 'fleet' },
    { label: 'Tours', id: 'tours' },
    { label: 'Track', id: 'track' },
    { label: 'Contact', id: 'contact' },
    ...(user?.role === 'admin' ? [{ label: 'Admin Dashboard', id: 'admin' }] : []),
  ];

  const navStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    transition: 'all 0.3s ease',
    background: scrolled ? 'rgba(15,23,42,0.95)' : 'transparent',
    backdropFilter: scrolled ? 'blur(10px)' : 'none',
    boxShadow: scrolled ? '0 1px 20px rgba(0,0,0,0.3)' : 'none',
    borderBottom: scrolled ? '1px solid rgba(51,65,85,0.5)' : 'none',
  };

  return (
    <nav style={navStyle}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '70px' }}>
        {/* Logo */}
        <button onClick={() => scrollTo('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.8rem' }}>🚕</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
            Udupi <span style={{ color: 'var(--primary)' }}>Taxi</span>
          </span>
        </button>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }} className="desktop-nav">
          {navLinks.map(link => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif',
                fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s',
                padding: '0.25rem 0',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Auth Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isAuthenticated ? (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Hi, <strong style={{ color: 'var(--text-light)' }}>{user?.name?.split(' ')[0]}</strong>
              </span>
              <button
                onClick={logout}
                className="btn btn-outline"
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onAuthClick}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
              >
                Login
              </button>
              <button
                onClick={onAuthClick}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
              >
                Register
              </button>
            </>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-light)', fontSize: '1.5rem',
              display: 'none', padding: '0.25rem',
            }}
            className="hamburger"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div style={{
          background: 'rgba(15,23,42,0.98)', borderTop: '1px solid var(--border)',
          padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
        }}>
          {navLinks.map(link => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-light)', fontFamily: 'Poppins, sans-serif',
                fontSize: '1rem', fontWeight: 500, textAlign: 'left',
                padding: '0.75rem 0', borderBottom: '1px solid var(--border)',
              }}
            >
              {link.label}
            </button>
          ))}
          {!isAuthenticated && (
            <button onClick={() => { onAuthClick(); setMobileMenuOpen(false); }} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              Login / Register
            </button>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .hamburger { display: block !important; }
        }
      `}</style>
    </nav>
  );
}
