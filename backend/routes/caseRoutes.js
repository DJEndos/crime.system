const express = require('express');
const router = express.Router();
const {
  getAllCourtRecords, createCourtRecord, updateCourtRecord, deleteCourtRecord
} = require('../controllers/caseController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getAllCourtRecords);
router.post('/', createCourtRecord);
router.put('/:id', updateCourtRecord);
router.delete('/:id', authorize('admin', 'dco'), deleteCourtRecord);

module.exports = router;
