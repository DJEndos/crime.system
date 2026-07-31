const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  badge_number: { type: String, required: true, unique: true, trim: true },
  full_name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'ipo', 'dco'], default: 'ipo' },
  officer_rank: { type: String, default: null },
  station: { type: String, default: 'Ikot Udota Division, Eket' },
  phone: { type: String, default: null },
  is_active: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('User', userSchema);
