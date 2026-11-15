const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const { requireAuth } = require('../middleware/auth');

router.get('/', pageController.getHome);
router.get('/welcome', requireAuth, pageController.getWelcome);

module.exports = router;