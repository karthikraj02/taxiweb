const { Server } = require('socket.io');
const env = require('../config/env');
const logger = require('../utils/logger');
const tokens = require('../services/tokens');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const Message = require('../models/Message');
const dto = require('../dto');

/**
 * Socket.IO (PHASE 22/23/24).
 *
 * What this replaces, and why each piece mattered:
 *
 *   - The old `io.use` verified a JWT but swallowed every failure and called
 *     next() regardless, so unauthenticated sockets connected normally.
 *   - `joinBookingRoom` joined `booking:<anything>` with no ownership check.
 *     Any connected client could enumerate booking ids and read another
 *     customer's chat and live driver GPS.
 *   - `sendMessage` trusted `senderName` from the payload, so a client could
 *     post as the driver.
 *   - `startDriverSimulation` fired on every room join and emitted fabricated
 *     GPS plus fabricated status transitions up to `completed` — the UI would
 *     show a finished trip for a booking the database still had as `pending`.
 *     It is deleted, not gated.
 */

let io = null;

const MAX_MESSAGE_LENGTH = 1000;
const CHAT_WINDOW_MS = 10_000;
const CHAT_MAX_PER_WINDOW = 10;

const roomForBooking = (bookingId) => `booking:${bookingId}`;
const roomForDriver = (driverId) => `driver:${driverId}`;

/**
 * Reads a token from the handshake auth payload or the Cookie header.
 *
 * Parsed inline rather than via the `cookie` package: v1 of that library ships
 * ESM-only, and the parsing needed here is a single name lookup.
 */
function tokenFromHandshake(handshake, cookieName) {
  if (handshake.auth?.token) return handshake.auth.token;
  const raw = handshake.headers?.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === cookieName) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return part.slice(idx + 1).trim();
      }
    }
  }
  return null;
}

/**
 * Handshake authentication. A socket that cannot prove an identity is
 * rejected outright — there is no anonymous tier.
 */
async function authenticateSocket(socket, next) {
  try {
    const driverToken = tokenFromHandshake(socket.handshake, tokens.ACCESS_COOKIE.driver);
    if (driverToken) {
      try {
        const decoded = tokens.verifyAccessToken(driverToken, 'driver');
        const driver = await Driver.findById(decoded.sub);
        if (driver && driver.approvalStatus !== 'suspended') {
          socket.principal = {
            type: 'driver',
            id: driver._id.toString(),
            name: driver.name,
          };
          return next();
        }
      } catch { /* fall through to the user token */ }
    }

    const userToken = tokenFromHandshake(socket.handshake, tokens.ACCESS_COOKIE.user);
    if (userToken) {
      const decoded = tokens.verifyAccessToken(userToken, 'user');
      const user = await User.findById(decoded.sub);
      if (user) {
        socket.principal = {
          type: user.role === 'admin' ? 'admin' : 'customer',
          id: user._id.toString(),
          name: user.name,
        };
        return next();
      }
    }

    return next(new Error('UNAUTHENTICATED'));
  } catch (err) {
    logger.debug('Socket authentication rejected', { error: err.message });
    return next(new Error('UNAUTHENTICATED'));
  }
}

/**
 * Authorisation for a booking room. Returns the booking when the principal is
 * the owning customer, the assigned driver, or an admin — otherwise null.
 */
async function authorizeBookingAccess(principal, bookingRef) {
  const or = [{ bookingId: bookingRef }];
  if (/^[0-9a-fA-F]{24}$/.test(bookingRef)) or.push({ _id: bookingRef });

  const booking = await Booking.findOne({ $or: or });
  if (!booking) return null;

  if (principal.type === 'admin') return booking;
  if (principal.type === 'customer' && booking.user.toString() === principal.id) return booking;
  if (principal.type === 'driver' && booking.driver?.toString() === principal.id) return booking;

  return null;
}

function initSocket(server) {
  const origins = [env.clientUrl, ...env.allowedOrigins].filter(Boolean);

  io = new Server(server, {
    cors: { origin: origins, credentials: true },
    // Trim the payload ceiling; chat messages are small.
    maxHttpBufferSize: 1e5,
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const principal = socket.principal;
    logger.debug('Socket connected', { type: principal.type, id: principal.id });

    // Drivers get a private room so dispatch can push ride offers to exactly
    // the drivers it selected.
    if (principal.type === 'driver') {
      socket.join(roomForDriver(principal.id));
    }

    socket.chatTimestamps = [];

    // -------------------------------------------------- join a booking room
    socket.on('joinBookingRoom', async (payload, ack) => {
      try {
        const bookingRef = typeof payload === 'string' ? payload : payload?.bookingId;
        if (!bookingRef || typeof bookingRef !== 'string') {
          return ack?.({ ok: false, error: 'INVALID_BOOKING_ID' });
        }

        const booking = await authorizeBookingAccess(principal, bookingRef);
        if (!booking) {
          logger.warn('Rejected booking room join', {
            principalType: principal.type, principalId: principal.id, bookingRef,
          });
          return ack?.({ ok: false, error: 'FORBIDDEN' });
        }

        socket.join(roomForBooking(booking.bookingId));

        // PHASE 23 — replay history so a refresh does not lose the conversation.
        const history = await Message.find({ booking: booking._id })
          .sort({ createdAt: 1 }).limit(200);

        ack?.({
          ok: true,
          bookingId: booking.bookingId,
          status: booking.status,
          messages: history.map(dto.message),
        });
      } catch (err) {
        logger.error('joinBookingRoom failed', { error: err.message });
        ack?.({ ok: false, error: 'INTERNAL_ERROR' });
      }
    });

    // ------------------------------------------------------------- chat send
    socket.on('sendMessage', async (payload, ack) => {
      try {
        const bookingRef = payload?.bookingId;
        const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
        const clientMessageId = typeof payload?.clientMessageId === 'string'
          ? payload.clientMessageId.slice(0, 64)
          : undefined;

        if (!bookingRef || !body) return ack?.({ ok: false, error: 'INVALID_MESSAGE' });
        if (body.length > MAX_MESSAGE_LENGTH) {
          return ack?.({ ok: false, error: 'MESSAGE_TOO_LONG' });
        }

        // Per-socket sliding-window rate limit.
        const now = Date.now();
        socket.chatTimestamps = socket.chatTimestamps.filter(t => now - t < CHAT_WINDOW_MS);
        if (socket.chatTimestamps.length >= CHAT_MAX_PER_WINDOW) {
          return ack?.({ ok: false, error: 'RATE_LIMITED' });
        }
        socket.chatTimestamps.push(now);

        const booking = await authorizeBookingAccess(principal, bookingRef);
        if (!booking) return ack?.({ ok: false, error: 'FORBIDDEN' });

        // Sender identity comes from the authenticated principal. The payload
        // has no say in who the message is from.
        let saved;
        try {
          saved = await Message.create({
            booking: booking._id,
            bookingId: booking.bookingId,
            senderType: principal.type,
            sender: principal.id,
            senderName: principal.name,
            body,
            clientMessageId,
          });
        } catch (err) {
          if (err.code === 11000 && clientMessageId) {
            // Duplicate delivery of the same client message — return the original.
            saved = await Message.findOne({ booking: booking._id, clientMessageId });
            if (saved) return ack?.({ ok: true, message: dto.message(saved), duplicate: true });
          }
          throw err;
        }

        io.to(roomForBooking(booking.bookingId)).emit('chatMessage', dto.message(saved));
        ack?.({ ok: true, message: dto.message(saved) });
      } catch (err) {
        logger.error('sendMessage failed', { error: err.message });
        ack?.({ ok: false, error: 'INTERNAL_ERROR' });
      }
    });

    // ------------------------------------------------------------ read state
    socket.on('markRead', async (payload, ack) => {
      try {
        const booking = await authorizeBookingAccess(principal, payload?.bookingId);
        if (!booking) return ack?.({ ok: false, error: 'FORBIDDEN' });

        await Message.updateMany(
          { booking: booking._id, senderType: { $ne: principal.type }, readAt: null },
          { readAt: new Date() }
        );
        io.to(roomForBooking(booking.bookingId)).emit('messagesRead', {
          bookingId: booking.bookingId,
          by: principal.type,
        });
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: 'INTERNAL_ERROR' });
      }
    });

    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { type: principal.type, id: principal.id });
    });
  });

  return io;
}

/**
 * Server-side emit helpers (PHASE 24).
 *
 * Every realtime status event originates from one of these, called from a
 * route handler after a validated database transition. Clients cannot emit
 * status changes — there is no listener for them.
 */
function emitToBooking(bookingId, event, payload) {
  if (!io || !bookingId) return;
  io.to(roomForBooking(bookingId)).emit(event, payload);
}

function emitToDriver(driverId, event, payload) {
  if (!io || !driverId) return;
  io.to(roomForDriver(driverId)).emit(event, payload);
}

function getIO() {
  return io;
}

module.exports = {
  initSocket,
  getIO,
  emitToBooking,
  emitToDriver,
  roomForBooking,
  roomForDriver,
  authorizeBookingAccess,
};
