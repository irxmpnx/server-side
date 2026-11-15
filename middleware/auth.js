// Make user session available in all EJS templates
function attachUserToLocals(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
}

// Protect authenticated routes
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/signin');
  }
  next();
}

// Restrict routes by role ('owner_market' or 'tenant')
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      return res.status(403).send('Access denied: insufficient permissions.');
    }
    next();
  };
}

module.exports = { attachUserToLocals, requireAuth, requireRole };