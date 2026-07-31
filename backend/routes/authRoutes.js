const express = require('express');
const router = express.Router();
const { login, me, register, changePassword, listOfficers } = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', authenticate, me);
router.post('/register', authenticate, authorize('admin'), register);
router.put('/change-password', authenticate, changePassword);
router.get('/officers', authenticate, listOfficers);

module.exports = router;
