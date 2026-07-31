const mongoose = require('mongoose');

const courtRecordSchema = new mongoose.Schema({
  crime_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Crime', required: true },
  suspect_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Suspect', default: null },
  court_name: { type: String, default: null },
  case_file_no: { type: String, default: null },
  judge_name: { type: String, default: null },
  hearing_date: { type: Date, default: null },
  verdict: { type: String, enum: ['pending', 'guilty', 'not_guilty', 'dismissed', 'adjourned'], default: 'pending' },
  notes: { type: String, default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('CourtRecord', courtRecordSchema);
