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

exports.startNewMarket = (req, res) => {
  req.session.marketDraft = {
    editingMarketId: null,
    details: {},
    operatingDays: [],
    area: { width: 200, length: 100 },
    spots: [],
    elements: [],
  };
  req.session.save(() => res.redirect('/owner/markets/new/step-1'));
};

exports.getEditMarket = async (req, res) => {
  try {
    const marketId = Number(req.params.id);
    const ownerId = req.session.user.id;

    const fullData = await MarketModel.getFullMarketForEdit(marketId, ownerId);
    if (!fullData) {
      return res.status(403).redirect('/owner/markets');
    }

    req.session.marketDraft = {
      editingMarketId: marketId,
      details: {
        name: fullData.market.name,
        genre: fullData.market.genre,
        location: fullData.market.location,
        phone_number: fullData.market.phone_number,
        description: fullData.market.description,
        image_urls: fullData.market.image_urls || [fullData.market.cover_image_url],
        bank_name: fullData.market.bank_name,
        bank_account_number: fullData.market.bank_account_number,
        qr_code_url: fullData.market.qr_code_url,
      },
      operatingDays: fullData.operatingDays,
      area: {
        width: fullData.market.area_width,
        length: fullData.market.area_length,
      },
      spots: fullData.spots,
      elements: fullData.elements,
    };

    res.redirect('/owner/markets/new/step-1');
  } catch (err) {
    console.error('getEditMarket error:', err);
    res.redirect('/owner/markets');
  }
};

// STEP 1: Market Details + Multiple Images
exports.getPublishStep1 = (req, res) => {
  if (req.query.fresh === '1') {
    delete req.session.marketDraft;
  }

  const draft = req.session.marketDraft?.details || {};
  res.render('owner/publish-step1', { draft, isEditing: !!req.session.marketDraft?.editingMarketId });
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
    kept_images,
    main_image_index,
  } = req.body;

  let keptUrls = [];
  try {
    if (kept_images) keptUrls = JSON.parse(kept_images);
  } catch (e) {
    keptUrls = req.session.marketDraft?.details?.image_urls || [];
  }

  const newlyUploadedUrls =
    req.files && req.files.length > 0
      ? req.files.map((file) => `/uploads/markets/${file.filename}`)
      : [];

  const imageUrls = [...keptUrls, ...newlyUploadedUrls];

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
      qr_code_url: qr_code_url || req.session.marketDraft?.details?.qr_code_url || '',
    },
  };
  res.redirect('/owner/markets/new/step-2');
};

// STEP 2: Operating Days
exports.getPublishStep2 = (req, res) => {
  if (!req.session.marketDraft?.details?.name) {
    return res.redirect('/owner/markets/new/step-1');
  }
  res.render('owner/publish-step2', {
    isEditing: !!req.session.marketDraft.editingMarketId,
    operatingDays: req.session.marketDraft.operatingDays || [],
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
    close_time: req.body[`close_${dayIdx}`] || '14:00',
  }));

  req.session.marketDraft.operatingDays = operatingDays;
  res.redirect('/owner/markets/new/step-3');
};

// STEP 3: Market Map
exports.getPublishStep3 = (req, res) => {
  if (!req.session.marketDraft?.details?.name) {
    return res.redirect('/owner/markets/new/step-1');
  }
  res.render('owner/publish-step3', { draft: req.session.marketDraft, isEditing: !!req.session.marketDraft.editingMarketId });
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
    length: Number(area_length) || 100,
  };
  req.session.marketDraft.spots = parsed.spots || [];
  req.session.marketDraft.elements = parsed.elements || [];

  res.redirect('/owner/markets/new/step-4');
};

// STEP 4: Verify & Publish / Save Edits
exports.getPublishStep4 = (req, res) => {
  if (!req.session.marketDraft?.details?.name) {
    return res.redirect('/owner/markets/new/step-1');
  }
  res.render('owner/publish-step4', { draft: req.session.marketDraft, isEditing: !!req.session.marketDraft.editingMarketId });
};

exports.postPublishStep4 = async (req, res) => {
  try {
    const draft = req.session.marketDraft;
    if (!draft?.details?.name) return res.redirect('/owner/markets/new/step-1');

    draft.details.bank_name = req.body.bank_name || draft.details.bank_name;
    draft.details.bank_account_number =
      req.body.bank_account_number || draft.details.bank_account_number;
    if (req.file) {
      draft.details.qr_code_url = `/uploads/markets/${req.file.filename}`;
    }

    const ownerId = req.session.user.id;

    if (draft.editingMarketId) {
      const updatedId = await MarketModel.updateFullMarket(draft.editingMarketId, ownerId, draft);
      delete req.session.marketDraft;
      return req.session.save(() => res.redirect(`/owner/markets/${updatedId}/dashboard`));
    }

    const marketId = await MarketModel.createFullMarket({
      ownerId,
      details: draft.details,
      operatingDays: draft.operatingDays || [],
      area: draft.area || { width: 200, length: 100 },
      spots: draft.spots || [],
      elements: draft.elements || [],
    });

    delete req.session.marketDraft;
    return req.session.save(() => res.render('owner/publish-success', { marketId }));
  } catch (err) {
    console.error('postPublishStep4 error:', err);
    res.status(500).send('Error saving market.');
  }
};

exports.postPublishMarket = exports.postPublishStep4;

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

exports.postToggleMarketStatus = async (req, res) => {
  try {
    const marketId = Number(req.params.id);
    await MarketModel.toggleMarketOpen(marketId, req.session.user.id);
    const backTo = req.body.redirect_to || `/owner/markets/${marketId}/dashboard`;
    res.redirect(backTo);
  } catch (err) {
    console.error('postToggleMarketStatus error:', err);
    res.status(500).send('Error updating market status.');
  }
};

exports.postDeleteMarket = async (req, res) => {
  try {
    const marketId = Number(req.params.id);
    await MarketModel.deleteMarket(marketId, req.session.user.id);
    res.redirect('/owner/markets');
  } catch (err) {
    console.error('postDeleteMarket error:', err);
    res.status(500).send('Error deleting market.');
  }
};

exports.postPublishVerify = async (req, res) => {
  try {
    const draft = req.session.marketDraft;
    if (!draft || !draft.details) {
      return res.redirect('/owner/markets/new/step-1');
    }

    const ownerId = req.session.user.id;
    let marketId;

    if (draft.editingMarketId) {
      marketId = await MarketModel.updateFullMarket(draft.editingMarketId, ownerId, draft);
    } else {
      marketId = await MarketModel.createFullMarket({
        ownerId,
        details: draft.details,
        operatingDays: draft.operatingDays || [],
        area: draft.area || { width: 200, length: 100 },
        spots: draft.spots || [],
        elements: draft.elements || [],
      });
    }

    // Wipe the wizard draft so "Add a market" is completely empty next time
    delete req.session.marketDraft;

    req.session.save(() => {
      res.render('owner/publish-success', { marketId });
    });
  } catch (err) {
    console.error('postPublishVerify error:', err);
    res.status(500).send('Error publishing market.');
  }
};