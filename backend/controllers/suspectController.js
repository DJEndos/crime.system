const pool = require('../config/db');
const { logAction } = require('../middleware/auditLogger');

// GET /api/suspects
async function getAllSuspects(req, res) {
  try {
    const { status, gender, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    if (status) { conditions.push('s.status = ?'); params.push(status); }
    if (gender) { conditions.push('s.gender = ?'); params.push(gender); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query(
      `SELECT s.*, c.case_number, c.crime_type
       FROM suspects s
       JOIN crimes c ON s.crime_id = c.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM suspects s ${whereClause}`, params);

    res.json({ success: true, suspects: rows, total: countRows[0].total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching suspects.' });
  }
}

// GET /api/suspects/:id
async function getSuspectById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, c.case_number, c.crime_type FROM suspects s JOIN crimes c ON s.crime_id = c.id WHERE s.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Suspect not found.' });
    res.json({ success: true, suspect: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// POST /api/suspects
async function createSuspect(req, res) {
  const { crime_id, full_name, alias, gender, age, address, phone, national_id, status, notes } = req.body;
  if (!crime_id || !full_name) {
    return res.status(400).json({ success: false, message: 'crime_id and full_name are required.' });
  }
  try {
    const [crimeCheck] = await pool.query('SELECT id FROM crimes WHERE id = ?', [crime_id]);
    if (crimeCheck.length === 0) return res.status(404).json({ success: false, message: 'Associated crime record not found.' });

    const [result] = await pool.query(
      `INSERT INTO suspects (crime_id, full_name, alias, gender, age, address, phone, national_id, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crime_id, full_name, alias || null, gender || 'unknown', age || null, address || null,
       phone || null, national_id || null, status || 'at_large', notes || null]
    );
    await logAction({ userId: req.user.id, action: 'CREATE_SUSPECT', entityType: 'suspect', entityId: result.insertId, ip: req.ip });
    res.status(201).json({ success: true, message: 'Suspect record added.', suspectId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error creating suspect record.' });
  }
}

// PUT /api/suspects/:id
async function updateSuspect(req, res) {
  const fields = ['full_name', 'alias', 'gender', 'age', 'address', 'phone', 'national_id', 'status', 'notes'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  });
  if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields provided to update.' });
  params.push(req.params.id);

  try {
    const [result] = await pool.query(`UPDATE suspects SET ${updates.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Suspect not found.' });
    await logAction({ userId: req.user.id, action: 'UPDATE_SUSPECT', entityType: 'suspect', entityId: req.params.id, ip: req.ip });
    res.json({ success: true, message: 'Suspect record updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error updating suspect.' });
  }
}

// DELETE /api/suspects/:id
async function deleteSuspect(req, res) {
  try {
    const [result] = await pool.query('DELETE FROM suspects WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Suspect not found.' });
    await logAction({ userId: req.user.id, action: 'DELETE_SUSPECT', entityType: 'suspect', entityId: req.params.id, ip: req.ip });
    res.json({ success: true, message: 'Suspect record deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error deleting suspect.' });
  }
}

module.exports = { getAllSuspects, getSuspectById, createSuspect, updateSuspect, deleteSuspect };
