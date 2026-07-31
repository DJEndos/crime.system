const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const { logAction } = require('../middleware/auditLogger');

// GET /api/reports/dashboard  (summary stats for the dashboard cards & charts)
async function dashboardStats(req, res) {
  try {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM crimes');
    const [byStatus] = await pool.query('SELECT status, COUNT(*) AS count FROM crimes GROUP BY status');
    const [byType] = await pool.query('SELECT crime_type, COUNT(*) AS count FROM crimes GROUP BY crime_type ORDER BY count DESC LIMIT 8');
    const [bySuspectGender] = await pool.query('SELECT gender, COUNT(*) AS count FROM suspects GROUP BY gender');
    const [recentCrimes] = await pool.query(
      `SELECT id, case_number, crime_type, status, date_reported FROM crimes ORDER BY created_at DESC LIMIT 5`
    );
    const [monthly] = await pool.query(
      `SELECT DATE_FORMAT(date_reported, '%Y-%m') AS month, COUNT(*) AS count
       FROM crimes
       WHERE date_reported >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month ORDER BY month`
    );
    const [[{ suspectsAtLarge }]] = await pool.query(`SELECT COUNT(*) AS suspectsAtLarge FROM suspects WHERE status = 'at_large'`);
    const [[{ openCases }]] = await pool.query(`SELECT COUNT(*) AS openCases FROM crimes WHERE status IN ('open','under_investigation')`);

    res.json({
      success: true,
      totalCrimes: total,
      openCases,
      suspectsAtLarge,
      byStatus, byType, bySuspectGender, recentCrimes, monthly
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error generating dashboard stats.' });
  }
}

// GET /api/reports/daily?date=YYYY-MM-DD
async function dailyReport(req, res) {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.full_name AS assigned_officer_name
       FROM crimes c LEFT JOIN users u ON c.assigned_officer_id = u.id
       WHERE c.date_reported = ? ORDER BY c.created_at`,
      [date]
    );
    await logAction({ userId: req.user.id, action: 'GENERATE_REPORT', entityType: 'report', details: `daily:${date}`, ip: req.ip });
    res.json({ success: true, date, count: rows.length, crimes: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error generating daily report.' });
  }
}

// GET /api/reports/gender  (male vs female victim/suspect breakdown)
async function genderReport(req, res) {
  try {
    const [victims] = await pool.query('SELECT victim_gender AS gender, COUNT(*) AS count FROM crimes GROUP BY victim_gender');
    const [suspects] = await pool.query('SELECT gender, COUNT(*) AS count FROM suspects GROUP BY gender');
    res.json({ success: true, victims, suspects });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error generating gender report.' });
  }
}

// GET /api/reports/status  (case status breakdown)
async function statusReport(req, res) {
  try {
    const [rows] = await pool.query('SELECT status, COUNT(*) AS count FROM crimes GROUP BY status');
    res.json({ success: true, statusBreakdown: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error generating status report.' });
  }
}

// GET /api/reports/export/pdf?date_from=&date_to=&status=  -> streams a PDF
async function exportPdf(req, res) {
  const { date_from, date_to, status } = req.query;
  const conditions = [];
  const params = [];
  if (date_from) { conditions.push('date_reported >= ?'); params.push(date_from); }
  if (date_to) { conditions.push('date_reported <= ?'); params.push(date_to); }
  if (status) { conditions.push('status = ?'); params.push(status); }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [rows] = await pool.query(
      `SELECT case_number, crime_type, location, status, date_reported, victim_name FROM crimes ${whereClause} ORDER BY date_reported DESC`,
      params
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=crime_report.pdf');

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(16).text('Nigerian Police Force — Ikot Udota Division, Eket', { align: 'center' });
    doc.fontSize(13).text('Crime Tracking Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(9).fillColor('gray').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);
    doc.fillColor('black');

    rows.forEach((r, i) => {
      doc.fontSize(10).text(
        `${i + 1}. [${r.case_number}] ${r.crime_type} — ${r.location || 'N/A'} — Status: ${r.status} — Reported: ${r.date_reported} — Victim: ${r.victim_name || 'N/A'}`
      );
      doc.moveDown(0.3);
    });

    if (rows.length === 0) doc.fontSize(11).text('No records match the selected criteria.');

    doc.end();
    await logAction({ userId: req.user.id, action: 'EXPORT_PDF_REPORT', entityType: 'report', ip: req.ip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error exporting PDF report.' });
  }
}

module.exports = { dashboardStats, dailyReport, genderReport, statusReport, exportPdf };
