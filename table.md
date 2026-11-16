# Database Schema Documentation (`market_db`)

## 1. `users`
Stores user accounts and authentication credentials for both Market Owners and Tenants.

| Attribute | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique identifier for each user. |
| `first_name` | `VARCHAR(100)` | `NOT NULL` | User's first name. |
| `last_name` | `VARCHAR(100)` | `NOT NULL` | User's last name. |
| `phone_number` | `VARCHAR(15)` | `NOT NULL` | Contact phone number. |
| `gender` | `VARCHAR(20)` | `NOT NULL`, `CHECK` | Restricted to `'Male'`, `'Female'`, or `'Other'`. |
| `username` | `VARCHAR(50)` | `UNIQUE`, `NOT NULL` | Unique login handle. |
| `password_hash` | `TEXT` | `NOT NULL` | Hashed password for secure authentication. |
| `role` | `VARCHAR(20)` | `NOT NULL`, `CHECK` | Access role: `'owner_market'` or `'tenant'`. |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Account registration timestamp. |

---

## 2. `markets`
Stores core details, media galleries, floor plan dimensions, payment info, and operational status for each market listing.

| Attribute | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique identifier for each market. |
| `owner_id` | `INTEGER` | `NOT NULL`, `FK -> users(id)` | Owner who created the market (`ON DELETE CASCADE`). |
| `name` | `VARCHAR(150)` | `NOT NULL` | Public display name of the market. |
| `genre` | `VARCHAR(80)` | `NOT NULL` | Market category (e.g., Night Market, Flea Market, Food Market). |
| `location` | `TEXT` | `NOT NULL` | Street address or district location. |
| `phone_number` | `VARCHAR(20)` | `NOT NULL` | Market contact phone number. |
| `description` | `TEXT` | Nullable | Overview, highlights, or vendor rules. |
| `cover_image_url` | `TEXT` | `DEFAULT '/images/default-market.jpg'` | Path to the primary cover photo shown on cards. |
| `image_urls` | `TEXT[]` | `DEFAULT ARRAY['/images/default-market.jpg']` | Array of all uploaded gallery image paths. |
| `main_image_index` | `INTEGER` | `DEFAULT 0` | Index pointing to the main cover photo in `image_urls`. |
| `area_width` | `NUMERIC(8, 2)` | `DEFAULT 200` | Total width of the market floor plan in meters. |
| `area_length` | `NUMERIC(8, 2)` | `DEFAULT 100` | Total length of the market floor plan in meters. |
| `bank_name` | `VARCHAR(100)` | Nullable | Bank or PromptPay provider for receiving rent payments. |
| `bank_account_number` | `VARCHAR(30)` | Nullable | Bank account or PromptPay number. |
| `qr_code_url` | `TEXT` | Nullable | Path to the uploaded payment QR code image. |
| `is_open` | `BOOLEAN` | `DEFAULT TRUE` | Owner toggle indicating whether the market is open (`TRUE`) or closed (`FALSE`). |
| `is_verified` | `BOOLEAN` | `DEFAULT FALSE` | Indicates whether the market is published/verified for public viewing. |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Timestamp when the market was created. |

---

## 3. `market_operating_days`
Defines which days of the week a market operates and its opening/closing hours (one row per active day per market).

| Attribute | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique record identifier. |
| `market_id` | `INTEGER` | `NOT NULL`, `FK -> markets(id)` | Associated market (`ON DELETE CASCADE`). |
| `day_of_week` | `SMALLINT` | `NOT NULL`, `CHECK (0..6)`, `UNIQUE(market_id, day_of_week)` | Day index from `0` (Sunday) to `6` (Saturday). |
| `open_time` | `TIME` | `NOT NULL` | Daily opening time. |
| `close_time` | `TIME` | `NOT NULL` | Daily closing time. |

---

## 4. `market_spots`
Represents individual rentable booths or stalls placed on a market's floor plan.

| Attribute | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique identifier for each booth/spot. |
| `market_id` | `INTEGER` | `NOT NULL`, `FK -> markets(id)` | Associated market (`ON DELETE CASCADE`). |
| `spot_name` | `VARCHAR(30)` | `NOT NULL`, `UNIQUE(market_id, spot_name)` | Booth code/label (e.g., `A01`, `B02`). |
| `width` | `NUMERIC(6, 2)` | `NOT NULL` | Booth width in meters. |
| `length` | `NUMERIC(6, 2)` | `NOT NULL` | Booth length in meters. |
| `price_per_day` | `NUMERIC(10, 2)` | `NOT NULL` | Daily rental rate in THB. |
| `pos_x` | `NUMERIC(8, 2)` | `DEFAULT 0` | Horizontal X-coordinate (in pixels) on the map canvas. |
| `pos_y` | `NUMERIC(8, 2)` | `DEFAULT 0` | Vertical Y-coordinate (in pixels) on the map canvas. |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Soft-delete flag (`FALSE` hides removed spots without breaking historical rentals). |

---

## 5. `market_map_elements`
Stores non-rentable landmarks placed on the market map (entrances, toilets, facilities) for spatial orientation.

| Attribute | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique element identifier. |
| `market_id` | `INTEGER` | `NOT NULL`, `FK -> markets(id)` | Associated market (`ON DELETE CASCADE`). |
| `element_type` | `VARCHAR(30)` | `NOT NULL` | Category of landmark (e.g., `'entry'`, `'toilet'`, `'facility'`). |
| `label` | `VARCHAR(50)` | Nullable | Text displayed inside the marker on the map. |
| `pos_x` | `NUMERIC(8, 2)` | `DEFAULT 0` | Horizontal X-coordinate on the map canvas. |
| `pos_y` | `NUMERIC(8, 2)` | `DEFAULT 0` | Vertical Y-coordinate on the map canvas. |
| `width` | `NUMERIC(6, 2)` | `DEFAULT 2` | Element width in meters. |
| `length` | `NUMERIC(6, 2)` | `DEFAULT 2` | Element length in meters. |

---

## 6. `rentals`
Tracks tenant booth bookings, payment status, slip uploads, and owner approval workflow.

| Attribute | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique booking identifier. |
| `rental_code` | `VARCHAR(20)` | `UNIQUE`, `NOT NULL` | Human-readable unique booking reference code. |
| `tenant_id` | `INTEGER` | `NOT NULL`, `FK -> users(id)` | Tenant making the booking (`ON DELETE CASCADE`). |
| `market_id` | `INTEGER` | `NOT NULL`, `FK -> markets(id)` | Booked market (`ON DELETE CASCADE`). |
| `spot_id` | `INTEGER` | `NOT NULL`, `FK -> market_spots(id)` | Booked spot (`ON DELETE RESTRICT` to protect active booking history). |
| `shop_name` | `VARCHAR(150)` | Nullable | Tenant's shop name displayed on the map legend and owner dashboard. |
| `total_price` | `NUMERIC(10, 2)` | `NOT NULL` | Total rental fee (`price_per_day` × number of booked dates). |
| `payment_status` | `VARCHAR(20)` | `DEFAULT 'unpaid'`, `CHECK` | Tracks payment state: `'unpaid'`, `'paid'`, or `'cancelled'`. |
| `slip_image_url` | `TEXT` | Nullable | Path to the uploaded transfer receipt/slip image. |
| `payment_deadline` | `TIMESTAMP` | Nullable | Expiration cutoff for completing payment after booking. |
| `paid_at` | `TIMESTAMP` | Nullable | Timestamp when the payment slip was submitted. |
| `approval_status` | `VARCHAR(20)` | `DEFAULT 'waiting'`, `CHECK` | Owner review state: `'waiting'`, `'approved'`, or `'denied'`. |
| `checked_in_at` | `TIMESTAMP` | Nullable | Timestamp when the vendor checked in on-site. |
| `cancelled_at` | `TIMESTAMP` | Nullable | Timestamp if the booking was cancelled. |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Timestamp when the rental was initiated. |

---

## 7. `rental_dates`
Maps each booking in `rentals` to one or more specific calendar dates, preventing double-bookings on the same spot and date.

| Attribute | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique date-slot identifier. |
| `rental_id` | `INTEGER` | `NOT NULL`, `FK -> rentals(id)` | Parent booking (`ON DELETE CASCADE`). |
| `spot_id` | `INTEGER` | `NOT NULL`, `FK -> market_spots(id)` | Booked booth (`ON DELETE CASCADE`). |
| `rental_date` | `DATE` | `NOT NULL` | Specific calendar date booked for the booth. |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Holds the date lock when `TRUE` (enforced by partial unique index `unique_active_spot_date` on `(spot_id, rental_date)`). |

---

## 8. `shops`
Stores saved shop names belonging to a tenant (`seller_id`) for reuse across bookings.

| Attribute | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | `PRIMARY KEY` | Unique shop record identifier. |
| `seller_id` | `INTEGER` | `NOT NULL`, `FK -> users(id)` | Tenant/vendor who owns the shop (`ON DELETE CASCADE`, indexed via `idx_shops_seller_id`). |
| `shop_name` | `VARCHAR(150)` | `NOT NULL` | Saved vendor shop name. |

---

## 9. `session`
Internal persistence table used by `connect-pg-simple` to store active Express login sessions and wizard drafts across server restarts.

| Attribute | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `sid` | `VARCHAR` | `PRIMARY KEY` | Unique session cookie ID. |
| `sess` | `JSON` | `NOT NULL` | Serialized session payload (`user`, `marketDraft`, `rent`, etc.). |
| `expire` | `TIMESTAMP(6)` | `NOT NULL` | Session expiration timestamp (indexed via `IDX_session_expire` for automatic cleanup). |