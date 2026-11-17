const bcrypt = require('bcrypt');
const UserModel = require('../models/userModel');

const { validatePassword } = require('../utils/passwordRules');
const SALT_ROUNDS = 12;

// Simple brute-force guard for the reset form: 5 failed tries per IP + username every 15 minutes
const RESET_MAX_ATTEMPTS = 5;
const RESET_LOCK_MS = 15 * 60 * 1000;
const resetAttempts = new Map();

function resetKey(req, username) {
  return `${req.ip}|${String(username || '').toLowerCase()}`;
}

function isResetLocked(key) {
  const entry = resetAttempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    resetAttempts.delete(key);
    return false;
  }
  return entry.count >= RESET_MAX_ATTEMPTS;
}

function recordResetFailure(key) {
  const entry = resetAttempts.get(key);
  const now = Date.now();
  if (!entry || now > entry.until) {
    resetAttempts.set(key, { count: 1, until: now + RESET_LOCK_MS });
  } else {
    entry.count += 1;
  }
}

exports.getSignUp = (req, res) => {
  if (req.session.user) return res.redirect('/markets');
  res.render('signup', { error: null, formData: {} });
};

exports.postSignUp = async (req, res) => {
  const {
    first_name,
    last_name,
    phone_number,
    gender,
    username,
    password,
    confirm_password,
    role
  } = req.body;

  const formData = { first_name, last_name, phone_number, gender, username, role };

  try {
    // Validation matching UI constraints
    if (!first_name || !last_name || !phone_number || !gender || !username || !password || !role) {
      return res.render('signup', { error: 'All fields marked with * are required.', formData });
    }
    if (!/^\d{10}$/.test(phone_number)) {
      return res.render('signup', { error: 'Phone number must be exactly 10 digits.', formData });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.render('signup', { error: passwordError, formData });
    }
    if (password !== confirm_password) {
      return res.render('signup', { error: 'Passwords do not match.', formData });
    }

    const existingUser = await UserModel.findByUsername(username.trim());
    if (existingUser) {
      return res.render('signup', { error: 'Username is already taken.', formData });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await UserModel.createUser({
      firstName: first_name.trim(),
      lastName: last_name.trim(),
      phoneNumber: phone_number.trim(),
      gender,
      username: username.trim(),
      passwordHash,
      role
    });

    // Regenerate session ID to prevent session fixation
    req.session.regenerate((err) => {
      if (err) throw err;
      req.session.user = {
        id: newUser.id,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        username: newUser.username,
        role: newUser.role
      };
      const target = newUser.role === 'owner_market' ? '/owner/markets' : '/markets';
      req.session.save(() => res.redirect(target));;
    });
  } catch (err) {
    console.error('SignUp error:', err);
    res.render('signup', { error: 'Something went wrong creating your account.', formData });
  }
};

exports.getSignIn = (req, res) => {
  if (req.session.user) return res.redirect('/markets');
  const success = req.query.reset === 'success'
    ? 'Your password has been reset. Please sign in with your new password.'
    : null;
  res.render('signin', { error: null, success });
};

// ---------- Forgot password ----------
exports.getForgotPassword = (req, res) => {
  if (req.session.user) return res.redirect('/markets');
  res.render('forgot-password', { error: null, formData: {} });
};

exports.postForgotPassword = async (req, res) => {
  const { username, phone_number, password, confirm_password } = req.body;
  const formData = { username, phone_number };

  try {
    if (!username || !phone_number || !password || !confirm_password) {
      return res.render('forgot-password', { error: 'Please fill in all fields.', formData });
    }
    if (!/^\d{10}$/.test(phone_number.trim())) {
      return res.render('forgot-password', { error: 'Phone number must be exactly 10 digits.', formData });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.render('forgot-password', { error: passwordError, formData });
    }
    if (password !== confirm_password) {
      return res.render('forgot-password', { error: 'Passwords do not match.', formData });
    }

    const key = resetKey(req, username.trim());
    if (isResetLocked(key)) {
      return res.render('forgot-password', {
        error: 'Too many attempts. Please try again in 15 minutes.',
        formData,
      });
    }

    const user = await UserModel.findByUsernameAndPhone(username.trim(), phone_number.trim());
    if (!user) {
      recordResetFailure(key);
      // Same message whether the username or the phone number is wrong
      return res.render('forgot-password', {
        error: 'Username and phone number do not match our records.',
        formData,
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await UserModel.updatePassword(user.id, passwordHash);
    resetAttempts.delete(key);

    res.redirect('/signin?reset=success');
  } catch (err) {
    console.error('ForgotPassword error:', err);
    res.render('forgot-password', { error: 'Unable to reset your password right now. Please try again.', formData });
  }
};

exports.postSignIn = async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.render('signin', { error: 'Please enter both username and password.' });
    }

    const user = await UserModel.findByUsername(username.trim());
    if (!user) {
      return res.render('signin', { error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.render('signin', { error: 'Invalid username or password.' });
    }

    // Regenerate session ID upon authentication
    req.session.regenerate((err) => {
      if (err) throw err;
      req.session.user = {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        role: user.role
      };
      const target = user.role === 'owner_market' ? '/owner/markets' : '/markets';
      req.session.save(() => res.redirect(target));
    });
  } catch (err) {
    console.error('SignIn error:', err);
    res.render('signin', { error: 'Unable to sign in right now. Please try again.' });
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.clearCookie('market.sid');
    res.redirect('/signin');
  });
};