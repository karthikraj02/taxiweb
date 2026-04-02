import React, { useState } from 'react';
import toast from 'react-hot-toast';

const TESTIMONIALS = [
  { text: 'Excellent service! Driver was on time and very professional.', name: 'Rajesh K.', stars: 5 },
  { text: 'Best taxi service in Udupi. Used for Bangalore trip, totally comfortable.', name: 'Priya M.', stars: 5 },
  { text: 'Innova was in perfect condition. Will definitely book again!', name: 'Suresh R.', stars: 5 },
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.message) { toast.error('Please fill in name and message'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    toast.success("Message sent! We'll contact you shortly.");
    setForm({ name: '', email: '', phone: '', message: '' });
    setLoading(false);
  };

  const contactInfo = [
    { icon: '📍', label: 'Address', value: 'Near KMC Hospital, Manipal Road, Udupi, Karnataka 576101', link: null },
    { icon: '📞', label: 'Phone', value: '+91 97314 70096', link: 'tel:+919731470096' },
    { icon: '✉️', label: 'Email', value: 'bookings@udupikaxi.com', link: 'mailto:bookings@udupikaxi.com' },
    { icon: '⏰', label: 'Hours', value: '24/7 Available', link: null },
  ];

  return (
    <div className="section" style={{ background: 'linear-gradient(180deg, var(--bg-dark) 0%, #030810 100%)', position: 'relative', overflow: 'hidden' }}>
      <div className="cyber-grid-bg" style={{ opacity: 0.3 }} />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <div className="badge" style={{ marginBottom: '1rem' }}>📡 Get In Touch</div>
        </div>
        <h2 className="section-title">Contact <span>Us</span></h2>
        <p className="section-subtitle">Have a question or want to book a customized trip? We're here to help.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {/* Contact Form */}
          <div style={{
            background: 'rgba(8,18,42,0.75)',
            border: '1px solid rgba(0,212,255,0.15)',
            borderRadius: '0.75rem',
            padding: '2rem',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Top gradient line */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--primary), var(--secondary), transparent)' }} />
            <h3 style={{
              fontWeight: 700, marginBottom: '1.5rem', fontSize: '1.1rem',
              fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em',
              color: 'var(--text-light)',
            }}>Send a Message</h3>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Your Name *</label>
                <input className="input" name="name" placeholder="e.g. Ramesh Kumar" value={form.name} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Email</label>
                <input className="input" name="email" type="email" placeholder="your@email.com" value={form.email} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Phone</label>
                <input className="input" name="phone" type="tel" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Message *</label>
                <textarea
                  className="input"
                  name="message"
                  rows={4}
                  placeholder="Tell us about your travel needs..."
                  value={form.message}
                  onChange={handleChange}
                  style={{ resize: 'vertical', minHeight: '100px' }}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', fontWeight: 700 }}>
                {loading ? <span className="spinner-light" /> : '📨 Send Message'}
              </button>
            </form>
          </div>

          {/* Contact Info + Testimonials */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Contact Info */}
            <div style={{
              background: 'rgba(8,18,42,0.75)',
              border: '1px solid rgba(0,212,255,0.15)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--secondary), transparent)' }} />
              <h3 style={{ fontWeight: 700, marginBottom: '1.25rem', fontSize: '1rem', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em' }}>Contact Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {contactInfo.map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '0.4rem', flexShrink: 0,
                      background: 'rgba(0,212,255,0.07)',
                      border: '1px solid rgba(0,212,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1rem',
                    }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.2rem', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{item.label}</div>
                      {item.link ? (
                        <a href={item.link} style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Rajdhani, sans-serif' }}>
                          {item.value}
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-light)', fontFamily: 'Rajdhani, sans-serif' }}>{item.value}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Testimonials */}
            <div style={{
              background: 'rgba(8,18,42,0.75)',
              border: '1px solid rgba(0,212,255,0.15)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
              <h3 style={{ fontWeight: 700, marginBottom: '1.25rem', fontSize: '1rem', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em' }}>Customer Reviews</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {TESTIMONIALS.map((t, i) => (
                  <div key={i} style={{
                    background: 'rgba(0,212,255,0.03)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    border: '1px solid rgba(0,212,255,0.08)',
                  }}>
                    <div style={{ color: '#ffaa00', fontSize: '0.875rem', marginBottom: '0.4rem', letterSpacing: '0.1em' }}>
                      {'★'.repeat(t.stars)}
                    </div>
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-light)', lineHeight: 1.65, marginBottom: '0.4rem', fontStyle: 'italic', fontFamily: 'Rajdhani, sans-serif' }}>
                      "{t.text}"
                    </p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em' }}>— {t.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

