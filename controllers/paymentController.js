// Step 4 (Payment) และหน้าผลลัพธ์ (Rental is successful / Payment required)
// TODO: เมื่อมี database ให้ย้าย paymentDueAt / slip / status ไปเก็บในตาราง rentals

const PAYMENT_WINDOW_MS = 60 * 60 * 1000; // ชำระภายใน 1 ชั่วโมง

// ข้อมูลบัญชีของตลาดที่เลือก (ข้อมูลจำลอง) ควรดึงจากตาราง markets
function getMarketPayment(marketId) {
  return {
    bankName: 'Bank name',
    accountName: '',
    accountNumber: 'xxxxxxxxxx',
    qrImage: '/images/payment-qr.png',
  };
}

exports.getStep4 = (req, res) => {
  const rent = req.session.rent;
  if (!rent || !rent.marketId || !rent.dates || rent.dates.length === 0) {
    return res.redirect('/rent/step-1');
  }

  // ในระบบจริงค่านี้ต้องถูกตั้งตอนกด Confirm Rental (step 3) ไม่ใช่ตอนเปิดหน้านี้
  if (!rent.paymentDueAt) {
    rent.paymentDueAt = Date.now() + PAYMENT_WINDOW_MS;
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((rent.paymentDueAt - Date.now()) / 1000)
  );

  // อ่านข้อความ error แบบครั้งเดียวแล้วลบ
  const error = req.session.rentError || '';
  delete req.session.rentError;

  res.render('rent-step4', {
    payment: getMarketPayment(rent.marketId),
    remainingSeconds,
    expired: remainingSeconds === 0,
    error,
  });
};

exports.postStep4 = (req, res) => {
  const rent = req.session.rent;
  if (!rent || !rent.paymentDueAt) return res.redirect('/rent/step-1');

  // หมดเวลาแล้ว: ไม่รับสลิป
  if (Date.now() > rent.paymentDueAt) return res.redirect('/rent/step-4');

  // กด Next โดยยังไม่แนบสลิป -> Payment required
  if (!req.file) return res.redirect('/rent/payment-required');

  rent.slipFile = req.file.filename;
  rent.status = 'pending_review';
  res.redirect('/rent/success');
};

exports.getSuccess = (req, res) => {
  const rent = req.session.rent;
  if (!rent || !rent.slipFile) return res.redirect('/rent/step-4');
  res.render('rent-result', { variant: 'success' });
};

exports.getPaymentRequired = (req, res) => {
  if (!req.session.rent) return res.redirect('/rent/step-1');
  res.render('rent-result', { variant: 'pending' });
};
