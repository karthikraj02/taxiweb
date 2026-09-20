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
import { Logo } from './Icons.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** The next action available at each stage of a ride. */
const NEXT_ACTION = {
  driver_assigned:  { action: 'en_route', label: 'Start driving to pickup' },
  driver_en_route:  { action: 'arrived',  label: 'I have arrived' },
  driver_arrived:   { action: 'start',    label: 'Start trip' },
  in_progress:      { action: 'complete', label: 'Complete trip' },
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
      toast('New ride request');
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

  const carLabel = driver?.carType ? driver.carType.charAt(0).toUpperCase() + driver.carType.slice(1) : 'N/A';

  return (
    <div className="dash">
      <header className="dash-nav">
        <div className="brand"><Logo size={30} /><span>Driver <em>dashboard</em></span></div>
        <div className="nav-actions">
          <span className="nav-user">{driver?.name}</span>
          <button className="btn btn-outline btn-sm" onClick={logoutDriver}>Log out</button>
        </div>
      </header>

      <div className="dash-wrap">
        {error && <div className="alert-error" role="alert">{error}</div>}

        {/*
          Approval is separate from being signed in. A driver who has verified
          their email but not yet been approved by an admin can sign in and see
          this, but cannot receive rides.
        */}
        {!canAcceptRides && (
          <div className="notice-warn">
            <strong>Account under review</strong>
            <div>
              Status: <strong>{driver?.approvalStatus?.replace(/_/g, ' ') || 'pending'}</strong>.
              {driver?.approvalStatus === 'pending_documents'
                ? ' Upload your licence, RC and insurance so an admin can verify your account.'
                : ' An admin is reviewing your documents. You will be able to accept rides once approved.'}
              {driver?.rejectionReason && <div style={{ marginTop: '0.5rem' }}>Reason: {driver.rejectionReason}</div>}
            </div>
          </div>
        )}

        {canAcceptRides && (
          <div className="card dash-card presence">
            <div>
              <div className="presence-state">
                <span className={`dot${isOnline ? ' on' : ''}`} /> {isOnline ? 'Online' : 'Offline'}
              </div>
              <div className="presence-note">
                {gpsError
                  ? gpsError
                  : sharing && position
                    ? `Sharing location · ${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`
                    : isOnline ? 'Acquiring GPS…' : 'Go online to receive ride requests'}
              </div>
            </div>
            <button
              className={`btn btn-sm ${isOnline ? 'btn-outline' : 'btn-primary'}`}
              onClick={handleToggleAvailability}
              disabled={actionLoading === 'availability' || availability === 'on_trip'}
            >
              {availability === 'on_trip' ? 'On a trip' : isOnline ? 'Go offline' : 'Go online'}
            </button>
          </div>
        )}

        {/* Active ride lifecycle controls */}
        {activeRide && NEXT_ACTION[activeRide.status] && (
          <div className="card dash-card ride-now">
            <h2 className="h-sm" style={{ color: 'var(--success)' }}>Current ride · {activeRide.bookingId}</h2>
            <div className="req-route">{activeRide.pickup} → {activeRide.drop}</div>
            <div className="req-meta" style={{ marginBottom: '1rem' }}>
              <span>{activeRide.distanceKm} km · ₹{activeRide.fare?.toLocaleString()}</span>
              {activeRide.customer?.phone && (
                <a href={`tel:${activeRide.customer.phone}`} style={{ fontWeight: 600, color: 'var(--ink)' }}>
                  Call {activeRide.customer.phone}
                </a>
              )}
            </div>
            <button className="btn btn-dark btn-block" onClick={handleAdvance} disabled={actionLoading === 'advance'}>
              {actionLoading === 'advance' ? 'Updating…' : NEXT_ACTION[activeRide.status].label}
            </button>
          </div>
        )}

        <div className="stat-grid">
          <div className="stat">
            <div className="stat-value">{loadingStats ? '—' : stats.totalRides}</div>
            <div className="stat-label">Completed rides</div>
            {!loadingStats && <div className="stat-sub">₹{(stats.totalEarnings || 0).toLocaleString()} earned</div>}
          </div>
          <div className="stat">
            <div className="stat-value" style={{ fontSize: '1.2rem', paddingTop: '0.5rem', color: activeRide ? 'var(--success)' : 'var(--text-muted)' }}>
              {activeRide ? 'On a ride' : 'No active ride'}
            </div>
            <div className="stat-label">Status</div>
          </div>
          <div className="stat">
            <div className="stat-value" style={{ fontSize: '1.2rem', paddingTop: '0.5rem' }}>{carLabel}</div>
            <div className="stat-label">{driver?.carNumber || 'Vehicle'}</div>
          </div>
        </div>

        <section className="card dash-card">
          <div className="dash-card-head">
            <h2 className="h-sm">Travel requests</h2>
            <button className="btn btn-outline btn-sm" onClick={fetchRequests}>Refresh</button>
          </div>

          {loadingRequests ? (
            <div className="dash-empty"><span className="spinner-light" /> Loading requests…</div>
          ) : requests.length === 0 ? (
            <div className="dash-empty">No pending travel requests right now.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
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
        </section>

        <section className="card dash-card">
          <h2 className="h-sm">Customer chat</h2>
          {!activeRide ? (
            <div className="dash-empty">Chat is available when you have an active ride.</div>
          ) : (
            <div>
              <div className="chat-meta">
                <span className={`dot${socketConnected ? ' on' : ''}`} />
                {socketConnected ? 'Connected' : 'Connecting…'} · Chatting with{' '}
                <strong>{activeRide.customer?.name || 'Customer'}</strong> · Booking {activeRide.bookingId}
              </div>

              <div className="chat-log" style={{ height: '260px' }}>
                {messages.length === 0 && <p className="chat-empty">No messages yet. Start the conversation.</p>}
                {messages.map((msg, i) => {
                  const isDriver = msg.senderName === (driver?.name || 'Driver');
                  return (
                    <div key={msg.id || i} className={`bubble${isDriver ? ' own' : ''}`}>
                      <small>{msg.senderName} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                      {msg.body}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="input"
                  aria-label="Message"
                  placeholder="Type a message"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={!socketConnected}
                />
                <button className="btn btn-dark" onClick={handleSendMessage} disabled={!socketConnected || !chatInput.trim()}>
                  Send
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RequestCard({ request, actionLoading, onAccept, onDecline }) {
  const isLoading = actionLoading === request.bookingId;

  const formatDate = (d) => {
    try {
      return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return d;
    }
  };

  // The accept/decline endpoints and this list are keyed by bookingId; the
  // server's request DTO has no `_id`, `date`, `distance` or `user` fields.
  return (
    <div className="req-card">
      <div style={{ flex: 1, minWidth: '200px' }}>
        <div className="req-tags">
          <b>{request.bookingId}</b>
          <span className="tag" style={{ textTransform: 'capitalize' }}>{request.carType}</span>
          <span className="tag">{request.tripType}</span>
        </div>
        <div className="req-route">{request.pickup} → {request.drop}</div>
        <div className="req-meta">
          {request.scheduledFor && <span>{formatDate(request.scheduledFor)}</span>}
          {request.distanceKm != null && <span>{request.distanceKm} km</span>}
          {request.distanceToPickupKm != null && <span>{request.distanceToPickupKm} km to pickup</span>}
          {request.fare != null && <span className="req-fare">₹{request.fare.toLocaleString()}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'center' }}>
        <button className="btn btn-outline btn-sm" onClick={() => onDecline(request.bookingId)} disabled={isLoading}>Decline</button>
        <button className="btn btn-primary btn-sm" onClick={() => onAccept(request.bookingId)} disabled={isLoading}>
          {isLoading ? '…' : 'Accept'}
        </button>
      </div>
    </div>
  );
}
