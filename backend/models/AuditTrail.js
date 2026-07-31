const mongoose = require('mongoose');

const auditTrailSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true },
  entity_type: { type: String, default: null },
  entity_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  details: { type: String, default: null },
  ip_address: { type: String, default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('AuditTrail', auditTrailSchema);
