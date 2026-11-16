const MarketModel = require('../models/marketModel');

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

    const data = await MarketModel.getMarketInsightById(marketId);
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
        : [market.cover_image_url || '/images/m1.png'];

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