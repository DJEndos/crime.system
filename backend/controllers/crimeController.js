const pool = require('../config/db');
const { logAction } = require('../middleware/auditLogger');

// Generates a case number like CR-2026-0001
async function generateCaseNumber() {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM crimes WHERE case_number LIKE ?`,
    [`CR-${year}-%`]
  );
  const next = (rows[0].total + 1).toString().padStart(4, '0');
  return `CR-${year}-${next}`;
}

// GET /api/crimes  (supports ?status=&crime_type=&page=&limit=)
async function getAllCrimes(req, res) {
  try {
    const { status, crime_type, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];

    if (status) { conditions.push('c.status = ?'); params.push(status); }
    if (crime_type) { conditions.push('c.crime_type = ?'); params.push(crime_type); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query(
      `SELECT c.*, u.full_name AS assigned_officer_name, r.full_name AS reported_by_name,
              (SELECT COUNT(*) FROM suspects s WHERE s.crime_id = c.id) AS suspect_count
       FROM crimes c
       LEFT JOIN users u ON c.assigned_officer_id = u.id
       LEFT JOIN users r ON c.reported_by = r.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM crimes c ${whereClause}`, params
    );

    res.json({ success: true, crimes: rows, total: countRows[0].total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching crime records.' });
  }
}

// GET /api/crimes/:id
async function getCrimeById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.full_name AS assigned_officer_name, r.full_name AS reported_by_name
       FROM crimes c
       LEFT JOIN users u ON c.assigned_officer_id = u.id
       LEFT JOIN users r ON c.reported_by = r.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Crime record not found.' });

    const [suspects] = await pool.query('SELECT * FROM suspects WHERE crime_id = ?', [req.params.id]);
    const [courtRecords] = await pool.query('SELECT * FROM court_records WHERE crime_id = ?', [req.params.id]);

    res.json({ success: true, crime: rows[0], suspects, courtRecords });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching crime record.' });
  }
}

// POST /api/crimes
async function createCrime(req, res) {
  const {
    crime_type, description, location, date_occurred, date_reported,
    victim_name, victim_gender, victim_phone, assigned_officer_id
  } = req.body;

  if (!crime_type || !date_reported) {
    return res.status(400).json({ success: false, message: 'crime_type and date_reported are required.' });
  }

  try {
    const case_number = await generateCaseNumber();
    const [result] = await pool.query(
      `INSERT INTO crimes (case_number, crime_type, description, location, date_occurred, date_reported,
                            victim_name, victim_gender, victim_phone, reported_by, assigned_officer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [case_number, crime_type, description || null, location || null, date_occurred || null, date_reported,
       victim_name || null, victim_gender || 'unknown', victim_phone || null, req.user.id, assigned_officer_id || null]
    );

    await logAction({ userId: req.user.id, action: 'CREATE_CRIME', entityType: 'crime', entityId: result.insertId, ip: req.ip, details: case_number });

    res.status(201).json({ success: true, message: 'Crime record registered.', crimeId: result.insertId, case_number });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error creating crime record.' });
  }
}

// PUT /api/crimes/:id
async function updateCrime(req, res) {
  const fields = ['crime_type', 'description', 'location', 'date_occurred', 'date_reported',
    'victim_name', 'victim_gender', 'victim_phone', 'status', 'assigned_officer_id'];
  const updates = [];
  const params = [];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  });

  if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields provided to update.' });

  params.push(req.params.id);

  try {
    const [result] = await pool.query(`UPDATE crimes SET ${updates.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Crime record not found.' });

    await logAction({ userId: req.user.id, action: 'UPDATE_CRIME', entityType: 'crime', entityId: req.params.id, ip: req.ip });
    res.json({ success: true, message: 'Crime record updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error updating crime record.' });
  }
}

// DELETE /api/crimes/:id  (admin only)
async function deleteCrime(req, res) {
  try {
    const [result] = await pool.query('DELETE FROM crimes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Crime record not found.' });

    await logAction({ userId: req.user.id, action: 'DELETE_CRIME', entityType: 'crime', entityId: req.params.id, ip: req.ip });
    res.json({ success: true, message: 'Crime record deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error deleting crime record.' });
  }
}

// GET /api/crimes/meta/types  (distinct crime types for filters/dropdowns)
async function getCrimeTypes(req, res) {
  try {
    const [rows] = await pool.query('SELECT DISTINCT crime_type FROM crimes ORDER BY crime_type');
    res.json({ success: true, types: rows.map(r => r.crime_type) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { getAllCrimes, getCrimeById, createCrime, updateCrime, deleteCrime, getCrimeTypes };
