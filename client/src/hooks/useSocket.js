import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSocket(bookingId) {
  const [driverLocation, setDriverLocation] = useState(null);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

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

    return () => {
      socket.disconnect();
    };
  }, [bookingId]);

  return { driverLocation, bookingStatus, connected };
}
