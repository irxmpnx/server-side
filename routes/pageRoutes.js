const express = require('express');
const router = express.Router();

const pageController = require('../controllers/pageController');
const marketController = require('../controllers/marketController');
const rentController = require('../controllers/rentController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', pageController.getHome);
// router.get('/welcome', requireAuth, pageController.getWelcome);

router.get('/markets', requireAuth, marketController.getMarkets);


//Tenant Role
router.get('/rent/step1', requireAuth, requireRole('tenant'), rentController.getStep1);
router.post('/rent/step1', requireAuth, requireRole('tenant'), rentController.postStep1);

const paymentController = require('../controllers/paymentController');
const { uploadSlip } = require('../middleware/upload');

router.get('/rent/step4', requireAuth, requireRole('tenant'), paymentController.getStep4);
router.post('/rent/step4', requireAuth, requireRole('tenant'), uploadSlip, paymentController.postStep4);
router.get('/rent/success', requireAuth, requireRole('tenant'),  paymentController.getSuccess);
router.get('/rent/payment-required', requireAuth, requireRole('tenant'), paymentController.getPaymentRequired);

//Owner Market Role
router.get('/myMarkets', requireAuth, requireRole('owner_market'), marketController.getMyMarkets);

module.exports = router;