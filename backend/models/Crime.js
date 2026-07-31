const mongoose = require('mongoose');

const crimeSchema = new mongoose.Schema({
  case_number: { type: String, required: true, unique: true },
  crime_type: { type: String, required: true, trim: true },
  description: { type: String, default: null },
  location: { type: String, default: null },
  date_occurred: { type: Date, default: null },
  date_reported: { type: Date, required: true },
  victim_name: { type: String, default: null },
  victim_gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
  victim_phone: { type: String, default: null },
  status: { type: String, enum: ['open', 'under_investigation', 'closed', 'in_court'], default: 'open' },
  reported_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assigned_officer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

crimeSchema.index({ crime_type: 'text', description: 'text', location: 'text', victim_name: 'text', case_number: 'text' });

module.exports = mongoose.model('Crime', crimeSchema);
