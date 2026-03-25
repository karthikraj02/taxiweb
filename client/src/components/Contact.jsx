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
    { icon: '📞', label: 'Phone', value: '+91 98765 43210', link: 'tel:+919876543210' },
    { icon: '✉️', label: 'Email', value: 'bookings@udupikaxi.com', link: 'mailto:bookings@udupikaxi.com' },
    { icon: '⏰', label: 'Hours', value: '24/7 Available', link: null },
  ];

  return (
    <div className="section" style={{ background: 'linear-gradient(180deg, var(--bg-dark) 0%, #0a0f1a 100%)' }}>
      <div className="container">
        <h2 className="section-title">Get In <span>Touch</span></h2>
        <p className="section-subtitle">Have a question or want to book a customized trip? We're here to help.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {/* Contact Form */}
          <div className="card" style={{ padding: '2rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', fontSize: '1.2rem' }}>Send us a Message</h3>
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
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', fontWeight: 600 }}>
                {loading ? <span className="spinner" /> : '📨 Send Message'}
              </button>
            </form>
          </div>

          {/* Contact Info + Testimonials */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Contact Info */}
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1.25rem', fontSize: '1.1rem' }}>Contact Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {contactInfo.map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.25rem', flexShrink: 0, marginTop: '1px' }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>{item.label}</div>
                      {item.link ? (
                        <a href={item.link} style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
                          {item.value}
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>{item.value}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Testimonials */}
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1.25rem', fontSize: '1.1rem' }}>Customer Reviews</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {TESTIMONIALS.map((t, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem',
                    padding: '1rem', border: '1px solid var(--border)',
                  }}>
                    <div style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                      {'★'.repeat(t.stars)}
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', lineHeight: 1.6, marginBottom: '0.4rem', fontStyle: 'italic' }}>
                      "{t.text}"
                    </p>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>— {t.name}</div>
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
