const MarketModel = require('../models/marketModel');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

exports.getMyMarkets = async (req, res) => {
  try {
    const markets = await MarketModel.getMarketsByOwner(req.session.user.id);
    res.render('owner/my-markets', { markets, dayNames: DAY_NAMES });
  } catch (err) {
    console.error('getMyMarkets error:', err);
    res.status(500).send('Error loading your markets.');
  }
};

// STEP 1: Market Details + Multiple Images
exports.getPublishStep1 = (req, res) => {
  if (!req.session.marketDraft) {
    req.session.marketDraft = {
      details: {},
      operatingDays: [],
      area: { width: 200, length: 100 },
      spots: [],
      elements: []
    };
  }
  res.render('owner/publish-step1', { draft: req.session.marketDraft.details });
};

exports.postPublishStep1 = (req, res) => {
  const {
    name,
    genre,
    location,
    phone_number,
    description,
    bank_name,
    bank_account_number,
    qr_code_url,
    main_image_index
  } = req.body;

  const existingImages = req.session.marketDraft?.details?.image_urls || [];
  let imageUrls =
    req.files && req.files.length > 0
      ? req.files.map((file) => `/uploads/markets/${file.filename}`)
      : [...existingImages];

  const mainIdx = Number(main_image_index) || 0;
  if (imageUrls.length > 1 && mainIdx > 0 && mainIdx < imageUrls.length) {
    const [mainPic] = imageUrls.splice(mainIdx, 1);
    imageUrls.unshift(mainPic);
  }

  req.session.marketDraft = {
    ...(req.session.marketDraft || {}),
    details: {
      name,
      genre,
      location,
      phone_number,
      description,
      image_urls: imageUrls,
      bank_name,
      bank_account_number,
      qr_code_url: qr_code_url || ''
    }
  };
  res.redirect('/owner/markets/new/step-2');
};

// STEP 2: Operating Days
exports.getPublishStep2 = (req, res) => {
  if (!req.session.marketDraft?.details?.name) {
    return res.redirect('/owner/markets/new/step-1');
  }
  res.render('owner/publish-step2', {
    operatingDays: req.session.marketDraft.operatingDays || []
  });
};

exports.postPublishStep2 = (req, res) => {
  const selectedDays = Array.isArray(req.body.days)
    ? req.body.days
    : req.body.days
    ? [req.body.days]
    : [];

  const operatingDays = selectedDays.map((dayIdx) => ({
    day_of_week: Number(dayIdx),
    day_name: DAY_NAMES[Number(dayIdx)],
    open_time: req.body[`open_${dayIdx}`] || '08:00',
    close_time: req.body[`close_${dayIdx}`] || '14:00'
  }));

  req.session.marketDraft.operatingDays = operatingDays;
  res.redirect('/owner/markets/new/step-3');
};

// STEP 3: Market Map
exports.getPublishStep3 = (req, res) => {
  if (!req.session.marketDraft?.details?.name) {
    return res.redirect('/owner/markets/new/step-1');
  }
  res.render('owner/publish-step3', { draft: req.session.marketDraft });
};

exports.postPublishStep3 = (req, res) => {
  const { area_width, area_length, map_data } = req.body;
  let parsed = { spots: [], elements: [] };
  try {
    if (map_data) parsed = JSON.parse(map_data);
  } catch (e) {
    console.error('Invalid map_data JSON:', e);
  }

  req.session.marketDraft.area = {
    width: Number(area_width) || 200,
    length: Number(area_length) || 100
  };
  req.session.marketDraft.spots = parsed.spots || [];
  req.session.marketDraft.elements = parsed.elements || [];

  res.redirect('/owner/markets/new/step-4');
};

// STEP 4: Verify & Publish
exports.getPublishStep4 = (req, res) => {
  const draft = req.session.marketDraft;
  if (!draft?.details?.name) {
    return res.redirect('/owner/markets/new/step-1');
  }
  res.render('owner/publish-step4', { draft });
};

exports.postPublishMarket = async (req, res) => {
  try {
    const draft = req.session.marketDraft;
    if (!draft?.details?.name) {
      return res.redirect('/owner/markets/new/step-1');
    }

    const marketId = await MarketModel.createFullMarket({
      ownerId: req.session.user.id,
      details: draft.details,
      operatingDays: draft.operatingDays || [],
      area: draft.area || { width: 100, length: 100 },
      spots: draft.spots || [],
      elements: draft.elements || []
    });

    delete req.session.marketDraft;
    res.render('owner/publish-success', { marketId });
  } catch (err) {
    console.error('postPublishMarket error:', err);
    res.status(500).send('Failed to publish market.');
  }
};

// OWNER DASHBOARD
exports.getDashboard = async (req, res) => {
  try {
    const marketId = req.params.id;
    const filterDate = req.query.date || '';
    const data = await MarketModel.getDashboardData(marketId, req.session.user.id, filterDate);
    if (!data) return res.status(404).send('Market not found.');

    res.render('owner/dashboard', { ...data, filterDate });
  } catch (err) {
    console.error('getDashboard error:', err);
    res.status(500).send('Error loading market dashboard.');
  }
};

exports.postApproveRental = async (req, res) => {
  try {
    await MarketModel.updateRentalApproval(req.params.rentalId, req.params.id, 'approved');
    res.redirect(`/owner/markets/${req.params.id}/dashboard`);
  } catch (err) {
    console.error('postApproveRental error:', err);
    res.status(500).send('Error approving rental.');
  }
};

exports.postDenyRental = async (req, res) => {
  try {
    await MarketModel.updateRentalApproval(req.params.rentalId, req.params.id, 'denied');
    res.redirect(`/owner/markets/${req.params.id}/dashboard`);
  } catch (err) {
    console.error('postDenyRental error:', err);
    res.status(500).send('Error denying rental.');
  }
};