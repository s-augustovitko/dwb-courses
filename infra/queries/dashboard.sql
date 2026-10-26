-- Dashboard queries skip DRAFT and CANCELLED orders; form_ids is comma-separated lowercase hex, NULL means every form.

-- name: DashboardEarnings :many
SELECT
    o.currency_code,
    CAST(SUM(t.total_amount_cents) AS INTEGER) AS total_amount_cents,
    CAST(SUM(t.amount_paid_cents) AS INTEGER) AS amount_paid_cents
FROM orders o
JOIN order_totals t ON t.order_id = o.id
JOIN submissions s ON s.id = o.submission_id
WHERE
    o.status NOT IN ('DRAFT', 'CANCELLED')
    AND (
        CAST(sqlc.narg('form_ids') AS TEXT) IS NULL
        OR instr(',' || sqlc.narg('form_ids') || ',', ',' || lower(hex(s.form_id)) || ',') > 0
    )
GROUP BY o.currency_code
ORDER BY o.currency_code;

-- name: DashboardSessionCounts :many
SELECT
    se.id AS session_id,
    se.name,
    f.title AS form_title,
    o.status,
    COUNT(*) AS people
FROM order_session_items osi
JOIN orders o ON o.id = osi.order_id
JOIN submissions s ON s.id = o.submission_id
JOIN sessions se ON se.id = osi.session_id
JOIN forms f ON f.id = se.form_id
WHERE
    o.status NOT IN ('DRAFT', 'CANCELLED')
    AND (
        CAST(sqlc.narg('form_ids') AS TEXT) IS NULL
        OR instr(',' || sqlc.narg('form_ids') || ',', ',' || lower(hex(s.form_id)) || ',') > 0
    )
GROUP BY se.id, o.status
ORDER BY se.session_date, se.sort_order, se.id;

-- name: DashboardMealCounts :many
SELECT
    m.id AS meal_id,
    m.name,
    f.title AS form_title,
    o.status,
    s.dietary_preference,
    COUNT(*) AS people
FROM order_meal_items omi
JOIN orders o ON o.id = omi.order_id
JOIN submissions s ON s.id = o.submission_id
JOIN meals m ON m.id = omi.meal_id
JOIN forms f ON f.id = m.form_id
WHERE
    o.status NOT IN ('DRAFT', 'CANCELLED')
    AND (
        CAST(sqlc.narg('form_ids') AS TEXT) IS NULL
        OR instr(',' || sqlc.narg('form_ids') || ',', ',' || lower(hex(s.form_id)) || ',') > 0
    )
GROUP BY m.id, o.status, s.dietary_preference
ORDER BY m.meal_date, m.sort_order, m.id;

-- name: DashboardPaymentTotals :many
SELECT
    o.currency_code,
    c.display_name AS currency_name,
    p.method,
    o.status,
    CAST(SUM(p.amount_cents) AS INTEGER) AS amount_cents
FROM payments p
JOIN orders o ON o.id = p.order_id
JOIN submissions s ON s.id = o.submission_id
JOIN currencies c ON c.code = o.currency_code
WHERE
    o.status NOT IN ('DRAFT', 'CANCELLED')
    AND (
        CAST(sqlc.narg('form_ids') AS TEXT) IS NULL
        OR instr(',' || sqlc.narg('form_ids') || ',', ',' || lower(hex(s.form_id)) || ',') > 0
    )
GROUP BY p.method, o.currency_code, o.status
ORDER BY c.sort_order, o.currency_code, p.method;

-- name: DashboardStatusCounts :many
SELECT
    o.status,
    COUNT(*) AS people
FROM orders o
JOIN submissions s ON s.id = o.submission_id
WHERE
    o.status NOT IN ('DRAFT', 'CANCELLED')
    AND (
        CAST(sqlc.narg('form_ids') AS TEXT) IS NULL
        OR instr(',' || sqlc.narg('form_ids') || ',', ',' || lower(hex(s.form_id)) || ',') > 0
    )
GROUP BY o.status;
