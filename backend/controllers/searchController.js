const pool = require('../config/db');

// GET /api/search?q=keyword
async function search(req, res) {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Please provide a search term of at least 2 characters.' });
  }
  const term = `%${q.trim()}%`;

  try {
    const [crimes] = await pool.query(
      `SELECT id, case_number, crime_type, description, location, status, date_reported, victim_name
       FROM crimes
       WHERE case_number LIKE ? OR crime_type LIKE ? OR description LIKE ? OR location LIKE ? OR victim_name LIKE ?
       ORDER BY created_at DESC LIMIT 50`,
      [term, term, term, term, term]
    );

    const [suspects] = await pool.query(
      `SELECT s.id, s.full_name, s.alias, s.status, s.gender, s.national_id, c.case_number, c.crime_type
       FROM suspects s JOIN crimes c ON s.crime_id = c.id
       WHERE s.full_name LIKE ? OR s.alias LIKE ? OR s.national_id LIKE ? OR s.address LIKE ?
       ORDER BY s.created_at DESC LIMIT 50`,
      [term, term, term, term]
    );

    res.json({ success: true, query: q, crimes, suspects, totalResults: crimes.length + suspects.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error while searching.' });
  }
}

module.exports = { search };
