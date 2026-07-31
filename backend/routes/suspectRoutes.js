const express = require('express');
const router = express.Router();
const {
  getAllSuspects, getSuspectById, createSuspect, updateSuspect, deleteSuspect
} = require('../controllers/suspectController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getAllSuspects);
router.get('/:id', getSuspectById);
router.post('/', createSuspect);
router.put('/:id', updateSuspect);
router.delete('/:id', authorize('admin', 'dco'), deleteSuspect);

module.exports = router;
