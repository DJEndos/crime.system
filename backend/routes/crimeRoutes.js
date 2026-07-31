const express = require('express');
const router = express.Router();
const {
  getAllCrimes, getCrimeById, createCrime, updateCrime, deleteCrime, getCrimeTypes
} = require('../controllers/crimeController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate); // all crime routes require login

router.get('/', getAllCrimes);
router.get('/meta/types', getCrimeTypes);
router.get('/:id', getCrimeById);
router.post('/', createCrime);
router.put('/:id', updateCrime);
router.delete('/:id', authorize('admin', 'dco'), deleteCrime);

module.exports = router;
