const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pickup: { type: String, required: true },
  drop: { type: String, required: true },
  pickupCoords: { lat: Number, lng: Number },
  dropCoords: { lat: Number, lng: Number },
  date: { type: Date, required: true },
  time: String,
  carType: { type: String, enum: ['etios', 'dzire', 'innova', 'tempo'], required: true },
  tripType: { type: String, enum: ['one-way', 'round-trip'], default: 'one-way' },
  distance: Number,
  fare: Number,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'driver_assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
