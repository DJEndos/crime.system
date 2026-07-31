const Crime = require('../models/Crime');
const Suspect = require('../models/Suspect');
const PDFDocument = require('pdfkit');
const { logAction } = require('../middleware/auditLogger');

// GET /api/reports/dashboard  (summary stats for the dashboard cards & charts)
async function dashboardStats(req, res) {
  try {
    const total = await Crime.countDocuments();
    const openCases = await Crime.countDocuments({ status: { $in: ['open', 'under_investigation'] } });
    const suspectsAtLarge = await Suspect.countDocuments({ status: 'at_large' });

    const byStatusAgg = await Crime.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const byStatus = byStatusAgg.map(r => ({ status: r._id, count: r.count }));

    const byTypeAgg = await Crime.aggregate([
      { $group: { _id: '$crime_type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 8 }
    ]);
    const byType = byTypeAgg.map(r => ({ crime_type: r._id, count: r.count }));

    const genderAgg = await Suspect.aggregate([{ $group: { _id: '$gender', count: { $sum: 1 } } }]);
    const bySuspectGender = genderAgg.map(r => ({ gender: r._id, count: r.count }));

    const recentCrimesRaw = await Crime.find({}).sort('-created_at').limit(5).lean();
    const recentCrimes = recentCrimesRaw.map(c => ({ ...c, id: c._id }));

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyAgg = await Crime.aggregate([
      { $match: { date_reported: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date_reported' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const monthly = monthlyAgg.map(r => ({ month: r._id, count: r.count }));

    res.json({ success: true, totalCrimes: total, openCases, suspectsAtLarge, byStatus, byType, bySuspectGender, recentCrimes, monthly });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error generating dashboard stats.' });
  }
}

// GET /api/reports/daily?date=YYYY-MM-DD
async function dailyReport(req, res) {
  const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  try {
    const crimesRaw = await Crime.find({ date_reported: { $gte: start, $lte: end } })
      .populate('assigned_officer_id', 'full_name').sort('created_at').lean();
    const crimes = crimesRaw.map(c => ({ ...c, id: c._id, assigned_officer_name: c.assigned_officer_id ? c.assigned_officer_id.full_name : null }));

    await logAction({ userId: req.user.id, action: 'GENERATE_REPORT', entityType: 'report', details: `daily:${dateStr}`, ip: req.ip });
    res.json({ success: true, date: dateStr, count: crimes.length, crimes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error generating daily report.' });
  }
}

// GET /api/reports/gender  (male vs female victim/suspect breakdown)
async function genderReport(req, res) {
  try {
    const victimsAgg = await Crime.aggregate([{ $group: { _id: '$victim_gender', count: { $sum: 1 } } }]);
    const suspectsAgg = await Suspect.aggregate([{ $group: { _id: '$gender', count: { $sum: 1 } } }]);
    res.json({
      success: true,
      victims: victimsAgg.map(r => ({ gender: r._id, count: r.count })),
      suspects: suspectsAgg.map(r => ({ gender: r._id, count: r.count }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error generating gender report.' });
  }
}

// GET /api/reports/status  (case status breakdown)
async function statusReport(req, res) {
  try {
    const agg = await Crime.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    res.json({ success: true, statusBreakdown: agg.map(r => ({ status: r._id, count: r.count })) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error generating status report.' });
  }
}

// GET /api/reports/export/pdf?date_from=&date_to=&status=  -> streams a PDF
async function exportPdf(req, res) {
  const { date_from, date_to, status } = req.query;
  const filter = {};
  if (date_from || date_to) {
    filter.date_reported = {};
    if (date_from) filter.date_reported.$gte = new Date(date_from);
    if (date_to) filter.date_reported.$lte = new Date(date_to);
  }
  if (status) filter.status = status;

  try {
    const rows = await Crime.find(filter).sort('-date_reported').lean();

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
      const reported = r.date_reported ? new Date(r.date_reported).toISOString().slice(0, 10) : 'N/A';
      doc.fontSize(10).text(
        `${i + 1}. [${r.case_number}] ${r.crime_type} — ${r.location || 'N/A'} — Status: ${r.status} — Reported: ${reported} — Victim: ${r.victim_name || 'N/A'}`
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
