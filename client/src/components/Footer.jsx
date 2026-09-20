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

const PHOTO_CREDITS = [
  { name: 'Ashok Prabhakaran', license: 'CC BY-SA 2.0', url: 'https://commons.wikimedia.org/wiki/File:Udupi_Sri_Krishna_Matha_Temple.jpg', what: 'Udupi Sri Krishna Matha' },
  { name: 'Keshu', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:ST._MARY_ISLAND.jpg', what: "St. Mary's Island" },
  { name: 'Dhruvaraj S', license: 'CC BY 2.0', url: 'https://commons.wikimedia.org/wiki/File:Kudremukh_1.jpg', what: 'Kudremukh' },
];

const LICENSE_URLS = {
  'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
};

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

        <p className="photo-credits">
          Tour photos via Wikimedia Commons:{' '}
          {PHOTO_CREDITS.map((c, i) => (
            <React.Fragment key={c.what}>
              {i > 0 && '; '}
              <a href={c.url} target="_blank" rel="noopener noreferrer">{c.what}</a> by {c.name}
              {' ('}<a href={LICENSE_URLS[c.license]} target="_blank" rel="noopener noreferrer">{c.license}</a>{')'}
            </React.Fragment>
          ))}
          .
        </p>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Udupi Taxi. All rights reserved.</span>
          <a href="https://beautiful-alpaca-6b1495.netlify.app/" target="_blank" rel="noopener noreferrer">Website by the developer</a>
        </div>
      </div>
    </footer>
  );
}
