import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDriver } from '../context/DriverContext.jsx';
import { useDriverLocation } from '../hooks/useDriverLocation.js';
import {
  getDriverRequests, acceptBookingRequest, declineBookingRequest,
  getDriverStats, advanceRide, setDriverAvailability,
  unwrap, apiError,
} from '../api/index.js';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** The next action available at each stage of a ride. */
const NEXT_ACTION = {
  driver_assigned:  { action: 'en_route', label: '🛣️ Start driving to pickup' },
  driver_en_route:  { action: 'arrived',  label: '📍 I have arrived' },
  driver_arrived:   { action: 'start',    label: '🚕 Start trip' },
  in_progress:      { action: 'complete', label: '🏁 Complete trip' },
};

export default function DriverDashboard() {
  const { driver, logoutDriver, canAcceptRides, refreshDriver } = useDriver();

  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ totalRides: 0, totalEarnings: 0 });
  const [activeRide, setActiveRide] = useState(null);
  const [availability, setAvailability] = useState(driver?.availability || 'offline');
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);

  const isOnline = availability === 'online' || availability === 'on_trip';

  // Real device GPS, streamed only while the driver is online (PHASE 17).
  const { position, error: gpsError, sharing, captureOnce } = useDriverLocation({ enabled: isOnline });

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = unwrap(await getDriverStats());
      setStats({ totalRides: data.totalRides || 0, totalEarnings: data.totalEarnings || 0 });
      setActiveRide(data.activeRide || null);
      if (data.availability) setAvailability(data.availability);
    } catch (err) {
      setError(apiError(err, 'Could not load your dashboard.'));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    if (!canAcceptRides) return;
    setLoadingRequests(true);
    try {
      setRequests(unwrap(await getDriverRequests()).requests || []);
    } catch (err) {
      setError(apiError(err, 'Could not load ride requests.'));
    } finally {
      setLoadingRequests(false);
    }
  }, [canAcceptRides]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (isOnline && !activeRide) fetchRequests(); }, [isOnline, activeRide, fetchRequests]);

  // Poll for offers while online and free.
  useEffect(() => {
    if (!isOnline || activeRide || !canAcceptRides) return undefined;
    const timer = setInterval(fetchRequests, 15000);
    return () => clearInterval(timer);
  }, [isOnline, activeRide, canAcceptRides, fetchRequests]);

  // Authenticated socket: chat on the active ride, plus pushed ride offers.
  useEffect(() => {
    if (!canAcceptRides) return undefined;

    const socket = io(API_URL, {
      withCredentials: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));

    socket.on('rideOffer', (offer) => {
      setRequests(prev => (prev.some(r => r.bookingId === offer.bookingId) ? prev : [offer, ...prev]));
      toast('New ride request', { icon: '🚕' });
    });

    socket.on('chatMessage', (msg) => {
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [canAcceptRides]);

  // Join the active ride's room and load persisted history.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeRide?.bookingId) { setMessages([]); return; }

    const join = () => socket.emit('joinBookingRoom', { bookingId: activeRide.bookingId }, (ack) => {
      if (ack?.ok) setMessages(ack.messages || []);
    });

    if (socket.connected) join();
    socket.on('connect', join);
    return () => socket.off('connect', join);
  }, [activeRide?.bookingId, socketConnected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleToggleAvailability = async () => {
    setError(null);
    const next = isOnline ? 'offline' : 'online';
    setActionLoading('availability');
    try {
      // The server refuses to put a driver online without a known position,
      // so capture one first rather than letting the call fail.
      if (next === 'online') {
        const coords = await captureOnce();
        if (!coords) { setError('We need your location before you can go online.'); return; }
      }
      setAvailability(unwrap(await setDriverAvailability(next)).availability);
      toast.success(next === 'online' ? "You're online." : "You're offline.");
      await refreshDriver();
    } catch (err) {
      setError(apiError(err, 'Could not change your availability.'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = async (bookingId) => {
    setActionLoading(bookingId);
    setError(null);
    try {
      const data = unwrap(await acceptBookingRequest(bookingId));
      setActiveRide(data.booking);
      setRequests(prev => prev.filter(r => r.bookingId !== bookingId));
      toast.success('Ride accepted.');
      fetchStats();
    } catch (err) {
      // A lost race is normal, not an error state to panic about.
      setError(apiError(err, 'Could not accept that ride.'));
      setRequests(prev => prev.filter(r => r.bookingId !== bookingId));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (bookingId) => {
    setActionLoading(bookingId);
    try {
      await declineBookingRequest(bookingId);
      setRequests(prev => prev.filter(r => r.bookingId !== bookingId));
    } catch {
      setRequests(prev => prev.filter(r => r.bookingId !== bookingId));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdvance = async () => {
    if (!activeRide) return;
    const next = NEXT_ACTION[activeRide.status];
    if (!next) return;

    setActionLoading('advance');
    setError(null);
    try {
      const data = unwrap(await advanceRide(activeRide.bookingId, next.action));
      if (next.action === 'complete') {
        setActiveRide(null);
        toast.success('Trip completed.');
      } else {
        setActiveRide(data.booking);
      }
      fetchStats();
    } catch (err) {
      setError(apiError(err, 'Could not update the ride.'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendMessage = () => {
    const text = chatInput.trim();
    if (!text || !activeRide || !socketRef.current) return;
    setChatInput('');
    socketRef.current.emit(
      'sendMessage',
      {
        bookingId: activeRide.bookingId,
        body: text,
        clientMessageId: crypto.randomUUID?.() || `${Date.now()}`,
      },
      (ack) => {
        if (ack?.ok && ack.message) {
          setMessages(prev => (prev.some(m => m.id === ack.message.id) ? prev : [...prev, ack.message]));
        } else {
          setChatInput(text);
          setError('Message could not be sent.');
        }
      }
    );
  };

  const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(0,212,255,0.15)',
    borderRadius: '1rem',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  };

  const sectionTitleStyle = {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--primary)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg, #08122a)',
      color: 'var(--text-light, #e0f4ff)',
      fontFamily: 'Rajdhani, sans-serif',
    }}>
      {/* Top Navbar */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 2rem',
        borderBottom: '1px solid rgba(0,212,255,0.12)',
        background: 'rgba(8,18,42,0.98)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🚖</span>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.05em' }}>
            Driver Dashboard
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted, #8899aa)' }}>
            👤 {driver?.name}
          </span>
          <button
            onClick={logoutDriver}
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171',
              borderRadius: '0.5rem',
              padding: '0.45rem 1rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Logout
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {error && (
          <div role="alert" style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5', borderRadius: '0.75rem', padding: '0.85rem 1.15rem',
            marginBottom: '1.5rem', fontSize: '0.85rem',
          }}>{error}</div>
        )}

        {/*
          Approval is separate from being signed in. A driver who has verified
          their email but not yet been approved by an admin can sign in and see
          this, but cannot receive rides.
        */}
        {!canAcceptRides && (
          <div style={{
            background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.3)',
            color: '#fbbf24', borderRadius: '1rem', padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
          }}>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>⏳ Account under review</div>
            <div style={{ fontSize: '0.85rem', lineHeight: 1.6, color: '#fde68a' }}>
              Status: <strong>{driver?.approvalStatus?.replace(/_/g, ' ') || 'pending'}</strong>.
              {driver?.approvalStatus === 'pending_documents'
                ? ' Upload your licence, RC and insurance so an admin can verify your account.'
                : ' An admin is reviewing your documents. You will be able to accept rides once approved.'}
              {driver?.rejectionReason && <div style={{ marginTop: '0.5rem' }}>Reason: {driver.rejectionReason}</div>}
            </div>
          </div>
        )}

        {canAcceptRides && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '1rem', flexWrap: 'wrap',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,212,255,0.15)',
            borderRadius: '1rem', padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem' }}>
                {isOnline ? '🟢 Online' : '⚫ Offline'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #8899aa)' }}>
                {gpsError
                  ? `⚠ ${gpsError}`
                  : sharing && position
                    ? `📡 Sharing location · ${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`
                    : isOnline ? 'Acquiring GPS…' : 'Go online to receive ride requests'}
              </div>
            </div>
            <button
              onClick={handleToggleAvailability}
              disabled={actionLoading === 'availability' || availability === 'on_trip'}
              style={{
                background: isOnline ? 'rgba(239,68,68,0.12)' : 'linear-gradient(135deg, #00d4ff, #7b2fff)',
                border: isOnline ? '1px solid rgba(239,68,68,0.3)' : 'none',
                color: isOnline ? '#f87171' : '#fff',
                borderRadius: '0.5rem', padding: '0.6rem 1.4rem',
                cursor: availability === 'on_trip' ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem', fontWeight: 700, fontFamily: 'inherit',
                opacity: availability === 'on_trip' ? 0.5 : 1,
              }}
            >
              {availability === 'on_trip' ? 'On a trip' : isOnline ? 'Go offline' : 'Go online'}
            </button>
          </div>
        )}

        {/* Active ride lifecycle controls */}
        {activeRide && NEXT_ACTION[activeRide.status] && (
          <div style={{
            background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.28)',
            borderRadius: '1rem', padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
          }}>
            <div style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Current ride · {activeRide.bookingId}
            </div>
            <div style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>
              {activeRide.pickup} → {activeRide.drop}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #8899aa)', marginBottom: '1rem' }}>
              {activeRide.distanceKm} km · ₹{activeRide.fare?.toLocaleString()}
              {activeRide.customer?.phone && (
                <> · <a href={`tel:${activeRide.customer.phone}`} style={{ color: '#00d4ff' }}>
                  📞 {activeRide.customer.phone}
                </a></>
              )}
            </div>
            <button
              onClick={handleAdvance}
              disabled={actionLoading === 'advance'}
              style={{
                background: 'linear-gradient(135deg, #22c55e, #00d4ff)', border: 'none', color: '#fff',
                borderRadius: '0.5rem', padding: '0.7rem 1.5rem', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: 700, fontFamily: 'inherit', width: '100%',
              }}
            >
              {actionLoading === 'advance' ? 'Updating…' : NEXT_ACTION[activeRide.status].label}
            </button>
          </div>
        )}

        {/* Stats section */}
        <div style={{ ...cardStyle, display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{
            flex: 1,
            minWidth: '160px',
            background: 'rgba(0,212,255,0.06)',
            border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#00d4ff', lineHeight: 1 }}>
              {loadingStats ? '—' : stats.totalRides}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#4ade80', marginTop: '0.2rem', fontWeight: 700 }}>
              {loadingStats ? '' : `₹${(stats.totalEarnings || 0).toLocaleString()} earned`}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #8899aa)', marginTop: '0.4rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Total Rides
            </div>
          </div>
          <div style={{
            flex: 1,
            minWidth: '160px',
            background: activeRide ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${activeRide ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '0.75rem',
            padding: '1.25rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', lineHeight: 1 }}>
              {activeRide ? '🟢' : '⚫'}
            </div>
            <div style={{ fontSize: '0.8rem', color: activeRide ? '#4ade80' : 'var(--text-muted, #8899aa)', marginTop: '0.4rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {activeRide ? 'On Active Ride' : 'No Active Ride'}
            </div>
          </div>
          <div style={{
            flex: 1,
            minWidth: '160px',
            background: 'rgba(123,47,255,0.06)',
            border: '1px solid rgba(123,47,255,0.2)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', lineHeight: 1 }}>🚗</div>
            <div style={{ fontSize: '0.75rem', color: '#a78bfa', marginTop: '0.4rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {driver?.carType ? driver.carType.charAt(0).toUpperCase() + driver.carType.slice(1) : 'N/A'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #8899aa)', marginTop: '0.2rem' }}>
              {driver?.carNumber || '—'}
            </div>
          </div>
        </div>

        {/* Travel Requests */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <p style={{ ...sectionTitleStyle, marginBottom: 0 }}>📋 Customer Travel Requests</p>
            <button
              onClick={fetchRequests}
              style={{
                background: 'rgba(0,212,255,0.08)',
                border: '1px solid rgba(0,212,255,0.2)',
                color: '#00d4ff',
                borderRadius: '0.4rem',
                padding: '0.3rem 0.75rem',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              ↻ Refresh
            </button>
          </div>

          {loadingRequests ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted, #8899aa)' }}>
              <span className="spinner" style={{ display: 'inline-block' }} /> Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: 'var(--text-muted, #8899aa)',
              border: '1px dashed rgba(255,255,255,0.08)',
              borderRadius: '0.75rem',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>No pending travel requests</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {requests.map((req) => (
                <RequestCard
                  key={req.bookingId}
                  request={req}
                  actionLoading={actionLoading}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                />
              ))}
            </div>
          )}
        </div>

        {/* Chat section */}
        <div style={cardStyle}>
          <p style={sectionTitleStyle}>💬 Customer Chat</p>
          {!activeRide ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: 'var(--text-muted, #8899aa)',
              border: '1px dashed rgba(255,255,255,0.08)',
              borderRadius: '0.75rem',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Chat is available when you have an active ride</p>
            </div>
          ) : (
            <div>
              <div style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted, #8899aa)',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: socketConnected ? '#4ade80' : '#f87171',
                  display: 'inline-block',
                }} />
                {socketConnected ? 'Connected' : 'Connecting...'} • Chatting with{' '}
                <strong style={{ color: 'var(--text-light, #e0f4ff)' }}>{activeRide.customer?.name || 'Customer'}</strong>
                {' '}• Booking {activeRide.bookingId}
              </div>

              {/* Messages */}
              <div style={{
                height: '260px',
                overflowY: 'auto',
                border: '1px solid rgba(0,212,255,0.12)',
                borderRadius: '0.75rem',
                padding: '0.75rem',
                marginBottom: '0.75rem',
                background: 'rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted, #8899aa)', fontSize: '0.85rem', marginTop: '5rem' }}>
                    No messages yet. Start the conversation!
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isDriver = msg.senderName === (driver?.name || 'Driver');
                  return (
                    <div key={msg.msgId || i} style={{
                      display: 'flex',
                      justifyContent: isDriver ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        maxWidth: '70%',
                        background: isDriver
                          ? 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(123,47,255,0.25))'
                          : 'rgba(255,255,255,0.06)',
                        border: isDriver ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: isDriver ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0',
                        padding: '0.5rem 0.85rem',
                      }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #8899aa)', marginBottom: '0.2rem', fontWeight: 600 }}>
                          {msg.senderName}
                        </div>
                        <div style={{ fontSize: '0.9rem' }}>{msg.body}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #8899aa)', marginTop: '0.2rem', textAlign: 'right' }}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="input"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={!socketConnected}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!socketConnected || !chatInput.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #00d4ff, #7b2fff)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '0.5rem',
                    padding: '0 1.25rem',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    opacity: (!socketConnected || !chatInput.trim()) ? 0.5 : 1,
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestCard({ request, actionLoading, onAccept, onDecline }) {
  const isLoading = actionLoading === request.bookingId;

  const formatDate = (d) => {
    try {
      return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (_) {
      return d;
    }
  };

  return (
    <div style={{
      background: 'rgba(0,212,255,0.03)',
      border: '1px solid rgba(0,212,255,0.12)',
      borderRadius: '0.75rem',
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '1rem',
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: '200px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#00d4ff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {request.bookingId}
          </span>
          <span style={{
            fontSize: '0.65rem',
            background: 'rgba(123,47,255,0.2)',
            color: '#a78bfa',
            borderRadius: '0.25rem',
            padding: '0.1rem 0.4rem',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}>
            {request.carType}
          </span>
          <span style={{
            fontSize: '0.65rem',
            background: 'rgba(0,212,255,0.1)',
            color: '#67e8f9',
            borderRadius: '0.25rem',
            padding: '0.1rem 0.4rem',
            fontWeight: 600,
          }}>
            {request.tripType}
          </span>
        </div>

        <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.2rem' }}>
          📍 {request.pickup}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #8899aa)', marginBottom: '0.5rem' }}>
          🏁 {request.drop}
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted, #8899aa)' }}>
          <span>📅 {formatDate(request.date)}{request.time ? ` @ ${request.time}` : ''}</span>
          {request.distance && <span>📏 {request.distance} km</span>}
          {request.fare && (
            <span style={{ color: '#4ade80', fontWeight: 700 }}>₹{request.fare}</span>
          )}
        </div>

        {request.user && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #8899aa)' }}>
            👤 {request.user.name}{request.user.phone ? ` • ${request.user.phone}` : ''}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'center' }}>
        <button
          onClick={() => onDecline(request._id)}
          disabled={isLoading}
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171',
            borderRadius: '0.5rem',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 700,
            fontFamily: 'Rajdhani, sans-serif',
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          ✗ Reject
        </button>
        <button
          onClick={() => onAccept(request._id)}
          disabled={isLoading}
          style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(21,128,61,0.25))',
            border: '1px solid rgba(34,197,94,0.4)',
            color: '#4ade80',
            borderRadius: '0.5rem',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 700,
            fontFamily: 'Rajdhani, sans-serif',
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          {isLoading ? '...' : '✓ Accept'}
        </button>
      </div>
    </div>
  );
}
