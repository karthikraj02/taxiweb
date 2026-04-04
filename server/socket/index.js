const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

let io;

const UDUPI = { lat: 13.3409, lng: 74.7421 };

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (token) {
        const secret = process.env.JWT_SECRET;
        if (secret) {
          const decoded = jwt.verify(token, secret);
          socket.user = decoded;
        }
      }
    } catch (err) {
      console.debug('Socket JWT verification failed (unauthenticated connection allowed):', err.message);
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on('joinBookingRoom', (bookingId) => {
      socket.join(`booking:${bookingId}`);
      socket.emit('joinedRoom', { bookingId });
      startDriverSimulation(bookingId);
    });

    socket.on('sendMessage', ({ bookingId, message, senderName, msgId }) => {
      if (!bookingId || !message) return;
      const msg = {
        msgId: msgId || null,
        text: message,
        senderName: senderName || 'User',
        timestamp: new Date().toISOString(),
      };
      io.to(`booking:${bookingId}`).emit('chatMessage', msg);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
}

const simulations = new Map();

function startDriverSimulation(bookingId) {
  if (simulations.has(bookingId)) return;

  let step = 0;
  const totalSteps = 40;
  const startLat = UDUPI.lat + 0.018;
  const startLng = UDUPI.lng - 0.015;
  const endLat = UDUPI.lat;
  const endLng = UDUPI.lng;

  const interval = setInterval(() => {
    if (!io) { clearInterval(interval); return; }
    const progress = step / totalSteps;
    const lat = startLat + (endLat - startLat) * progress;
    const lng = startLng + (endLng - startLng) * progress;

    io.to(`booking:${bookingId}`).emit('driverLocation', { lat, lng, heading: 45 });

    let status;
    if (step < 5) status = 'driver_assigned';
    else if (step < 15) status = 'en_route';
    else if (step < 20) status = 'arrived';
    else if (step < 35) status = 'in_progress';
    else status = 'completed';

    io.to(`booking:${bookingId}`).emit('bookingStatus', { status, bookingId });

    step++;
    if (step > totalSteps) {
      clearInterval(interval);
      simulations.delete(bookingId);
    }
  }, 3000);

  simulations.set(bookingId, interval);
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO, startDriverSimulation };
