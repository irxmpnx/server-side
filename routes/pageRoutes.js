const express = require('express');
const router = express.Router();

const pageController = require('../controllers/pageController');
const marketController = require('../controllers/marketController');
const rentController = require('../controllers/rentController');
const { requireAuth } = require('../middleware/auth');

router.get('/', pageController.getHome);
router.get('/welcome', requireAuth, pageController.getWelcome);

router.get('/markets', marketController.getMarkets);

router.get('/rent/step-1', rentController.getStep1);
router.post('/rent/step-1', rentController.postStep1);

module.exports = router;