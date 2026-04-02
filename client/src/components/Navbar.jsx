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
    ...(user?.role === 'admin' ? [{ label: 'Admin', id: 'admin' }] : []),
  ];

  const navStyle = {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    zIndex: 100,
    transition: 'all 0.4s ease',
    background: scrolled
      ? 'rgba(5, 11, 24, 0.92)'
      : 'transparent',
    backdropFilter: scrolled ? 'blur(20px)' : 'none',
    WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
    boxShadow: scrolled ? '0 1px 30px rgba(0,0,0,0.5)' : 'none',
    borderBottom: scrolled ? '1px solid rgba(0,212,255,0.12)' : 'none',
  };

  const linkStyle = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)',
    fontFamily: 'Rajdhani, sans-serif',
    fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.25s',
    padding: '0.25rem 0', letterSpacing: '0.1em', textTransform: 'uppercase',
    position: 'relative',
  };

  return (
    <nav style={navStyle}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '72px' }}>
        {/* Logo */}
        <button
          onClick={() => scrollTo('home')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
        >
          <div style={{
            width: '38px', height: '38px', borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(123,47,255,0.15))',
            border: '1px solid rgba(0,212,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem',
            boxShadow: '0 0 12px rgba(0,212,255,0.15)',
          }}>
            🚕
          </div>
          <span style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '1.1rem', fontWeight: 700,
            color: 'var(--text-light)', letterSpacing: '0.05em',
          }}>
            Udupi <span style={{
              background: 'linear-gradient(135deg, #00d4ff, #7b2fff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Taxi</span>
          </span>
        </button>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }} className="desktop-nav">
          {navLinks.map(link => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              style={linkStyle}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--primary)';
                e.currentTarget.style.textShadow = '0 0 10px rgba(0,212,255,0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.textShadow = 'none';
              }}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Auth Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isAuthenticated ? (
            <>
              <span style={{
                color: 'var(--text-muted)', fontSize: '0.8rem',
                fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em',
              }}>
                Hi, <strong style={{ color: 'var(--primary)' }}>{user?.name?.split(' ')[0]}</strong>
              </span>
              <button
                onClick={logout}
                className="btn btn-outline"
                style={{ padding: '0.45rem 1rem', fontSize: '0.78rem' }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onAuthClick}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 1.1rem', fontSize: '0.78rem' }}
              >
                Login
              </button>
              <button
                onClick={onAuthClick}
                className="btn btn-primary"
                style={{ padding: '0.45rem 1.1rem', fontSize: '0.78rem' }}
              >
                Register
              </button>
            </>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'none', border: '1px solid var(--border)', cursor: 'pointer',
              color: 'var(--primary)', fontSize: '1.2rem',
              display: 'none', padding: '0.4rem 0.6rem', borderRadius: '0.35rem',
              transition: 'all 0.2s',
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
          background: 'rgba(5,11,24,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(0,212,255,0.15)',
          padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem',
        }}>
          {navLinks.map(link => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif',
                fontSize: '1rem', fontWeight: 600, textAlign: 'left',
                padding: '0.75rem 0',
                borderBottom: '1px solid rgba(0,212,255,0.08)',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              {link.label}
            </button>
          ))}
          {!isAuthenticated && (
            <button
              onClick={() => { onAuthClick(); setMobileMenuOpen(false); }}
              className="btn btn-primary"
              style={{ marginTop: '0.75rem', justifyContent: 'center' }}
            >
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

