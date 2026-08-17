const mongoose = require('mongoose');

/** Real contact-form storage (PHASE 37). The form used to fake a 800ms delay. */
const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['new', 'in_progress', 'resolved'], default: 'new' },
  emailDelivered: { type: Boolean, default: false },
  emailError: { type: String },
  ip: { type: String },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminResponse: { type: String, maxlength: 2000 },
}, { timestamps: true });

contactMessageSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
