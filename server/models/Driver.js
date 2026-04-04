const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
  address: { type: String },
  carType: { type: String, enum: ['etios', 'dzire', 'innova', 'tempo'] },
  carNumber: String,
  driverPhoto: { type: String },
  carPhoto: { type: String },
  rating: { type: Number, default: 4.5, min: 1, max: 5 },
  isAvailable: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  otp: String,
  otpExpiry: Date,
  currentLocation: {
    lat: { type: Number, default: 13.3409 },
    lng: { type: Number, default: 74.7421 }
  },
  createdAt: { type: Date, default: Date.now }
});

driverSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.otp;
  delete obj.otpExpiry;
  return obj;
};

module.exports = mongoose.model('Driver', driverSchema);
