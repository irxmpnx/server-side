const { client } = require('../configs/db');

exports.getMarkets = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 12;
    const offset = (page - 1) * limit;

    const countRes = await client.query(`SELECT COUNT(*)::int AS total FROM markets WHERE is_verified = TRUE;`);
    const totalMarkets = countRes.rows[0].total;
    const totalPages = Math.max(1, Math.ceil(totalMarkets / limit));

    const query = `
      SELECT m.id, m.name, m.genre, m.location, m.cover_image_url, m.image_urls, m.is_open,
        COALESCE(
          ARRAY_AGG(d.day_of_week ORDER BY d.day_of_week) FILTER (WHERE d.day_of_week IS NOT NULL),
          '{}'
        ) AS days
      FROM markets m
      LEFT JOIN market_operating_days d ON d.market_id = m.id
      WHERE m.is_verified = TRUE
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const { rows } = await client.query(query, [limit, offset]);

    const todayDow = new Date().getDay(); // 0=Sun ... 6=Sat

    // One flat list of markets (the market name is shown under each image)
    const markets = rows.map((m) => {
      // A market the owner has closed is not "open" for any filter (it only shows under All)
      const tags = [];
      if (m.is_open !== false) {
        if (m.days.includes(todayDow)) tags.push('today');
        if (m.days.length === 7) tags.push('daily');
        if (m.days.includes(0) || m.days.includes(6)) tags.push('weekend');
      }

      return {
        id: m.id,
        name: m.name,
        image: (m.image_urls && m.image_urls[0]) || m.cover_image_url || '/images/no_Image.svg',
        tags,
      };
    });

    res.render('home', {
      areas: [{ name: null, markets }],
      page,
      totalPages,
    });
  } catch (err) {
    console.error('getMarkets error:', err);
    res.status(500).send('Error loading markets.');
  }
};