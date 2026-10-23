-- +goose Up
CREATE TABLE orders (
    id BLOB PRIMARY KEY,
    submission_id BLOB NOT NULL UNIQUE REFERENCES submissions(id),
    currency_code TEXT NOT NULL REFERENCES currencies(code),

    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status = upper(status)), -- CHECK IN ('DRAFT', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED')

    access_token_hash TEXT UNIQUE, -- sha256 hex of the public bearer token; NULL for admin-created orders
    draft_email_sent_at INTEGER,
    reminder_count INTEGER NOT NULL DEFAULT 0 CHECK (reminder_count >= 0),
    last_reminder_at INTEGER,
    email_failures INTEGER NOT NULL DEFAULT 0 CHECK (email_failures >= 0), -- failed job sends in a row
    payment_pending_at INTEGER, -- set while an online payment has an unknown outcome; blocks a second charge

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE order_session_items (
    id BLOB PRIMARY KEY,
    order_id BLOB NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    session_id BLOB NOT NULL REFERENCES sessions(id) ON DELETE RESTRICT,

    name_snapshot TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),

    UNIQUE (order_id, session_id)
);

CREATE INDEX idx_order_session_items_session_id ON order_session_items(session_id);

CREATE TABLE order_meal_items (
    id BLOB PRIMARY KEY,
    order_id BLOB NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    meal_id BLOB NOT NULL REFERENCES meals(id) ON DELETE RESTRICT,

    name_snapshot TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),

    UNIQUE (order_id, meal_id)
);

CREATE INDEX idx_order_meal_items_meal_id ON order_meal_items(meal_id);

CREATE TABLE order_discount_items (
    id BLOB PRIMARY KEY,
    order_id BLOB NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    discount_id BLOB NOT NULL REFERENCES discounts(id) ON DELETE RESTRICT,

    name_snapshot TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0), -- positive; subtracted in order_totals

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),

    UNIQUE (order_id, discount_id)
);

CREATE INDEX idx_order_discount_items_discount_id ON order_discount_items(discount_id);

-- +goose Down
DROP INDEX IF EXISTS idx_order_discount_items_discount_id;
DROP TABLE IF EXISTS order_discount_items;
DROP INDEX IF EXISTS idx_order_meal_items_meal_id;
DROP TABLE IF EXISTS order_meal_items;
DROP INDEX IF EXISTS idx_order_session_items_session_id;
DROP TABLE IF EXISTS order_session_items;
DROP INDEX IF EXISTS idx_orders_status;
DROP TABLE IF EXISTS orders;
