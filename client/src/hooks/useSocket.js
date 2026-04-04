import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useSocket(bookingId) {
  const [driverLocation, setDriverLocation] = useState(null);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);
  const sentMsgIds = useRef(new Set());

  useEffect(() => {
    if (!bookingId) return;

    const socket = io(import.meta.env.VITE_API_URL || '', {
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinBookingRoom', bookingId);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('driverLocation', (location) => {
      setDriverLocation(location);
    });

    socket.on('bookingStatus', (data) => {
      setBookingStatus(data.status);
    });

    socket.on('chatMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [bookingId]);

  const sendMessage = useCallback((message, senderName) => {
    if (socketRef.current?.connected && bookingId && message) {
      const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      sentMsgIds.current.add(msgId);
      socketRef.current.emit('sendMessage', { bookingId, message, senderName, msgId });
    }
  }, [bookingId]);

  return { driverLocation, bookingStatus, connected, messages, sendMessage, sentMsgIds };
}
