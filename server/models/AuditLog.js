const mongoose = require('mongoose');

/** Audit trail for privileged and state-changing operations (PHASE 36). */
const auditLogSchema = new mongoose.Schema({
  actorType: { type: String, enum: ['user', 'driver', 'admin', 'system', 'webhook'], required: true },
  actor: { type: mongoose.Schema.Types.ObjectId },
  actorLabel: { type: String },

  action: { type: String, required: true },        // e.g. 'driver.approve'
  resource: { type: String, required: true },      // e.g. 'Driver'
  resourceId: { type: String },

  oldValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },

  ip: { type: String },
  userAgent: { type: String },
  requestId: { type: String },
  success: { type: Boolean, default: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
