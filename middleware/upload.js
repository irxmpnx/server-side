const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 1. Private directory for payment slips (not directly accessible via static URL)
const SLIP_DIR = path.join(__dirname, '..', 'uploads', 'slips');
fs.mkdirSync(SLIP_DIR, { recursive: true });

// 2. Public directory for market cover/gallery photos
const MARKET_IMG_DIR = path.join(__dirname, '..', 'public', 'uploads', 'markets');
fs.mkdirSync(MARKET_IMG_DIR, { recursive: true });

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const imageFileFilter = (req, file, cb) => {
  if (EXT_BY_MIME[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_TYPE'), false);
  }
};

// =========================================
// TENANT PAYMENT SLIP UPLOAD (Single file)
// =========================================
const slipUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, SLIP_DIR),
    filename: (req, file, cb) =>
      cb(null, `${crypto.randomUUID()}${EXT_BY_MIME[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: imageFileFilter,
}).single('slip');

const uploadSlip = (req, res, next) => {
  slipUpload(req, res, (err) => {
    if (!err) return next();

    req.session.rentError =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'The file is larger than 5 MB.'
        : 'Please attach a JPG, PNG or WebP image.';
    res.redirect('/rent/step-4');
  });
};

// =========================================
// MARKET OWNER GALLERY UPLOAD (Up to 10 files)
// =========================================
const uploadMarketImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, MARKET_IMG_DIR),
    filename: (req, file, cb) =>
      cb(null, `market-${crypto.randomUUID()}${EXT_BY_MIME[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: imageFileFilter,
});

module.exports = {
  uploadSlip,
  uploadMarketImages,
};