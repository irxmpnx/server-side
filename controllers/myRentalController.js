const { client } = require('../configs/db');

// Show only the logged-in tenant's rentals.
exports.getMyRental = async (req, res) => {
  try {
    const { rows: rentals } = await client.query(
      `SELECT
         r.id,
         r.rental_code,
         r.total_price,
         r.payment_status,
         r.approval_status,
         r.checked_in_at,
         r.cancelled_at,
         m.name AS market_name,
         m.location AS market_location,
         m.phone_number AS market_phone,
         s.spot_name,
         COALESCE(
           ARRAY_AGG(TO_CHAR(rd.rental_date, 'DD/MM/YYYY') ORDER BY rd.rental_date)
             FILTER (WHERE rd.rental_date IS NOT NULL),
           ARRAY[]::text[]
         ) AS rental_dates
       FROM rentals r
       JOIN markets m ON m.id = r.market_id
       JOIN market_spots s ON s.id = r.spot_id
       LEFT JOIN rental_dates rd ON rd.rental_id = r.id
       WHERE r.tenant_id = $1
       GROUP BY r.id, m.name, m.location, m.phone_number, s.spot_name
       ORDER BY r.created_at DESC;`,
      [req.session.user.id]
    );

    res.render('my-rental', {
      rentals,
      activeFilter: req.query.status || 'all',
      message: req.query.message || '',
    });
  } catch (err) {
    console.error('getMyRental error:', err);
    res.status(500).send('Unable to load your rentals.');
  }
};

// Pay an existing unpaid rental: reload its data into the session and
// send the tenant to Step 4 (payment page).
exports.payRental = async (req, res) => {
  try {
    const { rows } = await client.query(
      `SELECT r.id, r.market_id, r.spot_id, r.shop_name, r.total_price,
              EXTRACT(EPOCH FROM (r.payment_deadline AT TIME ZONE current_setting('TimeZone'))) * 1000 AS payment_due_ms,
              m.name AS market_name,
              s.spot_name, s.width, s.length, s.price_per_day,
              COALESCE(
                ARRAY_AGG(TO_CHAR(rd.rental_date, 'YYYY-MM-DD') ORDER BY rd.rental_date)
                  FILTER (WHERE rd.rental_date IS NOT NULL),
                ARRAY[]::text[]
              ) AS dates
       FROM rentals r
       JOIN markets m ON m.id = r.market_id
       JOIN market_spots s ON s.id = r.spot_id
       LEFT JOIN rental_dates rd ON rd.rental_id = r.id AND rd.is_active = TRUE
       WHERE r.id = $1 AND r.tenant_id = $2 AND r.payment_status = 'unpaid'
       GROUP BY r.id, m.name, s.spot_name, s.width, s.length, s.price_per_day;`,
      [req.params.id, req.session.user.id]
    );

    if (rows.length === 0) {
      return res.redirect('/myRental?message=not-payable');
    }

    const r = rows[0];
    req.session.rent = {
      rentalId: r.id,
      marketId: r.market_id,
      marketName: r.market_name,
      shopName: r.shop_name,
      dates: r.dates,
      spotId: r.spot_id,
      spotName: r.spot_name,
      spotSize: `${r.width}x${r.length}`,
      pricePerDay: Number(r.price_per_day),
      totalPrice: Number(r.total_price),
      // Keep the original deadline; fall back to a fresh window if none was stored.
      paymentDueAt: r.payment_due_ms ? Math.round(Number(r.payment_due_ms)) : Date.now() + 60 * 60 * 1000,
    };

    req.session.save(() => res.redirect('/rent/step4'));
  } catch (err) {
    console.error('payRental error:', err);
    res.redirect('/myRental?message=error');
  }
};

// A tenant may cancel their own unpaid rental. Its dates are released too.
exports.cancelRental = async (req, res) => {
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE rentals
       SET payment_status = 'cancelled', cancelled_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND payment_status = 'unpaid'
       RETURNING id;`,
      [req.params.id, req.session.user.id]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.redirect('/myRental?message=not-cancellable');
    }

    await client.query(
      `UPDATE rental_dates SET is_active = FALSE WHERE rental_id = $1;`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.redirect('/myRental?status=cancel&message=cancelled');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('cancelRental error:', err);
    res.redirect('/myRental?message=error');
  }
};

// Check-in is available for a paid rental that has not been checked in yet.
exports.checkInRental = async (req, res) => {
  try {
    const result = await client.query(
      `UPDATE rentals
       SET checked_in_at = NOW()
       WHERE id = $1
         AND tenant_id = $2
         AND payment_status = 'paid'
         AND checked_in_at IS NULL
       RETURNING id;`,
      [req.params.id, req.session.user.id]
    );

    res.redirect(`/myRental?status=paid&message=${result.rowCount ? 'checked-in' : 'cannot-check-in'}`);
  } catch (err) {
    console.error('checkInRental error:', err);
    res.redirect('/myRental?message=error');
  }
};
