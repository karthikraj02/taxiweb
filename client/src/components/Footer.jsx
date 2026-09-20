import React from 'react';
import { Logo, Pin, Phone, Mail, Facebook, Instagram, Youtube } from './Icons.jsx';
import { PHONE_DISPLAY, PHONE_HREF } from './Navbar.jsx';

const QUICK_LINKS = [
  { label: 'Book a Ride', id: 'ride' },
  { label: 'Our Fleet', id: 'fleet' },
  { label: 'Tour Packages', id: 'tours' },
  { label: 'Track Ride', id: 'track' },
  { label: 'Contact Us', id: 'contact' },
];

// Each service jumps to the section where it can be booked or enquired about.
const SERVICES = [
  { label: 'Airport transfers', id: 'ride' },
  { label: 'Outstation cabs', id: 'ride' },
  { label: 'Local taxi', id: 'ride' },
  { label: 'Tour packages', id: 'tours' },
  { label: 'Corporate travel', id: 'contact' },
  { label: 'Wedding cars', id: 'contact' },
];

const SOCIAL = [
  { icon: Facebook, label: 'Facebook', href: '#' },
  { icon: Instagram, label: 'Instagram', href: '#' },
  { icon: Youtube, label: 'YouTube', href: '#' },
];

export default function Footer() {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="brand"><Logo /><span>Udupi <em>Taxi</em></span></div>
            <p>Dependable cabs for local, airport and outstation travel from Udupi since 2010.</p>
            <div className="social">
              {SOCIAL.map(({ icon: Icon, label, href }) => (
                <a key={label} href={href} aria-label={label}><Icon size={18} /></a>
              ))}
            </div>
          </div>

          <div>
            <h4>Quick links</h4>
            <ul>
              {QUICK_LINKS.map(l => (
                <li key={l.id}><button className="footer-link" onClick={() => scrollTo(l.id)}>{l.label}</button></li>
              ))}
            </ul>
          </div>

          <div>
            <h4>Services</h4>
            <ul>
              {SERVICES.map(s => (
                <li key={s.label}><button className="footer-link" onClick={() => scrollTo(s.id)}>{s.label}</button></li>
              ))}
            </ul>
          </div>

          <div>
            <h4>Contact</h4>
            <div className="footer-contact">
              <div><Pin size={17} /><span>Near KMC Hospital, Manipal Road, Udupi, Karnataka 576101</span></div>
              <div><Phone size={17} /><a href={PHONE_HREF}>{PHONE_DISPLAY}</a></div>
              <div><Mail size={17} /><a href="mailto:bookings@udupikaxi.com">bookings@udupikaxi.com</a></div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Udupi Taxi. All rights reserved.</span>
          <a href="https://beautiful-alpaca-6b1495.netlify.app/" target="_blank" rel="noopener noreferrer">Built by Dev</a>
        </div>
      </div>
    </footer>
  );
}
