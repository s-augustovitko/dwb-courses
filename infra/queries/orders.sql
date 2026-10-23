-- name: CreateOrder :one
INSERT INTO orders (
    id,
    submission_id,
    currency_code
) VALUES (
    ?, ?, ?
)
RETURNING *;

-- name: GetOrderById :one
SELECT
    o.*,
    t.total_amount_cents,
    t.amount_paid_cents
FROM orders o
JOIN order_totals t ON t.order_id = o.id
WHERE o.id = ?
LIMIT 1;

-- name: SetOrderStatus :exec
UPDATE orders
SET
    status = ?,
    updated_at = unixepoch()
WHERE id = ?;

-- name: DeleteOrder :exec
DELETE FROM orders
WHERE id = ?;

-- name: CreateOrderSessionItem :one
INSERT INTO order_session_items (
    id,
    order_id,
    session_id,
    name_snapshot,
    unit_price_cents
) VALUES (
    ?, ?, ?, ?, ?
)
RETURNING *;

-- name: CreateOrderSessionItemsFromSubmission :many
-- Snapshots the submission's sessions in the order currency; ids generated in SQL for this bulk insert.
INSERT INTO order_session_items (
    id,
    order_id,
    session_id,
    name_snapshot,
    unit_price_cents
)
SELECT
    randomblob(16),
    ?,
    ss.session_id,
    s.name,
    sp.amount_cents
FROM submission_sessions ss
JOIN sessions s ON s.id = ss.session_id
JOIN session_prices sp ON sp.session_id = s.id AND sp.currency_code = ?
WHERE ss.submission_id = ?
RETURNING *;

-- name: ListOrderSessionItems :many
SELECT osi.*
FROM order_session_items osi
LEFT JOIN sessions s ON s.id = osi.session_id
WHERE osi.order_id = ?
ORDER BY s.sort_order, s.session_date, osi.created_at, osi.id;

-- name: UpdateOrderSessionItem :one
UPDATE order_session_items
SET
    name_snapshot = ?,
    unit_price_cents = ?
WHERE id = ?
RETURNING *;

-- name: DeleteOrderSessionItem :exec
DELETE FROM order_session_items
WHERE id = ?;

-- name: CreateOrderMealItem :one
INSERT INTO order_meal_items (
    id,
    order_id,
    meal_id,
    name_snapshot,
    unit_price_cents
) VALUES (
    ?, ?, ?, ?, ?
)
RETURNING *;

-- name: CreateOrderMealItemsFromSubmission :many
-- Snapshots the submission's meals in the order currency; ids generated in SQL for this bulk insert.
INSERT INTO order_meal_items (
    id,
    order_id,
    meal_id,
    name_snapshot,
    unit_price_cents
)
SELECT
    randomblob(16),
    ?,
    sm.meal_id,
    m.name,
    mp.amount_cents
FROM submission_meals sm
JOIN meals m ON m.id = sm.meal_id
JOIN meal_prices mp ON mp.meal_id = m.id AND mp.currency_code = ?
WHERE sm.submission_id = ?
RETURNING *;

-- name: ListOrderMealItems :many
SELECT omi.*
FROM order_meal_items omi
LEFT JOIN meals m ON m.id = omi.meal_id
WHERE omi.order_id = ?
ORDER BY m.sort_order, m.meal_date, omi.created_at, omi.id;

-- name: UpdateOrderMealItem :one
UPDATE order_meal_items
SET
    name_snapshot = ?,
    unit_price_cents = ?
WHERE id = ?
RETURNING *;

-- name: DeleteOrderMealItem :exec
DELETE FROM order_meal_items
WHERE id = ?;

-- name: CreateOrderDiscountItem :one
INSERT INTO order_discount_items (
    id,
    order_id,
    discount_id,
    name_snapshot,
    amount_cents
) VALUES (
    ?, ?, ?, ?, ?
)
RETURNING *;

-- name: UpdateOrderDiscountItem :one
UPDATE order_discount_items
SET
    name_snapshot = ?,
    amount_cents = ?
WHERE id = ?
RETURNING *;

-- name: DeleteOrderDiscountItem :exec
DELETE FROM order_discount_items
WHERE id = ?;

-- name: CreateOrderDonationItem :one
INSERT INTO order_donation_items (
    id,
    order_id,
    amount_cents
) VALUES (
    ?, ?, ?
)
RETURNING *;

-- name: GetOrderDonationItem :one
SELECT *
FROM order_donation_items
WHERE order_id = ?
LIMIT 1;

