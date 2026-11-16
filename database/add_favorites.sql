-- Run this migration once in the vendoo PostgreSQL database.
CREATE TABLE IF NOT EXISTS user_favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, market_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id
  ON user_favorites(user_id);
