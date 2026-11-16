const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadMarketImages } = require('../middleware/upload');

router.use(requireAuth, requireRole('owner_market'));

router.get('/markets', requireAuth, requireRole('owner_market'), ownerController.getMyMarkets);
router.get('/markets/new', requireAuth, requireRole('owner_market'), ownerController.startNewMarket);
router.get('/markets/:id/edit', requireAuth, requireRole('owner_market'), ownerController.getEditMarket);
router.get('/markets/:id/dashboard', requireAuth, requireRole('owner_market'), ownerController.getDashboard);

router.get('/markets/new/step-1', ownerController.getPublishStep1);
router.post('/markets/new/step-1', uploadMarketImages.array('market_images', 10), ownerController.postPublishStep1);

router.get('/markets/new/step-2', ownerController.getPublishStep2);
router.post('/markets/new/step-2', ownerController.postPublishStep2);

router.get('/markets/new/step-3', ownerController.getPublishStep3);
router.post('/markets/new/step-3', ownerController.postPublishStep3);

router.get('/markets/new/step-4', ownerController.getPublishStep4);
router.post('/markets/new/publish', ownerController.postPublishMarket);

router.get('/markets/:id/dashboard', ownerController.getDashboard);
router.post('/markets/:id/rentals/:rentalId/approve', ownerController.postApproveRental);
router.post('/markets/:id/rentals/:rentalId/deny', ownerController.postDenyRental);
router.post('/markets/:id/toggle-status', requireAuth, requireRole('owner_market'), ownerController.postToggleMarketStatus);
router.post('/markets/:id/delete', requireAuth, requireRole('owner_market'), ownerController.postDeleteMarket);

module.exports = router;