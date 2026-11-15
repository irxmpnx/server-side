// รายการตลาด (หน้า home.ejs)
// TODO: เปลี่ยนข้อมูลจำลองเป็น query จาก database (เช่น ผ่าน models/marketModel.js)

const buildMarket = (id, name) => ({
  id,
  name,
  image: '/images/m1.png',
  tags: ['today', 'daily'], // today | daily | weekend
});

exports.getMarkets = (req, res) => {
  res.render('home', {
    page: Number(req.query.page) || 1,
    totalPages: 10,
    areas: [
      {
        name: 'ลาดกระบัง',
        markets: [1, 2, 3, 4].map((id) => buildMarket(id, 'ตลาดนัดสุวรรณภูมิ')),
      },
      {
        name: 'รามคำแหง',
        markets: [5, 6, 7, 8].map((id) => buildMarket(id, 'ตลาดนัดสุวรรณภูมิ')),
      },
    ],
  });
};
