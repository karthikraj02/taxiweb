import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
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
import DriverAuthModal from './components/DriverAuthModal.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import DriverDashboard from './components/DriverDashboard.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useDriver } from './context/DriverContext.jsx';

export default function App() {
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDriverAuthModal, setShowDriverAuthModal] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [bookingData, setBookingData] = useState(null);
  const { user } = useAuth();
  const { driver, loading: driverLoading } = useDriver();

  // Show driver dashboard when a driver is authenticated
  if (!driverLoading && driver) {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ style: { background: 'rgba(8,18,42,0.95)', color: '#e0f4ff', border: '1px solid rgba(0,212,255,0.2)', backdropFilter: 'blur(12px)', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 } }} />
        <DriverDashboard />
      </>
    );
  }

  const openBooking = (carType = null, data = null) => {
    setSelectedCar(carType);
    setBookingData(data);
    setShowBookingModal(true);
  };

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: 'rgba(8,18,42,0.95)', color: '#e0f4ff', border: '1px solid rgba(0,212,255,0.2)', backdropFilter: 'blur(12px)', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 } }} />
      <Navbar onAuthClick={() => setShowAuthModal(true)} onDriverAuthClick={() => setShowDriverAuthModal(true)} />
      <main>
        <section id="home"><Hero onBookNow={() => openBooking()} /></section>
        <section id="ride"><RideBooking onBookNow={openBooking} /></section>
        <section id="fleet"><Fleet onBookNow={(carType) => openBooking(carType)} /></section>
        <section id="tours"><Tours onEnquire={() => setShowAuthModal(true)} /></section>
        <section id="track"><Track /></section>
        <section id="contact"><Contact /></section>
        {user?.role === 'admin' && (
          <section id="admin"><AdminDashboard /></section>
        )}
      </main>
      <Footer />

      <button
        onClick={() => openBooking()}
        style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 999,
          background: 'linear-gradient(135deg, #00d4ff, #7b2fff)',
          color: '#fff', border: 'none',
          borderRadius: '0.5rem', padding: '0.9rem 1.5rem', fontWeight: 700,
          fontSize: '0.9rem', cursor: 'pointer',
          boxShadow: '0 0 20px rgba(0,212,255,0.35), 0 8px 30px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          transition: 'transform 0.2s, box-shadow 0.2s',
          fontFamily: 'Rajdhani, sans-serif',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 0 35px rgba(0,212,255,0.5), 0 12px 40px rgba(0,0,0,0.4)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(0,212,255,0.35), 0 8px 30px rgba(0,0,0,0.4)'; }}
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
      {showDriverAuthModal && (
        <DriverAuthModal onClose={() => setShowDriverAuthModal(false)} />
      )}
    </>
  );
}
