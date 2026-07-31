const pool = require('../config/db');
const { logAction } = require('../middleware/auditLogger');

// GET /api/cases  (court records + case tracking view)
async function getAllCourtRecords(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT cr.*, c.case_number, c.crime_type, s.full_name AS suspect_name
       FROM court_records cr
       JOIN crimes c ON cr.crime_id = c.id
       LEFT JOIN suspects s ON cr.suspect_id = s.id
       ORDER BY cr.hearing_date DESC`
    );
    res.json({ success: true, courtRecords: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching court records.' });
  }
}

// POST /api/cases
async function createCourtRecord(req, res) {
  const { crime_id, suspect_id, court_name, case_file_no, judge_name, hearing_date, verdict, notes } = req.body;
  if (!crime_id) return res.status(400).json({ success: false, message: 'crime_id is required.' });

  try {
    const [result] = await pool.query(
      `INSERT INTO court_records (crime_id, suspect_id, court_name, case_file_no, judge_name, hearing_date, verdict, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crime_id, suspect_id || null, court_name || null, case_file_no || null, judge_name || null,
       hearing_date || null, verdict || 'pending', notes || null]
    );

    // If a verdict is reached, reflect it on the parent crime's status
    if (verdict && ['guilty', 'not_guilty', 'dismissed'].includes(verdict)) {
      await pool.query('UPDATE crimes SET status = ? WHERE id = ?', ['closed', crime_id]);
    } else {
      await pool.query('UPDATE crimes SET status = ? WHERE id = ?', ['in_court', crime_id]);
    }

    await logAction({ userId: req.user.id, action: 'CREATE_COURT_RECORD', entityType: 'court_record', entityId: result.insertId, ip: req.ip });
    res.status(201).json({ success: true, message: 'Court record added.', courtRecordId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error creating court record.' });
  }
}

// PUT /api/cases/:id
async function updateCourtRecord(req, res) {
  const fields = ['court_name', 'case_file_no', 'judge_name', 'hearing_date', 'verdict', 'notes', 'suspect_id'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  });
  if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields provided to update.' });
  params.push(req.params.id);

  try {
    const [result] = await pool.query(`UPDATE court_records SET ${updates.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Court record not found.' });

    if (req.body.verdict) {
      const [crRows] = await pool.query('SELECT crime_id FROM court_records WHERE id = ?', [req.params.id]);
      if (crRows.length) {
        const newStatus = ['guilty', 'not_guilty', 'dismissed'].includes(req.body.verdict) ? 'closed' : 'in_court';
        await pool.query('UPDATE crimes SET status = ? WHERE id = ?', [newStatus, crRows[0].crime_id]);
      }
    }

    await logAction({ userId: req.user.id, action: 'UPDATE_COURT_RECORD', entityType: 'court_record', entityId: req.params.id, ip: req.ip });
    res.json({ success: true, message: 'Court record updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error updating court record.' });
  }
}

// DELETE /api/cases/:id
async function deleteCourtRecord(req, res) {
  try {
    const [result] = await pool.query('DELETE FROM court_records WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Court record not found.' });
    await logAction({ userId: req.user.id, action: 'DELETE_COURT_RECORD', entityType: 'court_record', entityId: req.params.id, ip: req.ip });
    res.json({ success: true, message: 'Court record deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error deleting court record.' });
  }
}

module.exports = { getAllCourtRecords, createCourtRecord, updateCourtRecord, deleteCourtRecord };
