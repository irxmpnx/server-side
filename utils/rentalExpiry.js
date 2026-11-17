const { client } = require('../configs/db');

// Cancel every unpaid rental whose payment deadline has passed and release its dates,
// so the spot becomes bookable again. cancelled_at is the deadline itself (the moment it expired).
async function expireUnpaidRentals() {
  try {
    const { rowCount } = await client.query(
      `WITH expired AS (
         UPDATE rentals
         SET payment_status = 'cancelled', cancelled_at = payment_deadline
         WHERE payment_status = 'unpaid'
           AND payment_deadline IS NOT NULL
           AND payment_deadline < NOW()
         RETURNING id
       )
       UPDATE rental_dates
       SET is_active = FALSE
       WHERE rental_id IN (SELECT id FROM expired);`
    );
    return rowCount;
  } catch (err) {
    console.error('expireUnpaidRentals error:', err.message);
    return 0;
  }
}

// Run once now, then keep checking in the background.
function startRentalExpirySweeper(intervalMs = 15 * 1000) {
  expireUnpaidRentals();
  const timer = setInterval(expireUnpaidRentals, intervalMs);
  if (timer.unref) timer.unref();
  return timer;
}

module.exports = { expireUnpaidRentals, startRentalExpirySweeper };
