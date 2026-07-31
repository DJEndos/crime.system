const Suspect = require('../models/Suspect');
const Crime = require('../models/Crime');
const { logAction } = require('../middleware/auditLogger');

// GET /api/suspects
async function getAllSuspects(req, res) {
  try {
    const { status, gender, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (gender) filter.gender = gender;

    const skip = (Number(page) - 1) * Number(limit);

    const [suspectsRaw, total] = await Promise.all([
      Suspect.find(filter).populate('crime_id', 'case_number crime_type').sort('-created_at').skip(skip).limit(Number(limit)).lean(),
      Suspect.countDocuments(filter)
    ]);

    const suspects = suspectsRaw.map(s => ({
      ...s,
      id: s._id,
      case_number: s.crime_id ? s.crime_id.case_number : null,
      crime_type: s.crime_id ? s.crime_id.crime_type : null
    }));

    res.json({ success: true, suspects, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching suspects.' });
  }
}

// GET /api/suspects/:id
async function getSuspectById(req, res) {
  try {
    const s = await Suspect.findById(req.params.id).populate('crime_id', 'case_number crime_type').lean();
    if (!s) return res.status(404).json({ success: false, message: 'Suspect not found.' });
    res.json({ success: true, suspect: { ...s, id: s._id, case_number: s.crime_id?.case_number, crime_type: s.crime_id?.crime_type } });
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
    const crimeExists = await Crime.exists({ _id: crime_id });
    if (!crimeExists) return res.status(404).json({ success: false, message: 'Associated crime record not found.' });

    const suspect = await Suspect.create({
      crime_id, full_name, alias: alias || null, gender: gender || 'unknown', age: age || null,
      address: address || null, phone: phone || null, national_id: national_id || null,
      status: status || 'at_large', notes: notes || null
    });
    await logAction({ userId: req.user.id, action: 'CREATE_SUSPECT', entityType: 'suspect', entityId: suspect._id, ip: req.ip });
    res.status(201).json({ success: true, message: 'Suspect record added.', suspectId: suspect._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error creating suspect record.' });
  }
}

// PUT /api/suspects/:id
async function updateSuspect(req, res) {
  const fields = ['full_name', 'alias', 'gender', 'age', 'address', 'phone', 'national_id', 'status', 'notes'];
  const updates = {};
  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, message: 'No fields provided to update.' });

  try {
    const suspect = await Suspect.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!suspect) return res.status(404).json({ success: false, message: 'Suspect not found.' });
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
    const suspect = await Suspect.findByIdAndDelete(req.params.id);
    if (!suspect) return res.status(404).json({ success: false, message: 'Suspect not found.' });
    await logAction({ userId: req.user.id, action: 'DELETE_SUSPECT', entityType: 'suspect', entityId: req.params.id, ip: req.ip });
    res.json({ success: true, message: 'Suspect record deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error deleting suspect.' });
  }
}

module.exports = { getAllSuspects, getSuspectById, createSuspect, updateSuspect, deleteSuspect };
