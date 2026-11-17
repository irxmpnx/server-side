const { client } = require('../configs/db');

exports.getMyFavorite = async (req, res) => {
  try {
    const { rows } = await client.query(
      `SELECT m.id, m.name, m.location, m.cover_image_url, m.image_urls,
              COALESCE(
                ARRAY_AGG(d.day_of_week ORDER BY d.day_of_week)
                  FILTER (WHERE d.day_of_week IS NOT NULL), '{}'
              ) AS operating_days,
              MIN(TO_CHAR(d.open_time, 'HH24:MI')) AS open_time,
              MAX(TO_CHAR(d.close_time, 'HH24:MI')) AS close_time
       FROM user_favorites f
       JOIN markets m ON m.id = f.market_id
       LEFT JOIN market_operating_days d ON d.market_id = m.id
       WHERE f.user_id = $1 AND m.is_verified = TRUE
       GROUP BY m.id, f.created_at
       ORDER BY f.created_at DESC;`,
      [req.session.user.id]
    );

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const favorites = rows.map((market) => ({
      ...market,
      image: (market.image_urls && market.image_urls[0]) || market.cover_image_url || '/images/no_Image.svg',
      daysLabel: market.operating_days.length
        ? market.operating_days.map((day) => dayNames[day]).join(', ')
        : '-',
      timeLabel: market.open_time && market.close_time
        ? `${market.open_time} - ${market.close_time}`
        : '-',
    }));

    res.render('my-favorite', { favorites });
  } catch (err) {
    console.error('getMyFavorite error:', err);
    res.status(500).send('Unable to load favorites.');
  }
};

exports.addFavorite = async (req, res) => {
  try {
    const marketId = Number(req.params.marketId);
    if (!Number.isInteger(marketId)) return res.status(400).json({ message: 'Invalid market.' });

    const result = await client.query(
      `INSERT INTO user_favorites (user_id, market_id)
       SELECT $1, m.id FROM markets m
       WHERE m.id = $2 AND m.is_verified = TRUE
       ON CONFLICT (user_id, market_id) DO NOTHING
       RETURNING market_id;`,
      [req.session.user.id, marketId]
    );
    if (result.rowCount === 0) {
      const exists = await client.query(
        'SELECT 1 FROM user_favorites WHERE user_id = $1 AND market_id = $2;',
        [req.session.user.id, marketId]
      );
      if (exists.rowCount === 0) return res.status(404).json({ message: 'Market not found.' });
    }
    res.json({ success: true, favorited: true });
  } catch (err) {
    console.error('addFavorite error:', err);
    res.status(500).json({ message: 'Unable to save favorite.' });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const marketId = Number(req.params.marketId);
    if (!Number.isInteger(marketId)) return res.status(400).json({ message: 'Invalid market.' });

    await client.query(
      'DELETE FROM user_favorites WHERE user_id = $1 AND market_id = $2;',
      [req.session.user.id, marketId]
    );
    res.json({ success: true, favorited: false });
  } catch (err) {
    console.error('removeFavorite error:', err);
    res.status(500).json({ message: 'Unable to remove favorite.' });
  }
};
