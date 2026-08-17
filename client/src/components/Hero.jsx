import React, { useEffect, useRef } from 'react';
import marutiImg from '../img/maruti_desire.png';

const STATS = [
  { value: '500+', label: 'Happy Rides' },
  { value: '4', label: 'Car Types' },
  { value: '24/7', label: 'Service' },
  { value: '2010', label: 'Est.' },
];

const MARQUEE_TEXT = 'Popular Routes: Udupi → Mangalore • Udupi → Bangalore • Udupi → Goa • Udupi → Mysore • Udupi → Coorg • Udupi → Hampi • ';

function ParticleCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.5 - 0.1,
      alpha: Math.random() * 0.5 + 0.1,
      color: Math.random() > 0.6 ? '#00d4ff' : Math.random() > 0.5 ? '#7b2fff' : '#00ff88',
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width; }
        if (p.x < -5) p.x = canvas.width + 5;
        if (p.x > canvas.width + 5) p.x = -5;
      });
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

export default function Hero({ onBookNow }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Main Hero */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #050b18 0%, #080f20 40%, #050b18 100%)',
        display: 'flex',
        alignItems: 'center',
        paddingTop: '80px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Animated Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        }} />

        {/* Floating particles */}
        <ParticleCanvas />

        {/* Glow orbs */}
        <div style={{
          position: 'absolute', top: '15%', right: '8%',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 65%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '5%', left: '3%',
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(123,47,255,0.06) 0%, transparent 65%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: '200px', height: '200px',
          background: 'radial-gradient(circle, rgba(0,255,136,0.04) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
          transform: 'translate(-50%, -50%)',
        }} />

        <div className="container" style={{ width: '100%', position: 'relative', zIndex: 2 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '3rem', flexWrap: 'wrap',
          }}>
            {/* Left Content */}
            <div style={{ flex: '1 1 400px', maxWidth: '620px' }} className="animate-slide-up">
              {/* Status badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)',
                borderRadius: '2rem', padding: '0.35rem 1rem',
                marginBottom: '1.75rem', fontSize: '0.78rem', fontWeight: 600,
                color: 'var(--primary)', letterSpacing: '0.1em', textTransform: 'uppercase',
                fontFamily: 'Rajdhani, sans-serif',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--accent)',
                  boxShadow: '0 0 8px var(--accent)',
                  animation: 'pulse 2s ease-in-out infinite',
                  display: 'inline-block',
                }} />
                Premium Taxi Service · Udupi
              </div>

              <h1 style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 'clamp(2rem, 5vw, 3.6rem)',
                fontWeight: 900,
                lineHeight: 1.1,
                marginBottom: '1.25rem',
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
              }}>
                Ride in<br />
                <span style={{
                  background: 'linear-gradient(135deg, #00d4ff, #7b2fff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 0 30px rgba(0,212,255,0.3))',
                }}>
                  Cyber Style
                </span>
              </h1>

              <p style={{
                color: 'var(--text-muted)', fontSize: '1.05rem', marginBottom: '2rem',
                lineHeight: 1.75, maxWidth: '480px', fontFamily: 'Rajdhani, sans-serif',
              }}>
                Your trusted taxi partner in Udupi & coastal Karnataka. Outstation trips, local rides, and tour packages — all with professional drivers and comfortable vehicles.
              </p>

              {/* Stats */}
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
                {STATS.map(stat => (
                  <div key={stat.label} style={{ position: 'relative' }}>
                    <div style={{
                      fontSize: '1.8rem', fontWeight: 800,
                      fontFamily: 'Orbitron, sans-serif',
                      background: 'linear-gradient(135deg, #00d4ff, #7b2fff)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}>{stat.value}</div>
                    <div style={{
                      fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '-2px',
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      fontFamily: 'Rajdhani, sans-serif', fontWeight: 600,
                    }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={onBookNow}
                  style={{ fontSize: '1rem', padding: '0.9rem 2.25rem', fontWeight: 700 }}
                >
                  🚕 Book a Ride Now
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => document.getElementById('fleet')?.scrollIntoView({ behavior: 'smooth' })}
                  style={{ fontSize: '1rem', padding: '0.9rem 2rem' }}
                >
                  View Fleet
                </button>
              </div>
            </div>

            {/* Right - Futuristic Taxi Showcase */}
            <div style={{
              flex: '1 1 280px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              position: 'relative',
            }}>
              {/* Glowing ring behind taxi */}
              <div style={{
                position: 'absolute', width: '320px', height: '320px',
                borderRadius: '50%',
                border: '1px solid rgba(0,212,255,0.15)',
                boxShadow: '0 0 40px rgba(0,212,255,0.08), inset 0 0 40px rgba(0,212,255,0.04)',
                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                animation: 'rotateSlow 20s linear infinite',
              }} />
              <div style={{
                position: 'absolute', width: '260px', height: '260px',
                borderRadius: '50%',
                border: '1px dashed rgba(123,47,255,0.2)',
                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                animation: 'rotateSlow 15s linear infinite reverse',
              }} />

              <div className="animate-bounce" style={{
                marginBottom: '1.5rem',
                position: 'relative', zIndex: 1,
                display: 'flex', justifyContent: 'center'
              }}>
                <img src={marutiImg} alt="Maruti Taxi" style={{
                  width: '100%',
                  maxWidth: '300px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 30px rgba(0,212,255,0.4)) drop-shadow(0 20px 40px rgba(0,0,0,0.5))'
                }} />
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                {['AC Cabs', 'GPS Tracked', 'Safe & Reliable', '24/7'].map(tag => (
                  <span key={tag} style={{
                    background: 'rgba(0,212,255,0.06)',
                    border: '1px solid rgba(0,212,255,0.2)',
                    color: 'var(--primary)', padding: '0.3rem 0.8rem', borderRadius: '0.3rem',
                    fontSize: '0.72rem', fontWeight: 600,
                    fontFamily: 'Rajdhani, sans-serif',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
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
            <span key={i} style={{
              color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600,
              paddingRight: '4rem', letterSpacing: '0.08em',
              fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
            }}>
              {MARQUEE_TEXT}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

