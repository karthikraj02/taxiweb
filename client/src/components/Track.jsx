import React, { useState, useRef, useEffect } from 'react';
import { getBooking, unwrap, apiError } from '../api/index.js';
import { useSocket } from '../hooks/useSocket.js';
import { useAuth } from '../context/AuthContext.jsx';

/** Mirrors the server-side booking state machine. */
const STATUS_STEPS = [
  { key: 'pending',          label: 'Booked',            desc: 'Awaiting payment',              icon: '📋' },
  { key: 'payment_pending',  label: 'Payment',           desc: 'Complete payment to confirm',   icon: '💳' },
  { key: 'confirmed',        label: 'Confirmed',         desc: 'Payment received',              icon: '✅' },
  { key: 'dispatching',      label: 'Finding a Driver',  desc: 'Contacting nearby drivers',     icon: '📡' },
  { key: 'driver_assigned',  label: 'Driver Assigned',   desc: 'A driver has accepted',         icon: '🚗' },
  { key: 'driver_en_route',  label: 'En Route',          desc: 'Driver is on the way',          icon: '🛣️' },
  { key: 'driver_arrived',   label: 'Arrived',           desc: 'Driver is at your pickup',      icon: '📍' },
  { key: 'in_progress',      label: 'Trip Started',      desc: 'Enjoy your ride',               icon: '🚕' },
  { key: 'completed',        label: 'Completed',         desc: 'Trip finished. Thank you!',     icon: '🏁' },
];

/** Terminal states shown separately rather than as a timeline step. */
const TERMINAL_STATES = {
  cancelled:      { label: 'Cancelled',      icon: '✖', color: '#f87171' },
  payment_failed: { label: 'Payment Failed', icon: '⚠', color: '#fbbf24' },
  expired:        { label: 'Expired',        icon: '⏱', color: '#8899aa' },
};

const STATUS_ORDER = STATUS_STEPS.map(s => s.key);

function CyberMap({ driverLocation }) {
  const UDUPI = { lat: 13.3409, lng: 74.7421 };
  return (
    <div style={{
      width: '100%', height: '300px', borderRadius: '0.75rem', overflow: 'hidden',
      background: 'linear-gradient(135deg, #04091a 0%, #080f25 100%)',
      border: '1px solid rgba(0,212,255,0.2)', position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Animated grid */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {[...Array(10)].map((_, i) => (
          <React.Fragment key={i}>
            <line x1={`${i * 10}%`} y1="0" x2={`${i * 10}%`} y2="100%" stroke="rgba(0,212,255,0.07)" strokeWidth="1" />
            <line x1="0" y1={`${i * 10}%`} x2="100%" y2={`${i * 10}%`} stroke="rgba(0,212,255,0.07)" strokeWidth="1" />
          </React.Fragment>
        ))}
        {/* Diagonal accent lines */}
        <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(0,212,255,0.04)" strokeWidth="1" />
        <line x1="100%" y1="0" x2="0" y2="100%" stroke="rgba(0,212,255,0.04)" strokeWidth="1" />
        {/* Scan circle */}
        <circle cx="50%" cy="50%" r="80" stroke="rgba(0,212,255,0.06)" strokeWidth="1" fill="none" />
        <circle cx="50%" cy="50%" r="120" stroke="rgba(0,212,255,0.04)" strokeWidth="1" fill="none" />
        <circle cx="50%" cy="50%" r="40" stroke="rgba(0,212,255,0.08)" strokeWidth="1" fill="none" />
      </svg>

      {/* Destination pin */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -110%)', zIndex: 2 }}>
        <div style={{ fontSize: '2rem', filter: 'drop-shadow(0 0 12px rgba(0,212,255,0.7))' }}>📍</div>
        <div style={{
          fontSize: '0.65rem', color: 'var(--primary)', textAlign: 'center', fontWeight: 700,
          fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase',
          textShadow: '0 0 8px rgba(0,212,255,0.5)',
        }}>Udupi</div>
      </div>

      {/* Driver pin */}
      {driverLocation && (
        <div style={{
          position: 'absolute',
          top: `${30 + (driverLocation.lat - UDUPI.lat) * -500}%`,
          left: `${50 + (driverLocation.lng - UDUPI.lng) * 500}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'top 2s ease, left 2s ease',
          zIndex: 3,
        }}>
          <div className="animate-pulse" style={{ fontSize: '1.8rem', filter: 'drop-shadow(0 0 15px rgba(0,255,136,0.7))' }}>🚕</div>
        </div>
      )}

      {!driverLocation && (
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem', filter: 'drop-shadow(0 0 15px rgba(0,212,255,0.4))' }}>🗺️</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.06em' }}>Live tracking will appear here</p>
        </div>
      )}

      <div style={{
        position: 'absolute', bottom: '0.6rem', left: '0.8rem',
        fontSize: '0.62rem', color: 'rgba(0,212,255,0.5)',
        fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.08em',
      }}>
        UDUPI, KARNATAKA · {UDUPI.lat}°N {UDUPI.lng}°E
      </div>

      {/* Corner accents */}
      <div style={{ position: 'absolute', top: 8, left: 8, width: 16, height: 16, borderTop: '2px solid rgba(0,212,255,0.5)', borderLeft: '2px solid rgba(0,212,255,0.5)' }} />
      <div style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderTop: '2px solid rgba(0,212,255,0.5)', borderRight: '2px solid rgba(0,212,255,0.5)' }} />
      <div style={{ position: 'absolute', bottom: 8, left: 8, width: 16, height: 16, borderBottom: '2px solid rgba(0,212,255,0.5)', borderLeft: '2px solid rgba(0,212,255,0.5)' }} />
      <div style={{ position: 'absolute', bottom: 8, right: 8, width: 16, height: 16, borderBottom: '2px solid rgba(0,212,255,0.5)', borderRight: '2px solid rgba(0,212,255,0.5)' }} />
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

  const driver = bookingInfo?.booking?.driver;
  const driverPhone = driver?.phone;
  const driverName = driver?.name || 'Your Driver';
  const carInfoParts = driver ? [driver.carNumber, driver.carType].filter(Boolean) : [];
  const driverCarInfo = carInfoParts.join(' · ');
  const driverRating = driver?.rating != null ? driver.rating.toFixed(1) : 'N/A';
  const driverStars = driver?.rating != null ? Math.floor(driver.rating) : 0;

  const glassCard = {
    background: 'rgba(8,18,42,0.75)',
    border: '1px solid rgba(0,212,255,0.15)',
    borderRadius: '0.75rem',
    padding: '1.25rem',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  };

  return (
    <div className="section" style={{ background: 'var(--bg-dark)', position: 'relative', overflow: 'hidden' }}>
      <div className="cyber-grid-bg" />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <div className="badge" style={{ marginBottom: '1rem' }}>📡 Live Tracking</div>
        </div>
        <h2 className="section-title">Track Your <span>Ride</span></h2>
        <p className="section-subtitle">Real-time driver location and trip status</p>

        {/* Input Section */}
        <div style={{ maxWidth: '520px', margin: '0 auto 2.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: '200px' }}
            placeholder="Enter Booking ID (e.g. UDX-ABC123)"
            value={inputId}
            onChange={e => setInputId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTrack()}
          />
          <button className="btn btn-primary" onClick={handleTrack} disabled={loading} style={{ fontWeight: 700 }}>
            {loading ? <span className="spinner-light" /> : '🔍 Track'}
          </button>
        </div>

        {/*
          The "Demo Mode" button that used to sit here fabricated a booking with
          an invented driver and the business's own phone number, then started a
          fake GPS animation. Nothing on this page is simulated any more.
        */}
        {(error || joinError) && (
          <div role="alert" style={{
            maxWidth: '520px', margin: '0 auto 2rem',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5', borderRadius: '0.5rem', padding: '0.75rem 1rem',
            fontSize: '0.82rem', fontFamily: 'Rajdhani, sans-serif',
          }}>
            {error || joinError}
          </div>
        )}

        {bookingInfo ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {/* Map */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <h3 style={{ fontWeight: 700, fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Live Map</h3>
                <span style={{
                  background: connected ? 'rgba(0,255,136,0.1)' : 'rgba(104,136,165,0.1)',
                  color: connected ? 'var(--accent)' : 'var(--text-muted)',
                  border: `1px solid ${connected ? 'rgba(0,255,136,0.3)' : 'rgba(104,136,165,0.2)'}`,
                  padding: '0.2rem 0.75rem', borderRadius: '0.3rem', fontSize: '0.7rem',
                  fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  {connected ? '● LIVE' : '○ OFFLINE'}
                </span>
              </div>
              <CyberMap driverLocation={driverLocation} />

              {/* Booking Info */}
              <div style={{ ...glassCard, marginTop: '1rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--primary), transparent)' }} />
                {[
                  { label: 'Booking ID', val: bookingInfo.booking?.bookingId, color: 'var(--primary)' },
                  { label: 'Route', val: `${bookingInfo.booking?.pickup} → ${bookingInfo.booking?.drop}` },
                  { label: 'Car Type', val: bookingInfo.booking?.carType },
                  { label: 'Distance', val: `${bookingInfo.booking?.distanceKm ?? '—'} km` },
                  { label: 'Fare', val: `₹${bookingInfo.booking?.fare?.toLocaleString()}`, color: 'var(--accent)' },
                  { label: 'Payment', val: bookingInfo.booking?.paymentStatus },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{row.label}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: row.color || 'var(--text-light)', fontFamily: 'Rajdhani, sans-serif', textTransform: row.label === 'Car Type' ? 'capitalize' : 'none' }}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Timeline */}
            <div>
              <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Trip Status</h3>
              <div style={{ ...glassCard, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--secondary), transparent)' }} />
                {terminalState && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.6rem 0.9rem', marginBottom: '1rem', borderRadius: '0.5rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${terminalState.color}55`, color: terminalState.color,
                    fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.05em',
                  }}>
                    <span>{terminalState.icon}</span>
                    <span>This booking is {terminalState.label.toLowerCase()}.</span>
                  </div>
                )}
                {STATUS_STEPS.map((step, idx) => {
                  const isDone = currentStepIndex > idx;
                  const isCurrent = currentStepIndex === idx;
                  const stepColor = isDone ? 'var(--accent)' : isCurrent ? 'var(--primary)' : 'rgba(0,212,255,0.15)';
                  return (
                    <div key={step.key} style={{ display: 'flex', gap: '1rem' }}>
                      {/* Timeline */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '50%',
                          background: isDone ? 'rgba(0,255,136,0.12)' : isCurrent ? 'rgba(0,212,255,0.12)' : 'transparent',
                          border: `2px solid ${stepColor}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.95rem', flexShrink: 0, transition: 'all 0.3s',
                          boxShadow: isCurrent ? '0 0 12px rgba(0,212,255,0.3)' : isDone ? '0 0 8px rgba(0,255,136,0.2)' : 'none',
                        }}>
                          {isDone ? '✓' : step.icon}
                        </div>
                        {idx < STATUS_STEPS.length - 1 && (
                          <div style={{
                            width: '2px', flex: 1, minHeight: '22px',
                            background: isDone ? 'linear-gradient(180deg, var(--accent), rgba(0,255,136,0.3))' : 'rgba(0,212,255,0.1)',
                            margin: '3px 0', transition: 'background 0.3s',
                          }} />
                        )}
                      </div>
                      {/* Content */}
                      <div style={{ paddingBottom: idx < STATUS_STEPS.length - 1 ? '1.1rem' : '0' }}>
                        <div style={{
                          fontWeight: isCurrent ? 700 : 500,
                          color: isCurrent ? 'var(--primary)' : isDone ? 'var(--accent)' : 'var(--text-muted)',
                          fontSize: '0.875rem', marginTop: '0.4rem',
                          fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.04em',
                          textShadow: isCurrent ? '0 0 10px rgba(0,212,255,0.4)' : 'none',
                        }}>
                          {step.label}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif' }}>{step.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Driver Card */}
              <div style={{ ...glassCard, marginTop: '1rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
                <h4 style={{ marginBottom: '0.875rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Driver Info</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ fontSize: '2.5rem', filter: 'drop-shadow(0 0 10px rgba(0,212,255,0.3))' }}>🧑‍✈️</div>
                  <div>
                    <div style={{ fontWeight: 700, fontFamily: 'Rajdhani, sans-serif', fontSize: '1rem' }}>{driverName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif', textTransform: 'capitalize' }}>{driverCarInfo}</div>
                    <div style={{ color: '#ffaa00', fontSize: '0.82rem' }}>{'★'.repeat(driverStars)}{driverRating !== 'N/A' ? ` ${driverRating}` : ' N/A'}</div>
                  </div>
                  {driverPhone && (
                    <a href={`tel:${driverPhone}`} style={{ marginLeft: 'auto', textDecoration: 'none' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.45rem 0.875rem', fontSize: '0.75rem' }}>
                        📞 Call Driver
                      </button>
                    </a>
                  )}
                </div>
              </div>

              {/* Chat Box */}
              <div style={{ ...glassCard, marginTop: '1rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--primary), transparent)' }} />
                <h4 style={{ marginBottom: '0.875rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>💬 Chat with Driver</h4>
                <div style={{
                  height: '180px', overflowY: 'auto', marginBottom: '0.75rem',
                  background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', padding: '0.75rem',
                  display: 'flex', flexDirection: 'column', gap: '0.5rem',
                }}>
                  {messages.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', margin: 'auto', fontFamily: 'Rajdhani, sans-serif' }}>
                      No messages yet. Say hello! 👋
                    </p>
                  ) : (
                    messages.map((msg, idx) => {
                      // senderType is set by the server from the authenticated
                      // socket, so this cannot be spoofed by another client.
                      const isOwn = msg.senderType === 'customer';
                      return (
                        <div key={msg.id || idx} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            background: isOwn ? 'rgba(0,212,255,0.15)' : 'rgba(0,255,136,0.1)',
                            border: `1px solid ${isOwn ? 'rgba(0,212,255,0.3)' : 'rgba(0,255,136,0.2)'}`,
                            borderRadius: isOwn ? '0.75rem 0.75rem 0 0.75rem' : '0.75rem 0.75rem 0.75rem 0',
                            padding: '0.4rem 0.75rem',
                            maxWidth: '80%',
                          }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif', marginBottom: '0.1rem' }}>{msg.senderName}</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', wordBreak: 'break-word' }}>{msg.body}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    className="input"
                    style={{ flex: 1, fontSize: '0.82rem', padding: '0.5rem 0.75rem' }}
                    placeholder="Type a message…"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 0.875rem', fontSize: '0.78rem', fontWeight: 700 }}
                    onClick={handleSendMessage}
                    disabled={sending || !connected}
                  >
                    {sending ? '…' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{
              fontSize: '4rem', marginBottom: '1rem',
              filter: 'drop-shadow(0 0 25px rgba(0,212,255,0.5))',
            }}>📡</div>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', letterSpacing: '0.04em' }}>
              Enter Your Booking ID
            </h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 1rem', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.95rem' }}>
              Enter the booking ID you received when you booked. You&apos;ll see your driver&apos;s live position and trip status here once a driver is assigned.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

