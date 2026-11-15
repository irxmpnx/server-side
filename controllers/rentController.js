// ขั้นตอนเช่าพื้นที่ (Rent a spot)
// TODO: เปลี่ยนรายชื่อตลาดจำลองเป็น query จาก database

const MARKETS = [
  { id: 1, name: 'ตลาดนัดสุวรรณภูมิ' },
  { id: 2, name: 'ตลาดนัดรามคำแหง' },
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// แปลง "YYYY-MM-DD" เป็น Date (เวลาท้องถิ่น) ถ้าวันที่ไม่มีจริง เช่น 2026-02-31 จะคืน null
function parseDate(str) {
  if (!DATE_PATTERN.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const isReal =
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  return isReal ? date : null;
}

// รับสตริงคั่นด้วยจุลภาค คืนค่ารายการวันที่ที่ถูกต้อง (ไม่ซ้ำ เรียงลำดับ ไม่ใช่วันที่ผ่านมาแล้ว)
// ถ้ามีค่าใดไม่ถูกต้อง คืน null
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

exports.getStep1 = (req, res) => {
  const saved = req.session.rent || {};

  res.render('rent-step1', {
    markets: MARKETS,
    selectedMarket: saved.marketId || '',
    shopName: saved.shopName || '',
    selectedDates: saved.dates || [],
  });
};

exports.postStep1 = (req, res) => {
  const { market_id, dates } = req.body;
  const shopName = String(req.body.shop_name || '').trim().replace(/\s+/g, ' ');

  // ตรวจฝั่ง server เสมอ อย่าเชื่อข้อมูลจากเบราว์เซอร์
  const marketExists = MARKETS.some((m) => String(m.id) === String(market_id));
  const list = parseDates(dates);

  if (!marketExists || !list || list.length === 0 || shopName.length === 0 || shopName.length > 150) {
    return res.redirect('/rent/step1');
  }

  req.session.rent = { marketId: market_id, shopName, dates: list };
  res.redirect('/rent/step2'); // หน้าถัดไป (Select a spot) ยังต้องสร้าง
};
