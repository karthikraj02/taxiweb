import React from 'react';
import dzireImg from '../img/maruti_desire.png';
import { Check, Phone, Arrow } from './Icons.jsx';
import { PHONE_DISPLAY, PHONE_HREF } from './Navbar.jsx';

const POINTS = [
  'See your fare before you book',
  'Available 24 hours, 7 days a week',
  'Serving Udupi since 2010',
  'Secure online payment',
];

export default function Hero({ onBookNow }) {
  return (
    <div className="hero">
      <div className="container hero-grid">
        <div>
          <span className="eyebrow">Udupi, Karnataka</span>
          <h1>Reliable taxi service for every <span>journey</span></h1>
          <p className="hero-lead">
            Local rides, airport transfers and outstation trips at clear per-km rates. Book online in a minute, or call us any time.
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" onClick={onBookNow}>
              Book a ride <Arrow size={18} />
            </button>
            <a className="btn btn-secondary btn-lg" href={PHONE_HREF}>
              <Phone size={18} /> {PHONE_DISPLAY}
            </a>
          </div>
          <ul className="hero-points">
            {POINTS.map(p => (
              <li key={p}><Check size={18} /> {p}</li>
            ))}
          </ul>
        </div>

        <div className="hero-visual">
          <img src={dzireImg} alt="Maruti Dzire taxi" />
          <div className="hero-visual-foot">
            <span>Sedans from<br /><strong>₹12/km</strong></span>
            <span style={{ textAlign: 'right' }}>Minimum fare<br /><strong>₹600</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
