import React, { useState, useRef, useEffect } from 'react';
import { getBooking, unwrap, apiError } from '../api/index.js';
import { useSocket } from '../hooks/useSocket.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Check, Pin, Car, Phone, Star, Route } from './Icons.jsx';

/** Mirrors the server-side booking state machine. */
const STATUS_STEPS = [
  { key: 'pending',          label: 'Booked',           desc: 'Awaiting payment' },
  { key: 'payment_pending',  label: 'Payment',          desc: 'Complete payment to confirm' },
  { key: 'confirmed',        label: 'Confirmed',        desc: 'Payment received' },
  { key: 'dispatching',      label: 'Finding a driver', desc: 'Contacting nearby drivers' },
  { key: 'driver_assigned',  label: 'Driver assigned',  desc: 'A driver has accepted' },
  { key: 'driver_en_route',  label: 'En route',         desc: 'Driver is on the way' },
  { key: 'driver_arrived',   label: 'Arrived',          desc: 'Driver is at your pickup' },
  { key: 'in_progress',      label: 'Trip started',     desc: 'Enjoy your ride' },
  { key: 'completed',        label: 'Completed',        desc: 'Trip finished. Thank you!' },
];

/** Terminal states shown separately rather than as a timeline step. */
const TERMINAL_STATES = {
  cancelled:      { label: 'Cancelled' },
  payment_failed: { label: 'Payment failed' },
  expired:        { label: 'Expired' },
};

const STATUS_ORDER = STATUS_STEPS.map(s => s.key);
const UDUPI = { lat: 13.3409, lng: 74.7421 };

function TrackMap({ driverLocation }) {
  return (
    <div className="map-box">
      <div className="marker" style={{ top: '50%', left: '50%' }}>
        <div className="dot"><Pin size={16} /></div>
        Udupi
      </div>

      {driverLocation ? (
        <div
          className="marker driver"
          style={{
            top: `${30 + (driverLocation.lat - UDUPI.lat) * -500}%`,
            left: `${50 + (driverLocation.lng - UDUPI.lng) * 500}%`,
          }}
        >
          <div className="dot"><Car size={16} /></div>
          Driver
        </div>
      ) : (
        <div className="map-empty" style={{ position: 'absolute', bottom: '1rem', left: 0, right: 0 }}>
          Driver location will appear here once your ride is on the way.
        </div>
      )}
    </div>
  );
}

export default function Track() {
  const [inputId, setInputId] = useState('');
  const [activeBookingId, setActiveBookingId] = useState('');
  const [bookingInfo, setBookingInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef(null);

  const { isAuthenticated } = useAuth();
  const {
    driverLocation, bookingStatus, connected, messages,
    sendMessage, markRead, joinError, sending,
  } = useSocket(activeBookingId);

  // Realtime status wins when present, since it reflects a committed
  // server-side transition; otherwise fall back to the fetched record.
  const currentStatusKey = bookingStatus || bookingInfo?.booking?.status || null;
  const currentStepIndex = currentStatusKey ? STATUS_ORDER.indexOf(currentStatusKey) : -1;
  const terminalState = currentStatusKey ? TERMINAL_STATES[currentStatusKey] : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length) markRead();
  }, [messages, markRead]);

  const handleTrack = async () => {
    const id = inputId.trim();
    if (!id) { setError('Enter your booking ID.'); return; }
    if (!isAuthenticated) { setError('Sign in to track your booking.'); return; }

    setLoading(true);
    setError(null);
    try {
      // The server scopes this lookup to the signed-in customer, so a booking
      // ID alone is not enough to view someone else's ride.
      const data = unwrap(await getBooking(id));
      setBookingInfo(data);
      setActiveBookingId(data.booking.bookingId);
    } catch (err) {
      setBookingInfo(null);
      setActiveBookingId('');
      setError(apiError(err, 'We could not find a booking with that ID on your account.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    const ok = await sendMessage(text);
    if (!ok) {
      setChatInput(text);   // restore so the message is not silently lost
      setError('Message could not be sent. Check your connection and try again.');
    }
  };

  const booking = bookingInfo?.booking;
  const driver = booking?.driver;
  const driverName = driver?.name || 'Your driver';
  const driverCarInfo = driver ? [driver.carNumber, driver.carType].filter(Boolean).join(' · ') : '';

  return (
    <div className="section">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Track your ride</span>
          <h2 className="section-title">Where is my taxi?</h2>
          <p className="section-subtitle">Enter the booking ID from your confirmation to see your driver and trip status.</p>
        </div>

        <div className="track-search">
          <input
            className="input"
            aria-label="Booking ID"
            placeholder="Booking ID, e.g. UDX-ABC123"
            value={inputId}
            onChange={e => setInputId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTrack()}
          />
          <button className="btn btn-dark" onClick={handleTrack} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Track ride'}
          </button>
        </div>

        {(error || joinError) && (
          <div className="alert-error" role="alert" style={{ maxWidth: '560px', margin: '0 auto 1.5rem' }}>
            {error || joinError}
          </div>
        )}

        {booking ? (
          <div className="track-grid">
            <div className="track-col">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 className="h-sm" style={{ margin: 0 }}>Live map</h3>
                  <span className={`status-pill${connected ? ' live' : ''}`}>{connected ? 'Live' : 'Offline'}</span>
                </div>
                <TrackMap driverLocation={driverLocation} />
              </div>

              <div className="card">
                <h3 className="h-sm">Booking details</h3>
                <div className="kv"><span>Booking ID</span><span>{booking.bookingId}</span></div>
                <div className="kv"><span>Route</span><span>{booking.pickup} → {booking.drop}</span></div>
                <div className="kv"><span>Vehicle</span><span style={{ textTransform: 'capitalize' }}>{booking.carType}</span></div>
                <div className="kv"><span>Distance</span><span>{booking.distanceKm ?? '—'} km</span></div>
                <div className="kv"><span>Fare</span><span>₹{booking.fare?.toLocaleString()}</span></div>
                <div className="kv"><span>Payment</span><span style={{ textTransform: 'capitalize' }}>{booking.paymentStatus}</span></div>
              </div>
            </div>

            <div className="track-col">
              <div className="card">
                <h3 className="h-sm">Trip status</h3>
                {terminalState && (
                  <div className="alert-error" role="status">This booking is {terminalState.label.toLowerCase()}.</div>
                )}
                <div className="timeline">
                  {STATUS_STEPS.map((step, idx) => {
                    const done = currentStepIndex > idx;
                    const current = currentStepIndex === idx;
                    return (
                      <div key={step.key} className={`tl-step${done ? ' done' : ''}${current ? ' current' : ''}`}>
                        <div className="tl-rail">
                          <div className="tl-dot">{done ? <Check size={14} strokeWidth={3} /> : idx + 1}</div>
                          {idx < STATUS_STEPS.length - 1 && <div className="tl-line" />}
                        </div>
                        <div className="tl-body">
                          <b>{step.label}</b>
                          <small>{step.desc}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card">
                <h3 className="h-sm">Your driver</h3>
                {driver ? (
                  <div className="driver-row">
                    <div className="avatar">{driverName.charAt(0)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{driverName}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{driverCarInfo}</div>
                      {driver.rating != null && <span className="rating"><Star size={14} /> {driver.rating.toFixed(1)}</span>}
                    </div>
                    {driver.phone && (
                      <a className="btn btn-secondary btn-sm" href={`tel:${driver.phone}`}><Phone size={15} /> Call</a>
                    )}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>A driver will be assigned shortly.</p>
                )}
              </div>

              <div className="card">
                <h3 className="h-sm">Message your driver</h3>
                <div className="chat-log">
                  {messages.length === 0 ? (
                    <p className="chat-empty">No messages yet.</p>
                  ) : (
                    messages.map((msg, idx) => {
                      // senderType is set by the server from the authenticated
                      // socket, so this cannot be spoofed by another client.
                      const isOwn = msg.senderType === 'customer';
                      return (
                        <div key={msg.id || idx} className={`bubble${isOwn ? ' own' : ''}`}>
                          <small>{msg.senderName}</small>
                          {msg.body}
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    className="input"
                    aria-label="Message"
                    placeholder="Type a message"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button className="btn btn-dark" onClick={handleSendMessage} disabled={sending || !connected}>
                    {sending ? '…' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <Route size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--line-strong)' }} />
            <h3>Enter your booking ID</h3>
            <p>You&apos;ll see your driver&apos;s live position and trip status here once a driver is assigned.</p>
          </div>
        )}
      </div>
    </div>
  );
}
