const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
require('dotenv').config();

const pool = require('./config/db');
const { attachUserToLocals } = require('./middleware/auth');
const pageRoutes = require('./routes/pageRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files & body parsers
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Trust proxy if deployed behind Nginx/Render/Heroku
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Hardened PostgreSQL-backed Session Cookie
app.use(
  session({
    store: new pgSession({
      pool: pool,
      tableName: 'session',
    }),
    name: 'market.sid', // Custom cookie name (hides default connect.sid)
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // Prevents XSS access via document.cookie
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // Protects against CSRF
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

app.use(attachUserToLocals);

// Routes
app.use('/', pageRoutes);
app.use('/', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});