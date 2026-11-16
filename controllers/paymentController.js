const crypto = require('crypto');
const { client } = require('../configs/db');

const PAYMENT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function getMarketPayment(marketId) {
  const { rows } = await client.query(
    `SELECT m.bank_name, m.bank_account_number, m.qr_code_url,
            u.first_name, u.last_name
     FROM markets m
     JOIN users u ON u.id = m.owner_id
     WHERE m.id = $1;`,
    [marketId]
  );
  const row = rows[0];
  if (!row) {
    return { bankName: 'Bank name', accountName: '', accountNumber: 'xxxxxxxxxx', qrImage: '/images/qr_payment.svg' };
  }
  return {
    bankName: row.bank_name || 'Bank Transfer',
    accountName: `${row.first_name} ${row.last_name.charAt(0)}.`,
    accountNumber: row.bank_account_number || '-',
    qrImage: row.qr_code_url || '/images/qr_payment.svg',
  };
}

async function persistRental(req, rent, paymentStatus, slipFilename = null) {
  if (rent.rentalId) {
    // Update existing unpaid rental if tenant attaches slip later
    if (paymentStatus === 'paid' && slipFilename) {
      await client.query(
        `UPDATE rentals SET payment_status = 'paid', slip_image_url = $1, paid_at = NOW() WHERE id = $2;`,
        [slipFilename, rent.rentalId]
      );
    }
    return rent.rentalId;
  }

  await client.query('BEGIN');
  try {
    // Save tenant's shop name if not already stored
    await client.query(
      `INSERT INTO shops (seller_id, shop_name)
       SELECT $1::int, $2::varchar
       WHERE NOT EXISTS (
         SELECT 1 FROM shops WHERE seller_id = $1::int AND shop_name = $2::varchar
       );`,
      [req.session.user.id, rent.shopName]
    );

    const rentalCode = 'RNT-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const totalPrice = rent.totalPrice || 1500 * rent.dates.length;

    const rentalRes = await client.query(
      `INSERT INTO rentals (
         rental_code, tenant_id, market_id, spot_id, shop_name,
         total_price, payment_status, slip_image_url, payment_deadline, paid_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TO_TIMESTAMP($9 / 1000.0), $10)
       RETURNING id;`,
      [
        rentalCode,
        req.session.user.id,
        rent.marketId,
        rent.spotId,
        rent.shopName,
        totalPrice,
        paymentStatus,
        slipFilename,
        rent.paymentDueAt,
        paymentStatus === 'paid' ? new Date() : null,
      ]
    );
    const rentalId = rentalRes.rows[0].id;

    for (const d of rent.dates) {
      await client.query(
        `INSERT INTO rental_dates (rental_id, spot_id, rental_date, is_active)
         VALUES ($1, $2, $3, TRUE);`,
        [rentalId, rent.spotId, d]
      );
    }

    await client.query('COMMIT');
    rent.rentalId = rentalId;
    return rentalId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

exports.getStep4 = async (req, res) => {
  try {
    const rent = req.session.rent;
    if (!rent || !rent.marketId || !rent.dates || rent.dates.length === 0) {
      return res.redirect('/rent/step1');
    }

    if (!rent.paymentDueAt) {
      rent.paymentDueAt = Date.now() + PAYMENT_WINDOW_MS;
    }

    const remainingSeconds = Math.max(
      0,
      Math.floor((rent.paymentDueAt - Date.now()) / 1000)
    );

    const error = req.session.rentError || '';
    delete req.session.rentError;

    const payment = await getMarketPayment(rent.marketId);

    res.render('rent-step4', {
      payment,
      remainingSeconds,
      expired: remainingSeconds === 0,
      error,
      backUrl: rent.rentalId ? '/myRental?status=unpaid' : '/rent/step3',
    });
  } catch (err) {
    console.error('getStep4 error:', err);
    res.status(500).send('Error loading payment page.');
  }
};

exports.postStep4 = async (req, res) => {
  try {
    const rent = req.session.rent;
    if (!rent || !rent.paymentDueAt) return res.redirect('/rent/step1');

    if (Date.now() > rent.paymentDueAt) return res.redirect('/rent/step4');

    // Submitted without slip -> create 'unpaid' booking & show Payment Required
    if (!req.file) {
      await persistRental(req, rent, 'unpaid', null);
      rent.status = 'payment_required';
      return req.session.save(() => res.redirect('/rent/payment-required'));
    }

    // Submitted with slip -> create 'paid' booking & show Rental is successful
    await persistRental(req, rent, 'paid', req.file.filename);
    rent.slipFile = req.file.filename;
    rent.status = 'pending_review';
    return req.session.save(() => res.redirect('/rent/success'));
  } catch (err) {
    console.error('postStep4 error:', err);

    // Only redirect to Step 2 if the spot was double-booked (unique constraint 23505)
    if (err.code === '23505') {
      req.session.rentError = 'This spot was just booked for one of your selected dates. Please choose another spot.';
      return req.session.save(() => res.redirect('/rent/step2'));
    }

    req.session.rentError = `Could not complete booking: ${err.message}`;
    return req.session.save(() => res.redirect('/rent/step4'));
  }
};

exports.getSuccess = (req, res) => {
  const rent = req.session.rent;
  if (!rent || !rent.slipFile) return res.redirect('/rent/step4');
  delete req.session.rent;
  res.render('rent-result', { variant: 'success' });
};

exports.getPaymentRequired = (req, res) => {
  if (!req.session.rent) return res.redirect('/rent/step1');
  delete req.session.rent;
  res.render('rent-result', { variant: 'pending' });
};