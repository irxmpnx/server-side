const { client } = require('../configs/db');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(str) {
  if (!DATE_PATTERN.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const isReal =
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  return isReal ? date : null;
}

function parseDates(raw) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items = String(raw || '').split(',').filter(Boolean);
  const unique = [...new Set(items)];

  for (const item of unique) {
    const date = parseDate(item);
    if (!date || date < today) return null;
  }
  return unique.sort();
}

// Returns the weekdays (0 = Sunday ... 6 = Saturday) a market is open on.
async function getOpenWeekdays(marketId) {
  const { rows } = await client.query(
    `SELECT day_of_week FROM market_operating_days WHERE market_id = $1 ORDER BY day_of_week;`,
    [marketId]
  );
  return rows.map((r) => Number(r.day_of_week));
}

// STEP 1: Select Market & Dates
exports.getStep1 = async (req, res) => {
  try {
    const saved = req.session.rent || {};
    const { rows: markets } = await client.query(
      `SELECT id, name FROM markets WHERE is_verified = TRUE ORDER BY name ASC;`
    );

    // Open weekdays per market, so the calendar only offers bookable days
    const { rows: dayRows } = await client.query(
      `SELECT market_id, day_of_week FROM market_operating_days ORDER BY day_of_week;`
    );
    const marketDays = {};
    markets.forEach((m) => { marketDays[m.id] = []; });
    dayRows.forEach((r) => {
      if (marketDays[r.market_id]) marketDays[r.market_id].push(Number(r.day_of_week));
    });

    res.render('rent-step1', {
      markets,
      marketDays,
      selectedMarket: req.query.marketId || saved.marketId || '',
      shopName: saved.shopName || '',
      selectedDates: saved.dates || [],
    });
  } catch (err) {
    console.error('getStep1 error:', err);
    res.status(500).send('Error loading rental step 1.');
  }
};

exports.postStep1 = async (req, res) => {
  try {
    const { market_id, dates } = req.body;
    const shopName = String(req.body.shop_name || '').trim().replace(/\s+/g, ' ');

    const marketRes = await client.query(
      `SELECT id, name FROM markets WHERE id = $1 AND is_verified = TRUE;`,
      [market_id]
    );
    const list = parseDates(dates);

    // Every selected date must fall on a day the market is open
    let allOpen = false;
    if (marketRes.rows.length > 0 && list && list.length > 0) {
      const openDays = await getOpenWeekdays(market_id);
      allOpen = list.every((d) => openDays.includes(parseDate(d).getDay()));
    }

    if (
      !allOpen ||
      marketRes.rows.length === 0 ||
      !list ||
      list.length === 0 ||
      shopName.length === 0 ||
      shopName.length > 150
    ) {
      return res.redirect('/rent/step1');
    }

    req.session.rent = {
      ...(req.session.rent || {}),
      marketId: Number(market_id),
      marketName: marketRes.rows[0].name,
      shopName,
      dates: list,
    };

    res.redirect('/rent/step2');
  } catch (err) {
    console.error('postStep1 error:', err);
    res.redirect('/rent/step1');
  }
};

// STEP 2: Select a Spot (Checks spots not already booked on selected dates)
exports.getStep2 = async (req, res) => {
  const rent = req.session.rent;
  if (!rent || !rent.marketId || !rent.dates?.length) {
    return res.redirect('/rent/step1');
  }

  try {
    const marketRes = await client.query(`SELECT * FROM markets WHERE id = $1;`, [rent.marketId]);
    const spotsRes = await client.query(
      `SELECT s.*,
         EXISTS (
           SELECT 1 FROM rental_dates rd
           WHERE rd.spot_id = s.id AND rd.is_active = TRUE AND rd.rental_date = ANY($2::date[])
         ) AS is_booked
       FROM market_spots s
       WHERE s.market_id = $1 AND s.is_active = TRUE
       ORDER BY s.spot_name ASC;`,
      [rent.marketId, rent.dates]
    );

    const elementsRes = await client.query(
      `SELECT * FROM market_map_elements WHERE market_id = $1;`,
      [rent.marketId]
    );

    res.render('rent-step2', {
      market: marketRes.rows[0],
      spots: spotsRes.rows,
      elements: elementsRes.rows,
      selectedSpotId: rent.spotId || '',
      dates: rent.dates,
    });
  } catch (err) {
    console.error('getStep2 error:', err);
    res.status(500).send('Error loading market spots.');
  }
};

exports.postStep2 = async (req, res) => {
  const rent = req.session.rent;
  if (!rent || !rent.marketId) return res.redirect('/rent/step1');

  const spotId = Number(req.body.spot_id);
  const spotRes = await client.query(
    `SELECT id, spot_name, width, length, price_per_day FROM market_spots WHERE id = $1 AND market_id = $2;`,
    [spotId, rent.marketId]
  );
  if (spotRes.rows.length === 0) return res.redirect('/rent/step2');

  const spot = spotRes.rows[0];
  rent.spotId = spot.id;
  rent.spotName = spot.spot_name;
  rent.spotSize = `${spot.width}x${spot.length}`;
  rent.pricePerDay = Number(spot.price_per_day);
  rent.totalPrice = rent.pricePerDay * rent.dates.length;

  res.redirect('/rent/step3');
};

// STEP 3: Confirm Detail
exports.getStep3 = (req, res) => {
  const rent = req.session.rent;
  if (!rent || !rent.spotId) return res.redirect('/rent/step2');
  res.render('rent-step3', { rent });
};

exports.postStep3 = (req, res) => {
  const rent = req.session.rent;
  if (!rent || !rent.spotId) return res.redirect('/rent/step2');

  rent.paymentDueAt = Date.now() + 60 * 60 * 1000; // Start 1-hour payment window
  res.redirect('/rent/step4');
};