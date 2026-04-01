import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Hero from './components/Hero.jsx';
import RideBooking from './components/RideBooking.jsx';
import Fleet from './components/Fleet.jsx';
import Tours from './components/Tours.jsx';
import Track from './components/Track.jsx';
import Contact from './components/Contact.jsx';
import Footer from './components/Footer.jsx';
import BookingModal from './components/BookingModal.jsx';
import AuthModal from './components/AuthModal.jsx';

export default function App() {
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [bookingData, setBookingData] = useState(null);

  const openBooking = (carType = null, data = null) => {
    setSelectedCar(carType);
    setBookingData(data);
    setShowBookingModal(true);
  };

  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' } }} />
      <Navbar onAuthClick={() => setShowAuthModal(true)} />
      <main>
        <section id="home"><Hero onBookNow={() => openBooking()} /></section>
        <section id="ride"><RideBooking onBookNow={openBooking} /></section>
        <section id="fleet"><Fleet onBookNow={(carType) => openBooking(carType)} /></section>
        <section id="tours"><Tours onEnquire={() => setShowAuthModal(true)} /></section>
        <section id="track"><Track /></section>
        <section id="contact"><Contact /></section>
      </main>
      <Footer />

      <button
        onClick={() => openBooking()}
        style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 999,
          background: 'var(--primary)', color: '#000', border: 'none',
          borderRadius: '3rem', padding: '1rem 1.5rem', fontWeight: 700,
          fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          transition: 'transform 0.2s, box-shadow 0.2s',
          fontFamily: 'Poppins, sans-serif'
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(245,158,11,0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(245,158,11,0.4)'; }}
      >
        🚕 Book a Ride
      </button>

      {showBookingModal && (
        <BookingModal
          initialCar={selectedCar}
          initialData={bookingData}
          onClose={() => setShowBookingModal(false)}
          onAuthRequired={() => { setShowBookingModal(false); setShowAuthModal(true); }}
        />
      )}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </AuthProvider>
  );
}
