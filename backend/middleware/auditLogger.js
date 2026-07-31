const AuditTrail = require('../models/AuditTrail');

/**
 * Records an entry in the audit trail collection.
 * Never throws — a logging failure should not break the main request.
 */
async function logAction({ userId, action, entityType, entityId, details, ip }) {
  try {
    await AuditTrail.create({
      user_id: userId || null,
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      details: details || null,
      ip_address: ip || null
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { logAction };
