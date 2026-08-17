const mongoose = require('mongoose');

/**
 * Real reviews (PHASE 38/43). The site previously rendered three invented
 * testimonials as "Customer Reviews".
 */
const reviewSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 1000 },
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });

reviewSchema.index({ driver: 1, createdAt: -1 });
reviewSchema.index({ isPublished: 1, rating: -1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
