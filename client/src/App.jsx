import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Navbar, { PHONE_HREF } from './components/Navbar.jsx';
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

const TOAST_OPTIONS = {
  style: {
    background: '#0f1b2d',
    color: '#fff',
    fontSize: '0.92rem',
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '10px',
  },
};

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
        <Toaster position="top-right" toastOptions={TOAST_OPTIONS} />
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
      <Toaster position="top-right" toastOptions={TOAST_OPTIONS} />
      <Navbar onAuthClick={() => setShowAuthModal(true)} onDriverAuthClick={() => setShowDriverAuthModal(true)} />
      <main>
        <section id="home"><Hero onBookNow={() => openBooking()} /></section>
        <section id="ride"><RideBooking onBookNow={openBooking} onAuthRequired={() => setShowAuthModal(true)} /></section>
        <section id="fleet"><Fleet onBookNow={(carType) => openBooking(carType)} /></section>
        <section id="tours">
          <Tours
            onEnquire={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            onDestination={(drop) => openBooking(null, { pickup: 'Udupi', drop })}
          />
        </section>
        <section id="track"><Track /></section>
        <section id="contact"><Contact /></section>
        {user?.role === 'admin' && (
          <section id="admin"><AdminDashboard /></section>
        )}
      </main>
      <Footer />

      <div className="mobile-bar">
        <a className="btn btn-secondary" href={PHONE_HREF}>Call us</a>
        <button className="btn btn-primary" onClick={() => openBooking()}>Book a ride</button>
      </div>

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
