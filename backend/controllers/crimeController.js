const Crime = require('../models/Crime');
const Suspect = require('../models/Suspect');
const CourtRecord = require('../models/CourtRecord');
const { logAction } = require('../middleware/auditLogger');

// Generates a case number like CR-2026-0001
async function generateCaseNumber() {
  const year = new Date().getFullYear();
  const count = await Crime.countDocuments({ case_number: new RegExp(`^CR-${year}-`) });
  const next = (count + 1).toString().padStart(4, '0');
  return `CR-${year}-${next}`;
}

// GET /api/crimes  (supports ?status=&crime_type=&page=&limit=)
async function getAllCrimes(req, res) {
  try {
    const { status, crime_type, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (crime_type) filter.crime_type = crime_type;

    const skip = (Number(page) - 1) * Number(limit);

    const [crimesRaw, total] = await Promise.all([
      Crime.find(filter)
        .populate('assigned_officer_id', 'full_name')
        .populate('reported_by', 'full_name')
        .sort('-created_at')
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Crime.countDocuments(filter)
    ]);

    const crimeIds = crimesRaw.map(c => c._id);
    const suspectCounts = await Suspect.aggregate([
      { $match: { crime_id: { $in: crimeIds } } },
      { $group: { _id: '$crime_id', count: { $sum: 1 } } }
    ]);
    const countMap = Object.fromEntries(suspectCounts.map(s => [String(s._id), s.count]));

    const crimes = crimesRaw.map(c => ({
      ...c,
      id: c._id,
      assigned_officer_name: c.assigned_officer_id ? c.assigned_officer_id.full_name : null,
      reported_by_name: c.reported_by ? c.reported_by.full_name : null,
      suspect_count: countMap[String(c._id)] || 0
    }));

    res.json({ success: true, crimes, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching crime records.' });
  }
}

// GET /api/crimes/:id
async function getCrimeById(req, res) {
  try {
    const crimeDoc = await Crime.findById(req.params.id)
      .populate('assigned_officer_id', 'full_name')
      .populate('reported_by', 'full_name')
      .lean();
    if (!crimeDoc) return res.status(404).json({ success: false, message: 'Crime record not found.' });

    const crime = {
      ...crimeDoc,
      id: crimeDoc._id,
      assigned_officer_name: crimeDoc.assigned_officer_id ? crimeDoc.assigned_officer_id.full_name : null,
      reported_by_name: crimeDoc.reported_by ? crimeDoc.reported_by.full_name : null
    };

    const suspects = await Suspect.find({ crime_id: req.params.id }).lean();
    const courtRecords = await CourtRecord.find({ crime_id: req.params.id }).lean();

    res.json({ success: true, crime, suspects, courtRecords });
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
    const crime = await Crime.create({
      case_number, crime_type, description: description || null, location: location || null,
      date_occurred: date_occurred || null, date_reported,
      victim_name: victim_name || null, victim_gender: victim_gender || 'unknown', victim_phone: victim_phone || null,
      reported_by: req.user.id, assigned_officer_id: assigned_officer_id || null
    });

    await logAction({ userId: req.user.id, action: 'CREATE_CRIME', entityType: 'crime', entityId: crime._id, ip: req.ip, details: case_number });

    res.status(201).json({ success: true, message: 'Crime record registered.', crimeId: crime._id, case_number });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error creating crime record.' });
  }
}

// PUT /api/crimes/:id
async function updateCrime(req, res) {
  const fields = ['crime_type', 'description', 'location', 'date_occurred', 'date_reported',
    'victim_name', 'victim_gender', 'victim_phone', 'status', 'assigned_officer_id'];
  const updates = {};
  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, message: 'No fields provided to update.' });

  try {
    const crime = await Crime.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!crime) return res.status(404).json({ success: false, message: 'Crime record not found.' });

    await logAction({ userId: req.user.id, action: 'UPDATE_CRIME', entityType: 'crime', entityId: req.params.id, ip: req.ip });
    res.json({ success: true, message: 'Crime record updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error updating crime record.' });
  }
}

// DELETE /api/crimes/:id  (admin/dco only)
async function deleteCrime(req, res) {
  try {
    const crime = await Crime.findByIdAndDelete(req.params.id);
    if (!crime) return res.status(404).json({ success: false, message: 'Crime record not found.' });

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
    const types = await Crime.distinct('crime_type');
    res.json({ success: true, types: types.sort() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { getAllCrimes, getCrimeById, createCrime, updateCrime, deleteCrime, getCrimeTypes };
