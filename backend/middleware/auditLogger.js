const pool = require('../config/db');

/**
 * Records an entry in the audit_trail table.
 * Never throws — a logging failure should not break the main request.
 */
async function logAction({ userId, action, entityType, entityId, details, ip }) {
  try {
    await pool.query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId || null, action, entityType || null, entityId || null, details || null, ip || null]
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { logAction };
