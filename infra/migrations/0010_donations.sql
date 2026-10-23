-- +goose Up
CREATE TABLE order_donation_items (
    id BLOB PRIMARY KEY,
    order_id BLOB NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,

    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),

    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Money totals per order: items + donation - discounts, and the net received (REFUND rows subtract).
CREATE VIEW order_totals AS
SELECT
    o.id AS order_id,
    CAST(
        COALESCE((SELECT SUM(unit_price_cents) FROM order_session_items WHERE order_id = o.id), 0)
        + COALESCE((SELECT SUM(unit_price_cents) FROM order_meal_items WHERE order_id = o.id), 0)
        + COALESCE((SELECT amount_cents FROM order_donation_items WHERE order_id = o.id), 0)
        - COALESCE((SELECT SUM(amount_cents) FROM order_discount_items WHERE order_id = o.id), 0)
        AS INTEGER
    ) AS total_amount_cents,
    CAST(
        COALESCE(
            (
                SELECT SUM(CASE WHEN method = 'REFUND' THEN -amount_cents ELSE amount_cents END)
                FROM payments
                WHERE order_id = o.id
            ),
            0
        ) AS INTEGER
    ) AS amount_paid_cents
FROM orders o;

-- +goose Down
DROP VIEW IF EXISTS order_totals;
DROP TABLE IF EXISTS order_donation_items;
