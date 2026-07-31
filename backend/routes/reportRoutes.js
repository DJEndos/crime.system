const express = require('express');
const router = express.Router();
const {
  dashboardStats, dailyReport, genderReport, statusReport, exportPdf
} = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/dashboard', dashboardStats);
router.get('/daily', dailyReport);
router.get('/gender', genderReport);
router.get('/status', statusReport);
router.get('/export/pdf', exportPdf);

module.exports = router;
