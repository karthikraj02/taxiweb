const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  carType: { type: String, enum: ['etios', 'dzire', 'innova', 'tempo'] },
  carNumber: String,
  rating: { type: Number, default: 4.5, min: 1, max: 5 },
  isAvailable: { type: Boolean, default: true },
  currentLocation: {
    lat: { type: Number, default: 13.3409 },
    lng: { type: Number, default: 74.7421 }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Driver', driverSchema);
