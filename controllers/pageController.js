const path = require('path');
const MarketModel = require('../models/marketModel');
const { client } = require('../configs/db');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


exports.getHome = (req, res) => {
  res.render('hero', { user: req.session.user });
};

exports.getWelcome = (req, res) => {
  res.render('welcome', { user: req.session.user });
};


exports.getMarketDetail = async (req, res) => {
  try {
    const marketId = Number(req.params.id);
    if (!Number.isInteger(marketId)) return res.redirect('/');

    const viewerId = req.session.user ? req.session.user.id : null;
    const data = await MarketModel.getMarketInsightById(marketId, viewerId);
    if (!data) return res.status(404).send('Market not found.');

    const { market, operatingDays, spots, elements } = data;

    let isFavorite = false;
    if (req.session.user && req.session.user.role === 'tenant') {
      const { client } = require('../configs/db');
      const favoriteRes = await client.query(
        'SELECT 1 FROM user_favorites WHERE user_id = $1 AND market_id = $2;',
        [req.session.user.id, marketId]
      );
      isFavorite = favoriteRes.rowCount > 0;
    }

    const images =
      Array.isArray(market.image_urls) && market.image_urls.length > 0
        ? market.image_urls
        : [market.cover_image_url || '/images/no_Image.svg'];

    const daysLabel =
      operatingDays.length > 0
        ? operatingDays.map((d) => DAY_NAMES[d.day_of_week]).join(', ')
        : '-';

    const timeLabel =
      operatingDays.length > 0
        ? `${operatingDays[0].open_time} - ${operatingDays[0].close_time}`
        : '-';

    res.render('market-detail', {
      market,
      images,
      daysLabel,
      timeLabel,
      spots,
      elements,
      isFavorite,
    });
  } catch (err) {
    console.error('getMarketDetail error:', err);
    res.redirect('/');
  }

};

// Payment slips are stored privately (uploads/slips), so they are served through this route.
// Only the tenant who paid, or the owner of the market the rental belongs to, can open one.
exports.getSlip = async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    if (!/^[\w-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) {
      return res.status(404).send('Not found');
    }

    const { rows } = await client.query(
      `SELECT 1
       FROM rentals r
       JOIN markets m ON m.id = r.market_id
       WHERE r.slip_image_url = $1
         AND (r.tenant_id = $2 OR m.owner_id = $2)
       LIMIT 1;`,
      [filename, req.session.user.id]
    );
    if (rows.length === 0) return res.status(404).send('Not found');

    res.sendFile(path.join(__dirname, '..', 'uploads', 'slips', filename), (err) => {
      if (err && !res.headersSent) res.status(404).send('Not found');
    });
  } catch (err) {
    console.error('getSlip error:', err);
    res.status(500).send('Unable to load the slip.');
  }
};
