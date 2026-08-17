const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Append-only audit trail (PHASE 36).
 * Never throws — a failed audit write must not break the operation it records,
 * but it is logged loudly so the gap is visible.
 */
async function record({
  actorType, actor, actorLabel,
  action, resource, resourceId,
  oldValue, newValue,
  req, success = true,
}) {
  try {
    await AuditLog.create({
      actorType,
      actor,
      actorLabel,
      action,
      resource,
      resourceId: resourceId ? String(resourceId) : undefined,
      oldValue: oldValue ? logger.redact(oldValue) : undefined,
      newValue: newValue ? logger.redact(newValue) : undefined,
      ip: req?.ip,
      userAgent: req?.get?.('user-agent'),
      requestId: req?.id,
      success,
    });
  } catch (err) {
    logger.error('Audit write failed', { action, resource, error: err.message });
  }
}

module.exports = { record };
