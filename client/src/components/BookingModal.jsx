import React, { useState, useRef } from 'react';
import etiosImg from '../img/etios.png';
import dzireImg from '../img/maruti_desire.png';
import innovaImg from '../img/toyota_innova.png';
import tempoImg from '../img/tt.png';
import { useAuth } from '../context/AuthContext.jsx';
import {
  quoteTrip, createBooking, createPaymentOrder, verifyPayment,
  dispatchBooking, unwrap, apiError,
} from '../api/index.js';
import { resolvePlace } from '../utils/geocode.js';
import toast from 'react-hot-toast';

const CAR_TYPES = [
  { id: 'etios', label: 'Toyota Etios', image: etiosImg, rate: '₹12/km', min: '₹600' },
  { id: 'dzire', label: 'Maruti Dzire', image: dzireImg, rate: '₹13/km', min: '₹650' },
  { id: 'innova', label: 'Toyota Innova', image: innovaImg, rate: '₹18/km', min: '₹1100' },
  { id: 'tempo', label: 'Tempo Traveller', image: tempoImg, rate: '₹25/km', min: '₹2500' },
];

const STEPS = ['Trip Details', 'Fare Summary', 'Payment', 'Confirmation'];

function StepIndicator({ current }) {
  return (
    <div className="steps" style={{ marginBottom: '1.75rem' }}>
      {STEPS.map((label, idx) => (
        <React.Fragment key={label}>
          <div className="step-item" style={{ flexDirection: 'column', alignItems: 'center', flex: 1, gap: '0.25rem' }}>
            <div className={`step-circle ${idx < current ? 'completed' : idx === current ? 'active' : ''}`}>
              {idx < current ? '✓' : idx + 1}
            </div>
            <span style={{ fontSize: '0.65rem', color: idx === current ? 'var(--primary)' : 'var(--text-muted)', textAlign: 'center', display: 'block' }}>
              {label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={`step-line ${idx < current ? 'completed' : ''}`} style={{ marginBottom: '1.2rem' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function BookingModal({ initialCar, initialData, onClose, onAuthRequired }) {
  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [booking, setBooking] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    pickup: initialData?.pickup || '',
    drop: initialData?.drop || '',
    pickupCoords: initialData?.pickupCoords || null,
    dropCoords: initialData?.dropCoords || null,
    date: initialData?.date || today,
    time: initialData?.time || '09:00',
    carType: initialCar || initialData?.carType || 'etios',
    tripType: initialData?.tripType || 'one-way',
    passengerCount: initialData?.passengerCount || 1,
    notes: '',
  });

  const [quote, setQuote] = useState(initialData?.quote || null);
  const [error, setError] = useState(null);

  // An idempotency key generated once per modal session. Re-submitting after a
  // network wobble returns the original booking instead of creating a second
  // one (PHASE 30).
  const idempotencyKey = useRef(
    crypto.randomUUID?.() || `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`
  ).current;

  const scheduledForISO = () => {
    if (!form.date) return null;
    const dt = new Date(`${form.date}T${form.time || '09:00'}:00`);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  };

  /** Resolves typed text to coordinates. Never fabricates a position. */
  const ensureCoords = async () => {
    let { pickupCoords, dropCoords } = form;
    if (!pickupCoords && form.pickup) {
      const r = await resolvePlace(form.pickup);
      if (r) pickupCoords = { lat: r.lat, lng: r.lng };
    }
    if (!dropCoords && form.drop) {
      const r = await resolvePlace(form.drop);
      if (r) dropCoords = { lat: r.lat, lng: r.lng };
    }
    if (!pickupCoords || !dropCoords) {
      setError('We could not locate one of those places. Please pick from the suggestions on the booking form.');
      return null;
    }
    setForm(p => ({ ...p, pickupCoords, dropCoords }));
    return { pickupCoords, dropCoords };
  };

  const tripPayload = (coords) => ({
    pickup: form.pickup,
    drop: form.drop,
    pickupCoords: coords.pickupCoords,
    dropCoords: coords.dropCoords,
    carType: form.carType,
    tripType: form.tripType,
    scheduledFor: scheduledForISO(),
    passengerCount: form.passengerCount,
  });

  const handleCalculateFare = async () => {
    setError(null);
    if (!form.pickup || !form.drop) { setError('Enter a pickup and drop location.'); return; }
    if (!scheduledForISO()) { setError('Choose a pickup date and time.'); return; }

    setLoading(true);
    try {
      const coords = await ensureCoords();
      if (!coords) return;
      setQuote(unwrap(await quoteTrip(tripPayload(coords))));
    } catch (err) {
      setError(apiError(err, 'We could not calculate a fare for that trip.'));
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Creates the booking, then opens a Razorpay order for it.
   *
   * Note that no amount is sent: the server charges `booking.fare`, which it
   * calculated itself. The displayed fare is confirmation, not input.
   */
  const handleCreateBooking = async () => {
    setError(null);
    if (!agreed) { setError('Please accept the terms to continue.'); return; }

    setLoading(true);
    try {
      const coords = await ensureCoords();
      if (!coords) return;

      const bookingData = unwrap(await createBooking(
        { ...tripPayload(coords), ...(form.notes ? { notes: form.notes } : {}) },
        idempotencyKey
      ));
      setBooking(bookingData.booking);

      const orderData = unwrap(await createPaymentOrder(bookingData.booking.bookingId));
      setPaymentOrder(orderData);
      setStep(2);
    } catch (err) {
      setError(apiError(err, 'We could not create your booking.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRazorpay = () => {
    if (!paymentOrder?.orderId) { setError('No payment order is open. Please go back and try again.'); return; }

    const options = {
      key: paymentOrder.keyId,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency || 'INR',
      name: 'Udupi Taxi',
      description: `Booking ${booking?.bookingId}`,
      order_id: paymentOrder.orderId,
      handler: async (response) => {
        setLoading(true);
        try {
          // The server re-verifies the signature, re-fetches the payment from
          // Razorpay and compares the amount before confirming anything.
          await verifyPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });

          // Payment confirmed the booking; now ask for a driver.
          try {
            await dispatchBooking(booking.bookingId);
          } catch (dispatchErr) {
            // Non-fatal: the booking is paid and confirmed either way.
            console.debug('Dispatch request failed:', apiError(dispatchErr));
          }

          toast.success('Payment confirmed.');
          setStep(3);
        } catch (err) {
          setError(apiError(err, 'We could not verify that payment. If money left your account, contact support with your booking ID.'));
        } finally {
          setLoading(false);
        }
      },
      modal: {
        ondismiss: () => setError('Payment was cancelled. Your booking is saved and still awaiting payment.'),
      },
      prefill: { name: user?.name, email: user?.email, contact: user?.phone },
      theme: { color: '#00d4ff' },
    };

    const open = () => {
      try {
        new window.Razorpay(options).open();
      } catch {
        setError('Could not open the payment window. Please try again.');
      }
    };

    if (window.Razorpay) return open();

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = open;
    script.onerror = () => setError('Could not load the payment provider. Check your connection and try again.');
    document.head.appendChild(script);
  };

  if (!isAuthenticated) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
          <h2 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Login Required</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Please login to book a ride</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={onAuthRequired} style={{ fontWeight: 600 }}>Login / Register</button>
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '600px' }}>
        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text-light)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

        <h2 style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: '1.5rem' }}>🚕 Book a Ride</h2>

        <StepIndicator current={step} />

        {/* Errors are surfaced, never swallowed. */}
        {error && (
          <div role="alert" style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5', borderRadius: '0.5rem', padding: '0.75rem 1rem',
            marginBottom: '1rem', fontSize: '0.82rem',
          }}>
            {error}
          </div>
        )}

        {/* Step 0: Trip Details */}
        {step === 0 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>📍 Pickup</label>
                <input className="input" placeholder="From" value={form.pickup} onChange={e => setForm(p => ({ ...p, pickup: e.target.value }))} />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>🏁 Drop</label>
                <input className="input" placeholder="To" value={form.drop} onChange={e => setForm(p => ({ ...p, drop: e.target.value }))} />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>📅 Date</label>
                <input className="input" type="date" min={today} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>⏰ Time</label>
                <input className="input" type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
              </div>
              <div className="input-group" style={{ gridColumn: '1/-1', marginBottom: 0 }}>
                <label htmlFor="modal-passengers">👥 Passengers</label>
                <input
                  id="modal-passengers"
                  className="input" type="number" min="1" max="12"
                  value={form.passengerCount}
                  onChange={e => { setForm(p => ({ ...p, passengerCount: Math.max(1, parseInt(e.target.value) || 1) })); setQuote(null); }}
                />
              </div>
            </div>

            {/* Trip Type */}
            <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
              {['one-way', 'round-trip'].map(t => (
                <button key={t} onClick={() => { setForm(p => ({ ...p, tripType: t })); setQuote(null); }} style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '0.8rem', background: form.tripType === t ? 'var(--primary)' : 'var(--bg-dark)', color: form.tripType === t ? '#000' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                  {t === 'one-way' ? '→ One Way' : '↔ Round Trip'}
                </button>
              ))}
            </div>

            {/* Car Type */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
              {CAR_TYPES.map(c => (
                <button key={c.id} onClick={() => { setForm(p => ({ ...p, carType: c.id })); setQuote(null); }} style={{ padding: '0.6rem', borderRadius: '0.5rem', border: form.carType === c.id ? '2px solid var(--primary)' : '2px solid var(--border)', background: form.carType === c.id ? 'rgba(245,158,11,0.1)' : 'var(--bg-dark)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', color: 'var(--text-light)', fontFamily: 'Poppins, sans-serif' }}>
                  <div style={{ height: '32px', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={c.image} alt={c.label} style={{ height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{c.label.split(' ')[1]}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--primary)' }}>{c.rate}</div>
                </button>
              ))}
            </div>

            {/* Fare result — calculated by the server from a real route */}
            {quote && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.5rem', padding: '0.875rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Estimated Fare</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    {quote.distanceKm} km · approx {Math.round(quote.durationMinutes)} min
                  </div>
                </div>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>₹{quote.fare.toLocaleString()}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={handleCalculateFare} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
                {loading ? <span className="spinner-light" /> : '💰 Calculate Fare'}
              </button>
              <button className="btn btn-primary" disabled={!form.pickup || !form.drop || !form.date || !form.carType} onClick={() => { if (!quote) { setError('Calculate the fare before continuing.'); return; } setError(null); setStep(1); }} style={{ flex: 2, justifyContent: 'center', fontWeight: 600 }}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Fare Summary */}
        {step === 1 && (
          <div>
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Trip Summary</h3>
              {[
                ['Route', `${form.pickup} → ${form.drop}`],
                ['Car Type', CAR_TYPES.find(c => c.id === form.carType)?.label || form.carType],
                ['Distance', `${quote?.distanceKm ?? '—'} km`],
                ['Passengers', String(form.passengerCount)],
                ['Trip Type', form.tripType === 'one-way' ? 'One Way' : 'Round Trip'],
                ['Date & Time', `${form.date}${form.time ? ' at ' + form.time : ''}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{k}</span>
                  <span style={{ fontWeight: 500, fontSize: '0.875rem', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0 0' }}>
                <span style={{ fontWeight: 700 }}>Total Fare</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>₹{quote?.fare?.toLocaleString()}</span>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: '2px', accentColor: 'var(--primary)' }} />
              I agree to the terms and conditions. Fare may vary based on actual distance and waiting time.
            </label>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-outline" onClick={() => setStep(0)} style={{ flex: 1, justifyContent: 'center' }}>← Back</button>
              <button className="btn btn-primary" onClick={handleCreateBooking} disabled={loading || !agreed} style={{ flex: 2, justifyContent: 'center', fontWeight: 600 }}>
                {loading ? <span className="spinner" /> : '✓ Confirm & Pay'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Payment */}
        {step === 2 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💳</div>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Complete Payment</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Booking ID: <strong style={{ color: 'var(--primary)' }}>{booking?.bookingId}</strong>
            </p>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '1.5rem' }}>
              ₹{paymentOrder ? (paymentOrder.amount / 100).toLocaleString() : quote?.fare?.toLocaleString()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/*
                The "Skip Payment (Demo)" button that used to sit here posted an
                empty signature to the verify endpoint and confirmed the booking
                for free. Both the button and the server-side branch it relied on
                have been removed.
              */}
              <button
                className="btn btn-primary"
                onClick={handleRazorpay}
                disabled={loading || !paymentOrder}
                style={{ justifyContent: 'center', fontWeight: 600, padding: '0.875rem' }}
              >
                {loading ? <span className="spinner" /> : '💳 Pay with Razorpay'}
              </button>
              <button className="btn btn-outline" onClick={onClose} style={{ justifyContent: 'center' }}>
                Pay later — my booking is saved
              </button>
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Secured by Razorpay · 256-bit SSL encryption
            </p>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div className="animate-bounce" style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h3 style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>Booking Confirmed!</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Your ride has been successfully booked.</p>

            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Your Booking ID</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.05em' }}>{booking?.bookingId}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Save this ID to track your ride</div>
            </div>

            <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              {[
                ['📍 Pickup', form.pickup],
                ['🏁 Drop', form.drop],
                ['🚗 Car', CAR_TYPES.find(c => c.id === form.carType)?.label],
                ['📅 Date', form.date],
                ['💰 Fare', `₹${(booking?.fare ?? quote?.fare)?.toLocaleString()}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={() => { onClose(); setTimeout(() => document.getElementById('track')?.scrollIntoView({ behavior: 'smooth' }), 300); }} style={{ flex: 1, justifyContent: 'center', fontWeight: 600 }}>
                📍 Track Ride
              </button>
              <button className="btn btn-outline" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
