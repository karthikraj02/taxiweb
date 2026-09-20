import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Logo, Phone, Menu, Close } from './Icons.jsx';

export const PHONE_DISPLAY = '+91 97314 70096';
export const PHONE_HREF = 'tel:+919731470096';

export default function Navbar({ onAuthClick, onDriverAuthClick }) {
  const [open, setOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setOpen(false);
  };

  const navLinks = [
    { label: 'Book a Ride', id: 'ride' },
    { label: 'Fleet', id: 'fleet' },
    { label: 'Tours', id: 'tours' },
    { label: 'Track Ride', id: 'track' },
    { label: 'Contact', id: 'contact' },
    ...(user?.role === 'admin' ? [{ label: 'Admin', id: 'admin' }] : []),
  ];

  return (
    <header className="nav">
      <div className="container nav-inner">
        <button className="brand" onClick={() => scrollTo('home')} aria-label="Udupi Taxi home">
          <Logo />
          <span>Udupi <em>Taxi</em></span>
        </button>

        <nav className="nav-links" aria-label="Main">
          {navLinks.map(l => (
            <button key={l.id} className="nav-link" onClick={() => scrollTo(l.id)}>{l.label}</button>
          ))}
        </nav>

        <div className="nav-actions">
          <a className="nav-phone desktop-only" href={PHONE_HREF}>
            <Phone size={17} /> {PHONE_DISPLAY}
          </a>
          {isAuthenticated ? (
            <>
              <span className="nav-user">Hi, {user?.name?.split(' ')[0]}</span>
              <button className="btn btn-outline btn-sm" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm desktop-only" onClick={onDriverAuthClick}>Driver login</button>
              <button className="btn btn-dark btn-sm" onClick={onAuthClick}>Log in</button>
            </>
          )}
          <button className="nav-toggle" onClick={() => setOpen(o => !o)} aria-label="Toggle menu" aria-expanded={open}>
            {open ? <Close /> : <Menu />}
          </button>
        </div>
      </div>

      <div className={`nav-mobile${open ? ' open' : ''}`}>
        {navLinks.map(l => (
          <button key={l.id} className="nav-link" onClick={() => scrollTo(l.id)}>{l.label}</button>
        ))}
        {!isAuthenticated && (
          <button className="btn btn-outline" onClick={() => { onDriverAuthClick(); setOpen(false); }}>Driver login</button>
        )}
      </div>
    </header>
  );
}
