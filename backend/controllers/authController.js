const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logAction } = require('../middleware/auditLogger');
require('dotenv').config();

// POST /api/auth/login
async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }
  try {
    const user = await User.findOne({ username: username.toLowerCase(), is_active: true });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await logAction({ userId: user._id, action: 'LOGIN', entityType: 'user', entityId: user._id, ip: req.ip });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        full_name: user.full_name,
        username: user.username,
        role: user.role,
        badge_number: user.badge_number,
        station: user.station
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
}

// GET /api/auth/me
async function me(req, res) {
  try {
    const user = await User.findById(req.user.id).select('full_name username role badge_number station phone');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// POST /api/auth/register  (admin only — creates IPO / DCO / admin accounts)
async function register(req, res) {
  const { full_name, username, password, role, badge_number, officer_rank, phone, station } = req.body;
  if (!full_name || !username || !password || !role || !badge_number) {
    return res.status(400).json({ success: false, message: 'full_name, username, password, role and badge_number are required.' });
  }
  if (!['admin', 'ipo', 'dco'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Role must be admin, ipo, or dco.' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      full_name, username: username.toLowerCase(), password_hash: hash, role, badge_number,
      officer_rank: officer_rank || null, phone: phone || null, station: station || 'Ikot Udota Division, Eket'
    });
    await logAction({ userId: req.user.id, action: 'CREATE_USER', entityType: 'user', entityId: newUser._id, ip: req.ip });
    res.status(201).json({ success: true, message: 'Officer account created.', userId: newUser._id });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Username or badge number already exists.' });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error creating account.' });
  }
}

// PUT /api/auth/change-password
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new password are required.' });
  }
  try {
    const user = await User.findById(req.user.id);
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    user.password_hash = await bcrypt.hash(newPassword, 10);
    await user.save();
    await logAction({ userId: req.user.id, action: 'CHANGE_PASSWORD', entityType: 'user', entityId: req.user.id, ip: req.ip });
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// GET /api/auth/officers (list officers for assignment dropdowns / management page)
async function listOfficers(req, res) {
  try {
    const officers = await User.find({ is_active: true })
      .select('full_name badge_number role officer_rank station')
      .sort('full_name');
    res.json({ success: true, officers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function listOfficers(req, res) {
  try {
    const officers = await User.find({ is_active: true })
      .select('full_name badge_number role officer_rank station')
      .sort('full_name')
      .lean();
    const mapped = officers.map(o => ({ ...o, id: o._id }));
    res.json({ success: true, officers: mapped });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}
module.exports = { login, me, register, changePassword, listOfficers };
