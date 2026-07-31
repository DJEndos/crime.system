const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { logAction } = require('../middleware/auditLogger');
require('dotenv').config();

// POST /api/auth/login
async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await logAction({ userId: user.id, action: 'LOGIN', entityType: 'user', entityId: user.id, ip: req.ip });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
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
    const [rows] = await pool.query(
      'SELECT id, full_name, username, role, badge_number, station, phone FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: rows[0] });
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
    const [result] = await pool.query(
      `INSERT INTO users (full_name, username, password_hash, role, badge_number, officer_rank, phone, station)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [full_name, username, hash, role, badge_number, officer_rank || null, phone || null, station || 'Ikot Udota Division, Eket']
    );
    await logAction({ userId: req.user.id, action: 'CREATE_USER', entityType: 'user', entityId: result.insertId, ip: req.ip });
    res.status(201).json({ success: true, message: 'Officer account created.', userId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
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
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
    await logAction({ userId: req.user.id, action: 'CHANGE_PASSWORD', entityType: 'user', entityId: req.user.id, ip: req.ip });
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// GET /api/auth/officers (admin only — list officers for assignment dropdowns)
async function listOfficers(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, badge_number, role, officer_rank, station FROM users WHERE is_active = 1 ORDER BY full_name`
    );
    res.json({ success: true, officers: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { login, me, register, changePassword, listOfficers };
