const mongoose = require('mongoose');

const suspectSchema = new mongoose.Schema({
  crime_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Crime', required: true },
  full_name: { type: String, required: true, trim: true },
  alias: { type: String, default: null },
  gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
  age: { type: Number, default: null },
  address: { type: String, default: null },
  phone: { type: String, default: null },
  national_id: { type: String, default: null },
  status: { type: String, enum: ['at_large', 'arrested', 'released', 'convicted', 'deceased'], default: 'at_large' },
  photo_path: { type: String, default: null },
  notes: { type: String, default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

suspectSchema.index({ full_name: 'text', alias: 'text', address: 'text', national_id: 'text' });

module.exports = mongoose.model('Suspect', suspectSchema);
