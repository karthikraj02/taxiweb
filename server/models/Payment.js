const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  amount: Number,
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created' },
  receipt: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);
