const express = require('express');
const router = express.Router();

const pageController = require('../controllers/pageController');
const marketController = require('../controllers/marketController');
const rentController = require('../controllers/rentController');
const paymentController = require('../controllers/paymentController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadSlip } = require('../middleware/upload');

router.get('/', pageController.getHome);
router.get('/welcome', requireAuth, (req, res) => {
  if (req.session.user.role === 'owner_market') {
    return res.redirect('/owner/markets');
  }
  return res.redirect('/markets');
});

// Tenant Market Browse & Details
router.get('/markets', requireAuth, marketController.getMarkets);
router.get('/markets/:id', pageController.getMarketDetail);

// Tenant Rental Steps 1 - 4
router.get('/rent/step1', requireAuth, requireRole('tenant'), rentController.getStep1);
router.post('/rent/step1', requireAuth, requireRole('tenant'), rentController.postStep1);

router.get('/rent/step2', requireAuth, requireRole('tenant'), rentController.getStep2);
router.post('/rent/step2', requireAuth, requireRole('tenant'), rentController.postStep2);

router.get('/rent/step3', requireAuth, requireRole('tenant'), rentController.getStep3);
router.post('/rent/step3', requireAuth, requireRole('tenant'), rentController.postStep3);

router.get('/rent/step4', requireAuth, requireRole('tenant'), paymentController.getStep4);
router.post('/rent/step4', requireAuth, requireRole('tenant'), uploadSlip, paymentController.postStep4);
router.get('/rent/success', requireAuth, requireRole('tenant'), paymentController.getSuccess);
router.get('/rent/payment-required', requireAuth, requireRole('tenant'), paymentController.getPaymentRequired);

module.exports = router;