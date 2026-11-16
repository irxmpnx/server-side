const bcrypt = require('bcrypt');
const UserModel = require('../models/userModel');

const SALT_ROUNDS = 12;

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
    if (password.length < 6) {
      return res.render('signup', { error: 'Password must be at least 6 characters long.', formData });
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
  res.render('signin', { error: null });
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