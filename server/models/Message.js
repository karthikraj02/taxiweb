const mongoose = require('mongoose');

/**
 * Persistent chat (PHASE 23).
 *
 * Previously messages existed only in the Socket.IO broadcast — a refresh or a
 * reconnect lost the entire conversation, and `senderName` came from the
 * client so anyone could post as "Ravi Kumar". Sender identity is now derived
 * from the authenticated socket, never from the payload.
 */
const messageSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  bookingId: { type: String, required: true },

  senderType: { type: String, enum: ['customer', 'driver', 'admin', 'system'], required: true },
  sender: { type: mongoose.Schema.Types.ObjectId },
  senderName: { type: String, required: true },   // snapshot, resolved server-side

  body: { type: String, required: true, maxlength: 1000 },

  // Client-generated id used purely for optimistic-UI deduplication.
  clientMessageId: { type: String },

  deliveredAt: { type: Date, default: Date.now },
  readAt: { type: Date, default: null },
}, { timestamps: true });

messageSchema.index({ booking: 1, createdAt: 1 });
messageSchema.index(
  { booking: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } }
);

module.exports = mongoose.model('Message', messageSchema);
