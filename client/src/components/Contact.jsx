import React, { useState, useEffect } from 'react';
import { sendContactMessage, getReviews, unwrap, apiError } from '../api/index.js';
import toast from 'react-hot-toast';
import { Pin, Phone, Mail, Clock, Star } from './Icons.jsx';
import { PHONE_DISPLAY, PHONE_HREF } from './Navbar.jsx';

const INFO = [
  { icon: Pin, label: 'Address', value: 'Near KMC Hospital, Manipal Road, Udupi, Karnataka 576101' },
  { icon: Phone, label: 'Phone', value: PHONE_DISPLAY, link: PHONE_HREF },
  { icon: Mail, label: 'Email', value: 'bookings@udupikaxi.com', link: 'mailto:bookings@udupikaxi.com' },
  { icon: Clock, label: 'Hours', value: 'Open 24 hours, 7 days a week' },
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  // Reviews come from /api/reviews and can only be written by a customer who
  // completed a ride, so nothing shown here is invented.
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getReviews()
      .then(res => { if (!cancelled) setReviews(unwrap(res).reviews || []); })
      .catch(() => { if (!cancelled) setReviews([]); })
      .finally(() => { if (!cancelled) setReviewsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  // Success is reported only after the server confirms the message was stored.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || form.name.trim().length < 2) {
      setError('Please enter your name.'); return;
    }
    if (form.message.trim().length < 10) {
      setError('Please tell us a little more so we can help.'); return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      setError('Leave an email or a phone number so we can reply.'); return;
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        message: form.message.trim(),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      };
      await sendContactMessage(payload);
      setSent(true);
      setForm({ name: '', email: '', phone: '', message: '' });
      toast.success('Message received.');
    } catch (err) {
      setError(apiError(err, 'We could not send your message. Please try again or call us.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section section-soft">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Contact</span>
          <h2 className="section-title">Talk to us</h2>
          <p className="section-subtitle">Questions or a custom trip in mind? Call us or send a message.</p>
        </div>

        <div className="contact-grid">
          <form className="card" onSubmit={handleSubmit} noValidate>
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1.15rem' }}>Send a message</h3>
            {error && <div className="alert-error" role="alert">{error}</div>}
            {sent && (
              <div className="alert-success" role="status">
                Thanks, your message has been received. We usually reply within one working day.
              </div>
            )}
            <div className="input-group">
              <label htmlFor="contact-name">Name</label>
              <input id="contact-name" required className="input" name="name" placeholder="Your name" value={form.name} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label htmlFor="contact-email">Email</label>
              <input id="contact-email" className="input" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label htmlFor="contact-phone">Phone</label>
              <input id="contact-phone" className="input" name="phone" type="tel" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label htmlFor="contact-message">Message</label>
              <textarea
                id="contact-message" required className="input" name="message" rows={4}
                placeholder="Tell us about your trip" value={form.message} onChange={handleChange}
                style={{ resize: 'vertical', minHeight: '100px' }}
              />
            </div>
            <button className="btn btn-dark btn-block" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Send message'}
            </button>
          </form>

          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1.15rem' }}>Contact details</h3>
              <div className="contact-list">
                {INFO.map(({ icon: Icon, label, value, link }) => (
                  <div key={label} className="contact-item">
                    <div className="contact-icon"><Icon size={19} /></div>
                    <div>
                      <small>{label}</small>
                      {link ? <a href={link}>{value}</a> : <span>{value}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1.15rem' }}>What customers say</h3>
              {reviewsLoading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.93rem' }}>Loading reviews…</p>
              ) : reviews.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.93rem' }}>
                  No reviews yet. Reviews appear here once customers rate a completed trip.
                </p>
              ) : (
                reviews.map(r => (
                  <blockquote key={r.id} className="quote">
                    <div className="stars" role="img" aria-label={`${r.rating} out of 5 stars`}>
                      {[...Array(r.rating)].map((_, i) => <Star key={i} size={15} />)}
                    </div>
                    <p>{r.comment}</p>
                    <cite>{r.author} · verified trip</cite>
                  </blockquote>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
