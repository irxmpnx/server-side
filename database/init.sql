-- 1. USERS
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

-- 2. MARKETS
CREATE TABLE IF NOT EXISTS markets (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  genre VARCHAR(80) NOT NULL,
  location TEXT NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  description TEXT,
  cover_image_url TEXT DEFAULT '/images/no_Image.svg',
  image_urls TEXT[] DEFAULT ARRAY['/images/no_Image.svg'],
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

-- 3. MARKET OPERATING DAYS
CREATE TABLE IF NOT EXISTS market_operating_days (
  id SERIAL PRIMARY KEY,
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  UNIQUE (market_id, day_of_week)
);

-- 4. MARKET SPOTS / STALLS
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

-- 5. MARKET MAP ELEMENTS
CREATE TABLE IF NOT EXISTS market_map_elements (
  id SERIAL PRIMARY KEY,
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  element_type VARCHAR(30) NOT NULL,
  label VARCHAR(50),
  pos_x NUMERIC(8, 2) DEFAULT 0,
  pos_y NUMERIC(8, 2) DEFAULT 0,
  width NUMERIC(6, 2) DEFAULT 2,
  length NUMERIC(6, 2) DEFAULT 2
);

-- 6. RENTALS / BOOKINGS
CREATE TABLE IF NOT EXISTS rentals (
  id SERIAL PRIMARY KEY,
  rental_code VARCHAR(20) UNIQUE NOT NULL,
  tenant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  spot_id INTEGER NOT NULL REFERENCES market_spots(id) ON DELETE RESTRICT,
  shop_name VARCHAR(150),
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

ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS shop_name VARCHAR(150);

-- 7. RENTAL DATES
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

-- 8. TENANT SHOPS
CREATE TABLE IF NOT EXISTS shops (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_name VARCHAR(150) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shops_seller_id ON shops (seller_id);

-- 9. USER FAVORITES
CREATE TABLE IF NOT EXISTS user_favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, market_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id
  ON user_favorites(user_id);


-- 10. EXPRESS SESSION STORE
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
