
CREATE DATABASE market_db;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(10) NOT NULL,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner_market', 'tenant')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session table used by connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
) WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- 1. USERS (Accounts for both Market Owners & Tenants)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(15) NOT NULL,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner_market', 'tenant')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. MARKETS (PUBLISH-STEP-1 through 4 & OWNER-DASHBOARD)
CREATE TABLE IF NOT EXISTS markets (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  genre VARCHAR(80) NOT NULL,
  location TEXT NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  description TEXT,
  cover_image_url TEXT DEFAULT '/images/default-market.jpg',
  image_urls TEXT[] DEFAULT ARRAY['/images/default-market.jpg'],
  main_image_index INTEGER DEFAULT 0,
  area_width NUMERIC(8, 2) DEFAULT 200,
  area_length NUMERIC(8, 2) DEFAULT 100,
  bank_name VARCHAR(100),
  bank_account_number VARCHAR(30),
  qr_code_url TEXT,
  is_open BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. MARKET OPERATING DAYS (PUBLISH-STEP-2)
CREATE TABLE IF NOT EXISTS market_operating_days (
  id SERIAL PRIMARY KEY,
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon ... 6=Sat
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  UNIQUE (market_id, day_of_week)
);

-- 4. MARKET SPOTS / STALLS (PUBLISH-STEP-3 & RENT-STEP-2)
CREATE TABLE IF NOT EXISTS market_spots (
  id SERIAL PRIMARY KEY,
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  spot_name VARCHAR(30) NOT NULL,
  width NUMERIC(6, 2) NOT NULL,
  length NUMERIC(6, 2) NOT NULL,
  price_per_day NUMERIC(10, 2) NOT NULL,
  pos_x NUMERIC(8, 2) DEFAULT 0,
  pos_y NUMERIC(8, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE (market_id, spot_name)
);

-- 5. MARKET MAP ELEMENTS (PUBLISH-STEP-3: Entries, Toilets, Facilities)
CREATE TABLE IF NOT EXISTS market_map_elements (
  id SERIAL PRIMARY KEY,
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  element_type VARCHAR(30) NOT NULL, -- 'entry', 'toilet', 'facility'
  label VARCHAR(50),
  pos_x NUMERIC(8, 2) DEFAULT 0,
  pos_y NUMERIC(8, 2) DEFAULT 0,
  width NUMERIC(6, 2) DEFAULT 2,
  length NUMERIC(6, 2) DEFAULT 2
);

-- 6. RENTALS / BOOKINGS (HOME-MY-RENTAL, RENT-STEP-4, OWNER-DASHBOARD)
CREATE TABLE IF NOT EXISTS rentals (
  id SERIAL PRIMARY KEY,
  rental_code VARCHAR(20) UNIQUE NOT NULL,
  tenant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  spot_id INTEGER NOT NULL REFERENCES market_spots(id) ON DELETE RESTRICT,
  total_price NUMERIC(10, 2) NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'cancelled')),
  slip_image_url TEXT,
  payment_deadline TIMESTAMP,
  paid_at TIMESTAMP,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CHECK (approval_status IN ('waiting', 'approved', 'denied')),
  checked_in_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. RENTAL DATES (Supports multi-day selection)
CREATE TABLE IF NOT EXISTS rental_dates (
  id SERIAL PRIMARY KEY,
  rental_id INTEGER NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  spot_id INTEGER NOT NULL REFERENCES market_spots(id) ON DELETE CASCADE,
  rental_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_spot_date
  ON rental_dates (spot_id, rental_date)
  WHERE is_active = TRUE;

-- 8. EXPRESS SESSION STORE
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
) WITH (OIDS=FALSE);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey'
  ) THEN
    ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");