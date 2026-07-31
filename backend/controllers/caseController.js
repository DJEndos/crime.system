const CourtRecord = require('../models/CourtRecord');
const Crime = require('../models/Crime');
const { logAction } = require('../middleware/auditLogger');

// GET /api/cases  (court records + case tracking view)
async function getAllCourtRecords(req, res) {
  try {
    const recordsRaw = await CourtRecord.find({})
      .populate('crime_id', 'case_number crime_type')
      .populate('suspect_id', 'full_name')
      .sort('-hearing_date')
      .lean();

    const courtRecords = recordsRaw.map(r => ({
      ...r,
      id: r._id,
      case_number: r.crime_id ? r.crime_id.case_number : null,
      crime_type: r.crime_id ? r.crime_id.crime_type : null,
      suspect_name: r.suspect_id ? r.suspect_id.full_name : null
    }));

    res.json({ success: true, courtRecords });
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
    const record = await CourtRecord.create({
      crime_id, suspect_id: suspect_id || null, court_name: court_name || null, case_file_no: case_file_no || null,
      judge_name: judge_name || null, hearing_date: hearing_date || null, verdict: verdict || 'pending', notes: notes || null
    });

    const newStatus = verdict && ['guilty', 'not_guilty', 'dismissed'].includes(verdict) ? 'closed' : 'in_court';
    await Crime.findByIdAndUpdate(crime_id, { status: newStatus });

    await logAction({ userId: req.user.id, action: 'CREATE_COURT_RECORD', entityType: 'court_record', entityId: record._id, ip: req.ip });
    res.status(201).json({ success: true, message: 'Court record added.', courtRecordId: record._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error creating court record.' });
  }
}

// PUT /api/cases/:id
async function updateCourtRecord(req, res) {
  const fields = ['court_name', 'case_file_no', 'judge_name', 'hearing_date', 'verdict', 'notes', 'suspect_id'];
  const updates = {};
  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, message: 'No fields provided to update.' });

  try {
    const record = await CourtRecord.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!record) return res.status(404).json({ success: false, message: 'Court record not found.' });

    if (req.body.verdict) {
      const newStatus = ['guilty', 'not_guilty', 'dismissed'].includes(req.body.verdict) ? 'closed' : 'in_court';
      await Crime.findByIdAndUpdate(record.crime_id, { status: newStatus });
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
    const record = await CourtRecord.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Court record not found.' });
    await logAction({ userId: req.user.id, action: 'DELETE_COURT_RECORD', entityType: 'court_record', entityId: req.params.id, ip: req.ip });
    res.json({ success: true, message: 'Court record deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error deleting court record.' });
  }
}

module.exports = { getAllCourtRecords, createCourtRecord, updateCourtRecord, deleteCourtRecord };
