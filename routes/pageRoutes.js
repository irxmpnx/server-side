const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const { requireAuth } = require('../middleware/auth');

router.get('/', pageController.getHome);
router.get('/welcome', requireAuth, pageController.getWelcome);

router.get('/markets', (req, res) => {
  const market = (id, name) => ({
    id, name,
    image: '/images/m1.png',
    tags: ['today', 'daily'],   // today | daily | weekend
  });

  res.render('home', {
    page: Number(req.query.page) || 1,
    totalPages: 10,
    areas: [
      { name: 'ลาดกระบัง', markets: [market(1, 'ตลาดนัดสุวรรณภูมิ'), market(2, 'ตลาดนัดสุวรรณภูมิ'), market(3, 'ตลาดนัดสุวรรณภูมิ'), market(4, 'ตลาดนัดสุวรรณภูมิ')] },
      { name: 'รามคำแหง', markets: [market(5, 'ตลาดนัดสุวรรณภูมิ'), market(6, 'ตลาดนัดสุวรรณภูมิ'), market(7, 'ตลาดนัดสุวรรณภูมิ'), market(8, 'ตลาดนัดสุวรรณภูมิ')] },
    ],
  });
});

module.exports = router;