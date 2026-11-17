const { client } = require('../configs/db');

const MarketModel = {
  async getMarketsByOwner(ownerId) {
    const query = `
      SELECT m.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'day_of_week', d.day_of_week,
              'open_time', TO_CHAR(d.open_time, 'HH24:MI'),
              'close_time', TO_CHAR(d.close_time, 'HH24:MI')
            ) ORDER BY d.day_of_week
          ) FILTER (WHERE d.id IS NOT NULL), '[]'
        ) AS operating_days
      FROM markets m
      LEFT JOIN market_operating_days d ON d.market_id = m.id
      WHERE m.owner_id = $1
      GROUP BY m.id
      ORDER BY m.created_at DESC;
    `;
    const { rows } = await client.query(query, [ownerId]);
    return rows;
  },

  async createFullMarket({ ownerId, details, operatingDays, area, spots, elements }) {
    try {
      await client.query('BEGIN');

      const images =
        Array.isArray(details.image_urls) && details.image_urls.length > 0
          ? details.image_urls
          : ['/images/no_Image.svg'];

      const marketRes = await client.query(
        `INSERT INTO markets (
           owner_id, name, genre, location, phone_number, description,
           cover_image_url, image_urls, bank_name, bank_account_number, qr_code_url,
           area_width, area_length, is_verified
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE)
         RETURNING id;`,
        [
          ownerId,
          details.name,
          details.genre,
          details.location,
          details.phone_number,
          details.description || '',
          images[0],
          images,
          details.bank_name || '',
          details.bank_account_number || '',
          details.qr_code_url || null,
          area.width || 200,
          area.length || 100,
        ]
      );
      const marketId = marketRes.rows[0].id;

      for (const day of operatingDays) {
        await client.query(
          `INSERT INTO market_operating_days (market_id, day_of_week, open_time, close_time)
           VALUES ($1, $2, $3, $4);`,
          [marketId, day.day_of_week, day.open_time, day.close_time]
        );
      }

      for (const spot of spots) {
        await client.query(
          `INSERT INTO market_spots (market_id, spot_name, width, length, price_per_day, pos_x, pos_y)
           VALUES ($1, $2, $3, $4, $5, $6, $7);`,
          [marketId, spot.spot_name, spot.width, spot.length, spot.price_per_day, spot.pos_x || 0, spot.pos_y || 0]
        );
      }

      for (const el of elements) {
        await client.query(
          `INSERT INTO market_map_elements (market_id, element_type, label, pos_x, pos_y)
           VALUES ($1, $2, $3, $4, $5);`,
          [marketId, el.element_type, el.label, el.pos_x || 0, el.pos_y || 0]
        );
      }

      await client.query('COMMIT');
      return marketId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  },

  async getFullMarketForEdit(marketId, ownerId) {
    const marketRes = await client.query(
      `SELECT * FROM markets WHERE id = $1 AND owner_id = $2;`,
      [marketId, ownerId]
    );
    if (marketRes.rows.length === 0) return null;
    const market = marketRes.rows[0];

    const daysRes = await client.query(
      `SELECT day_of_week,
              TO_CHAR(open_time, 'HH24:MI') AS open_time,
              TO_CHAR(close_time, 'HH24:MI') AS close_time
       FROM market_operating_days
       WHERE market_id = $1
       ORDER BY day_of_week ASC;`,
      [marketId]
    );

    const spotsRes = await client.query(
      `SELECT id, spot_name, width, length, price_per_day, pos_x, pos_y
       FROM market_spots
       WHERE market_id = $1 AND is_active = TRUE
       ORDER BY id ASC;`,
      [marketId]
    );

    const elementsRes = await client.query(
      `SELECT id, element_type, label, pos_x, pos_y
       FROM market_map_elements
       WHERE market_id = $1
       ORDER BY id ASC;`,
      [marketId]
    );

    return {
      market,
      operatingDays: daysRes.rows,
      spots: spotsRes.rows,
      elements: elementsRes.rows,
    };
  },

  async updateFullMarket(marketId, ownerId, draft) {
    const { details, operatingDays, area, spots, elements } = draft;
    const images =
      Array.isArray(details.image_urls) && details.image_urls.length > 0
        ? details.image_urls
        : ['/images/no_Image.svg'];

    await client.query('BEGIN');
    try {
      await client.query(
        `UPDATE markets
         SET name = $1,
             genre = $2,
             location = $3,
             phone_number = $4,
             description = $5,
             cover_image_url = $6,
             image_urls = $7::text[],
             area_width = $8,
             area_length = $9,
             bank_name = $10,
             bank_account_number = $11,
             qr_code_url = COALESCE($12, qr_code_url)
         WHERE id = $13 AND owner_id = $14;`,
        [
          details.name,
          details.genre,
          details.location,
          details.phone_number,
          details.description || '',
          images[0],
          images,
          Number(area?.width) || 200,
          Number(area?.length) || 100,
          details.bank_name || '',
          details.bank_account_number || '',
          details.qr_code_url || null,
          marketId,
          ownerId,
        ]
      );

      await client.query(`DELETE FROM market_operating_days WHERE market_id = $1;`, [marketId]);
      for (const day of operatingDays || []) {
        await client.query(
          `INSERT INTO market_operating_days (market_id, day_of_week, open_time, close_time)
           VALUES ($1, $2, $3, $4);`,
          [marketId, Number(day.day_of_week), day.open_time, day.close_time]
        );
      }

      const keptSpotIds = [];
      for (const spot of spots || []) {
        if (spot.id) {
          keptSpotIds.push(Number(spot.id));
          await client.query(
            `UPDATE market_spots
             SET spot_name = $1, width = $2, length = $3, price_per_day = $4, pos_x = $5, pos_y = $6, is_active = TRUE
             WHERE id = $7 AND market_id = $8;`,
            [
              spot.spot_name,
              Number(spot.width),
              Number(spot.length),
              Number(spot.price_per_day),
              Number(spot.pos_x) || 0,
              Number(spot.pos_y) || 0,
              Number(spot.id),
              marketId,
            ]
          );
        } else {
          const ins = await client.query(
            `INSERT INTO market_spots (market_id, spot_name, width, length, price_per_day, pos_x, pos_y, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
             RETURNING id;`,
            [
              marketId,
              spot.spot_name,
              Number(spot.width),
              Number(spot.length),
              Number(spot.price_per_day),
              Number(spot.pos_x) || 0,
              Number(spot.pos_y) || 0,
            ]
          );
          keptSpotIds.push(ins.rows[0].id);
        }
      }

      if (keptSpotIds.length > 0) {
        await client.query(
          `UPDATE market_spots SET is_active = FALSE WHERE market_id = $1 AND NOT (id = ANY($2::int[]));`,
          [marketId, keptSpotIds]
        );
      } else {
        await client.query(`UPDATE market_spots SET is_active = FALSE WHERE market_id = $1;`, [marketId]);
      }

      await client.query(`DELETE FROM market_map_elements WHERE market_id = $1;`, [marketId]);
      for (const el of elements || []) {
        await client.query(
          `INSERT INTO market_map_elements (market_id, element_type, label, pos_x, pos_y)
           VALUES ($1, $2, $3, $4, $5);`,
          [marketId, el.element_type, el.label, Number(el.pos_x) || 0, Number(el.pos_y) || 0]
        );
      }

      await client.query('COMMIT');
      return marketId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  },

  async getDashboardData(marketId, ownerId, filterDate = null) {
    const marketRes = await client.query(
      `SELECT * FROM markets WHERE id = $1 AND owner_id = $2;`,
      [marketId, ownerId]
    );
    const market = marketRes.rows[0];
    if (!market) return null;

    const spotsRes = await client.query(
      `SELECT COUNT(*)::int AS total_spots FROM market_spots WHERE market_id = $1 AND is_active = TRUE;`,
      [marketId]
    );
    const totalSpots = spotsRes.rows[0].total_spots;

    const rentalsQuery = `
      SELECT r.id, r.rental_code, r.shop_name, r.total_price, r.payment_status, r.approval_status, r.slip_image_url,
             u.first_name, u.last_name, u.phone_number,
             s.spot_name,
             ARRAY_AGG(TO_CHAR(rd.rental_date, 'DD/MM/YYYY') ORDER BY rd.rental_date) AS dates
      FROM rentals r
      JOIN users u ON u.id = r.tenant_id
      JOIN market_spots s ON s.id = r.spot_id
      LEFT JOIN rental_dates rd ON rd.rental_id = r.id
      WHERE r.market_id = $1
        AND ($2::date IS NULL OR EXISTS (
          SELECT 1 FROM rental_dates rd2 WHERE rd2.rental_id = r.id AND rd2.rental_date = $2::date
        ))
      GROUP BY r.id, u.first_name, u.last_name, u.phone_number, s.spot_name
      ORDER BY r.created_at DESC;
    `;
    const { rows: rentals } = await client.query(rentalsQuery, [marketId, filterDate || null]);

    const rentedCount = rentals.filter((r) => r.approval_status !== 'denied' && r.payment_status !== 'cancelled').length;
    const totalRent = rentals
      .filter((r) => r.approval_status === 'approved')
      .reduce((sum, r) => sum + Number(r.total_price), 0);

    return {
      market,
      stats: {
        totalSpots,
        available: Math.max(0, totalSpots - rentedCount),
        rented: rentedCount,
        totalRent,
      },
      rentals,
    };
  },

  async updateRentalApproval(rentalId, marketId, status) {
    await client.query(
      `UPDATE rentals SET approval_status = $1 WHERE id = $2 AND market_id = $3;`,
      [status, rentalId, marketId]
    );
    if (status === 'denied') {
      await client.query(`UPDATE rental_dates SET is_active = FALSE WHERE rental_id = $1;`, [rentalId]);
    }
  },

  async getMarketInsightById(marketId, viewerUserId = null) {
    const marketRes = await client.query(
      `SELECT * FROM markets
       WHERE id = $1
         AND (is_verified = TRUE OR owner_id = $2);`,
      [marketId, viewerUserId]
    );
    if (marketRes.rows.length === 0) return null;
    const market = marketRes.rows[0];

    const daysRes = await client.query(
      `SELECT day_of_week,
              TO_CHAR(open_time, 'HH24:MI') AS open_time,
              TO_CHAR(close_time, 'HH24:MI') AS close_time
       FROM market_operating_days
       WHERE market_id = $1
       ORDER BY day_of_week ASC;`,
      [marketId]
    );

    const spotsRes = await client.query(
      `SELECT s.id, s.spot_name, s.width, s.length, s.price_per_day, s.pos_x, s.pos_y,
              EXISTS (
                SELECT 1
                FROM rentals r
                JOIN rental_dates rd ON rd.rental_id = r.id
                WHERE r.spot_id = s.id
                  AND r.approval_status != 'denied'
                  AND r.payment_status != 'cancelled'
                  AND rd.is_active = TRUE
                  AND rd.rental_date >= CURRENT_DATE
              ) AS is_booked,
              (
                SELECT COALESCE(r.shop_name, u.first_name)
                FROM rentals r
                JOIN users u ON u.id = r.tenant_id
                WHERE r.spot_id = s.id AND r.approval_status = 'approved'
                ORDER BY r.created_at DESC
                LIMIT 1
              ) AS current_shop
       FROM market_spots s
       WHERE s.market_id = $1 AND s.is_active = TRUE
       ORDER BY s.spot_name ASC, s.id ASC;`,
      [marketId]
    );

    const elementsRes = await client.query(
      `SELECT id, element_type, label, pos_x, pos_y
       FROM market_map_elements
       WHERE market_id = $1
       ORDER BY id ASC;`,
      [marketId]
    );

    return {
      market,
      operatingDays: daysRes.rows,
      spots: spotsRes.rows,
      elements: elementsRes.rows,
    };
  },
  async toggleMarketOpen(marketId, ownerId) {
    const { rows } = await client.query(
      `UPDATE markets
       SET is_open = NOT COALESCE(is_open, TRUE)
       WHERE id = $1 AND owner_id = $2
       RETURNING is_open;`,
      [marketId, ownerId]
    );
    return rows[0] || null;
  },

  async deleteMarket(marketId, ownerId) {
    await client.query('BEGIN');
    try {
      // Remove child records cleanly in case foreign keys do not have ON DELETE CASCADE
      await client.query(
        `DELETE FROM rental_dates WHERE rental_id IN (SELECT id FROM rentals WHERE market_id = $1);`,
        [marketId]
      );
      await client.query(`DELETE FROM rentals WHERE market_id = $1;`, [marketId]);
      await client.query(`DELETE FROM market_map_elements WHERE market_id = $1;`, [marketId]);
      await client.query(`DELETE FROM market_spots WHERE market_id = $1;`, [marketId]);
      await client.query(`DELETE FROM market_operating_days WHERE market_id = $1;`, [marketId]);
      await client.query(`DELETE FROM markets WHERE id = $1 AND owner_id = $2;`, [marketId, ownerId]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  },
};


module.exports = MarketModel;