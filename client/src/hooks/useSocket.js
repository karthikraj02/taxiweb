import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Realtime booking channel.
 *
 * The server now authenticates the socket handshake from the auth cookie and
 * authorises the booking room against ownership, so joining can legitimately
 * fail. `joinBookingRoom` acknowledges with the outcome plus the persisted
 * message history — a refresh no longer loses the conversation.
 */
export function useSocket(bookingId) {
  const [driverLocation, setDriverLocation] = useState(null);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [joinError, setJoinError] = useState(null);
  const [sending, setSending] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!bookingId) {
      setMessages([]);
      setJoinError(null);
      setDriverLocation(null);
      return undefined;
    }

    const socket = io(API_URL, {
      withCredentials: true,      // sends the HttpOnly auth cookie
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinBookingRoom', { bookingId }, (ack) => {
        if (!ack?.ok) {
          setJoinError(
            ack?.error === 'FORBIDDEN'
              ? 'You do not have access to this booking.'
              : 'Could not connect to live tracking.'
          );
          return;
        }
        setJoinError(null);
        setMessages(ack.messages || []);
        if (ack.status) setBookingStatus(ack.status);
      });
    });

    socket.on('connect_error', (err) => {
      setConnected(false);
      if (err?.message === 'UNAUTHENTICATED') {
        setJoinError('Please sign in to track this ride.');
      }
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('driverLocation', (loc) => setDriverLocation(loc));
    socket.on('bookingStatus', (data) => {
      if (data?.status) setBookingStatus(data.status);
    });

    socket.on('chatMessage', (msg) => {
      setMessages(prev => {
        // The server echoes to the whole room including the sender, so a
        // message can arrive twice when an optimistic ack also landed.
        if (msg.id && prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [bookingId]);

  /**
   * Sends a message. Sender identity is decided by the server from the
   * authenticated socket — passing a name from here would be ignored.
   */
  const sendMessage = useCallback((body) => {
    const socket = socketRef.current;
    if (!socket?.connected || !bookingId || !body?.trim()) return Promise.resolve(false);

    setSending(true);
    const clientMessageId = (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`);

    return new Promise((resolve) => {
      socket.emit('sendMessage', { bookingId, body: body.trim(), clientMessageId }, (ack) => {
        setSending(false);
        if (ack?.ok && ack.message) {
          setMessages(prev =>
            prev.some(m => m.id === ack.message.id) ? prev : [...prev, ack.message]
          );
          resolve(true);
        } else {
          resolve(false);
        }
      });
      // Never leave the composer stuck if the ack is lost.
      setTimeout(() => { setSending(false); resolve(false); }, 8000);
    });
  }, [bookingId]);

  const markRead = useCallback(() => {
    socketRef.current?.emit('markRead', { bookingId });
  }, [bookingId]);

  return { driverLocation, bookingStatus, connected, messages, sendMessage, markRead, joinError, sending };
}
