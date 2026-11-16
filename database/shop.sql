CREATE TABLE IF NOT EXISTS shops (
  id SERIAL PRIMARY KEY,
  seller_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_name VARCHAR(150) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shops_seller_id ON shops (seller_id);