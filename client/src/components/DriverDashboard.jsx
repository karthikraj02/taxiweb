import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDriver } from '../context/DriverContext.jsx';
import {
  getDriverRequests,
  acceptBookingRequest,
  rejectBookingRequest,
  getDriverStats,
  getDriverActiveRide,
} from '../api/index.js';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function DriverDashboard() {
  const { driver, logoutDriver } = useDriver();

  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ totalRides: 0 });
  const [activeRide, setActiveRide] = useState(null);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Fetch requests & stats on mount
  useEffect(() => {
    fetchRequests();
    fetchStats();
  }, []);

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const { data } = await getDriverRequests();
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const { data } = await getDriverStats();
      setStats({ totalRides: data.totalRides || 0 });
      setActiveRide(data.activeRide || null);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Set up socket for active ride chat
  useEffect(() => {
    if (!activeRide) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketConnected(false);
        setMessages([]);
      }
      return;
    }

    const socket = io(API_URL, {
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('driverJoinBookingRoom', activeRide.bookingId);
    });

    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('chatMessage', (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.msgId && m.msgId === msg.msgId)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('bookingStatus', ({ status }) => {
      if (status === 'completed') {
        fetchStats();
        toast.success('Ride completed!');
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeRide?.bookingId, fetchStats]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAccept = async (bookingId) => {
    setActionLoading(bookingId);
    try {
      await acceptBookingRequest(bookingId);
      toast.success('Booking accepted!');
      setRequests((prev) => prev.filter((r) => r._id !== bookingId && r.bookingId !== bookingId));
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept booking');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (bookingId) => {
    setActionLoading(bookingId);
    try {
      await rejectBookingRequest(bookingId);
      toast('Booking rejected', { icon: '❌' });
      setRequests((prev) => prev.filter((r) => r._id !== bookingId && r.bookingId !== bookingId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject booking');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendMessage = () => {
    const text = chatInput.trim();
    if (!text || !activeRide || !socketRef.current) return;
    const msgId = crypto.randomUUID();
    socketRef.current.emit('sendMessage', {
      bookingId: activeRide.bookingId,
      message: text,
      senderName: driver?.name || 'Driver',
      msgId,
    });
    setChatInput('');
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
                  key={req._id}
                  request={req}
                  actionLoading={actionLoading}
                  onAccept={handleAccept}
                  onReject={handleReject}
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
                <strong style={{ color: 'var(--text-light, #e0f4ff)' }}>{activeRide.user?.name || 'Customer'}</strong>
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
                        <div style={{ fontSize: '0.9rem' }}>{msg.text}</div>
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

function RequestCard({ request, actionLoading, onAccept, onReject }) {
  const isLoading = actionLoading === request._id || actionLoading === request.bookingId;

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
          onClick={() => onReject(request._id)}
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
