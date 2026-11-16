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
      SELECT m.id, m.name, m.genre, m.location, m.cover_image_url, m.image_urls,
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

    // Group markets by location (area) for home.ejs
    const areaMap = new Map();
    for (const m of rows) {
      const tags = [];
      if (m.days.includes(todayDow)) tags.push('today');
      if (m.days.length === 7) tags.push('daily');
      if (m.days.includes(0) || m.days.includes(6)) tags.push('weekend');

      const areaName = m.location || 'Featured Markets';
      if (!areaMap.has(areaName)) {
        areaMap.set(areaName, { name: areaName, markets: [] });
      }
      areaMap.get(areaName).markets.push({
        id: m.id,
        name: m.name,
        image: (m.image_urls && m.image_urls[0]) || m.cover_image_url || '/images/m1.png',
        tags,
      });
    }

    res.render('home', {
      areas: Array.from(areaMap.values()),
      page,
      totalPages,
    });
  } catch (err) {
    console.error('getMarkets error:', err);
    res.status(500).send('Error loading markets.');
  }
};