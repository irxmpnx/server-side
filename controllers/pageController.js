exports.getHome = (req, res) => {
  res.render('hero', { user: req.session.user });
};

exports.getWelcome = (req, res) => {
  res.render('welcome', { user: req.session.user });
};