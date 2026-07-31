const express = require('express');
const router = express.Router();
const { search } = require('../controllers/searchController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, search);

module.exports = router;
