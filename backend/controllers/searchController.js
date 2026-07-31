const Crime = require('../models/Crime');
const Suspect = require('../models/Suspect');

// GET /api/search?q=keyword
async function search(req, res) {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Please provide a search term of at least 2 characters.' });
  }
  const term = q.trim();
  const regex = new RegExp(term, 'i');

  try {
    const crimes = await Crime.find({
      $or: [
        { case_number: regex }, { crime_type: regex }, { description: regex },
        { location: regex }, { victim_name: regex }
      ]
    }).sort('-created_at').limit(50).lean();

    const suspectsRaw = await Suspect.find({
      $or: [
        { full_name: regex }, { alias: regex }, { national_id: regex }, { address: regex }
      ]
    }).populate('crime_id', 'case_number crime_type').sort('-created_at').limit(50).lean();

    const suspects = suspectsRaw.map(s => ({
      ...s, id: s._id,
      case_number: s.crime_id ? s.crime_id.case_number : null,
      crime_type: s.crime_id ? s.crime_id.crime_type : null
    }));

    res.json({ success: true, query: q, crimes: crimes.map(c => ({ ...c, id: c._id })), suspects, totalResults: crimes.length + suspects.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error while searching.' });
  }
}

module.exports = { search };
