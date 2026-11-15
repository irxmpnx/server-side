// ต้องติดตั้งก่อน: npm install multer
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// เก็บสลิปนอกโฟลเดอร์ public เพื่อไม่ให้ใครเปิดดูผ่าน URL ได้ตรงๆ (สลิปเป็นข้อมูลการเงิน)
const SLIP_DIR = path.join(__dirname, '..', 'uploads', 'slips');
fs.mkdirSync(SLIP_DIR, { recursive: true });

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const slipUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, SLIP_DIR),
    // ตั้งชื่อไฟล์เองด้วย UUID ไม่ใช้ชื่อจากผู้ใช้
    filename: (req, file, cb) =>
      cb(null, crypto.randomUUID() + EXT_BY_MIME[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    EXT_BY_MIME[file.mimetype] ? cb(null, true) : cb(new Error('INVALID_TYPE')),
}).single('slip');

// ครอบเพื่อจับ error ของ multer แล้วส่งกลับหน้า step 4 พร้อมข้อความ
exports.uploadSlip = (req, res, next) => {
  slipUpload(req, res, (err) => {
    if (!err) return next();

    req.session.rentError =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'The file is larger than 5 MB.'
        : 'Please attach a JPG, PNG or WebP image.';
    res.redirect('/rent/step-4');
  });
};
