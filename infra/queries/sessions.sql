-- name: CreateSession :one
INSERT INTO sessions (
    id,
    form_id,
    name,
    hint_text,
    sort_order,
    session_date
) VALUES (
    ?, ?, ?, ?, ?, ?
)
RETURNING *;

-- name: ListActiveSessionsByForm :many
SELECT *
FROM sessions
WHERE
    form_id = ?
    AND is_active = TRUE
ORDER BY sort_order, session_date;

-- name: GetSessionById :one
SELECT *
FROM sessions
WHERE id = ?
LIMIT 1;

-- name: UpdateSession :execrows
UPDATE sessions
SET
    name = ?,
    hint_text = ?,
    session_date = ?,
    updated_at = unixepoch()
WHERE
    id = ?
    AND form_id = ?;

-- name: SetSessionActive :execrows
UPDATE sessions
SET
    is_active = ?,
    sort_order = ?,
    updated_at = unixepoch()
WHERE
    id = ?
    AND form_id = ?;

-- name: InsertSessionPrice :exec
INSERT INTO session_prices (
    session_id,
    currency_code,
    amount_cents
) VALUES (
    ?, ?, ?
);

-- name: ListSessionPrices :many
SELECT
    session_id,
    currency_code,
    amount_cents
FROM session_prices
WHERE session_id = ?;

-- name: GetSessionPrice :one
SELECT
    session_id,
    currency_code,
    amount_cents
FROM session_prices
WHERE
    session_id = ?
    AND currency_code = ?
LIMIT 1;

-- name: DeleteSessionPrices :exec
DELETE FROM session_prices
WHERE session_id = ?;

-- name: ListSessionsByForm :many
-- Admin-facing: all sessions for a form, filtered by active state.
SELECT *
FROM sessions
WHERE
    form_id = ?
    AND is_active = ?
ORDER BY sort_order, session_date;

-- name: GetNextSessionSortOrder :one
SELECT COALESCE(MAX(sort_order), 0) + 1
FROM sessions
WHERE
    form_id = ?
    AND is_active = ?;

-- name: SetSessionOrder :execrows
UPDATE sessions
SET
    sort_order = ?,
    updated_at = unixepoch()
WHERE
    id = ?
    AND form_id = ?
    AND is_active = TRUE;

-- name: ListSessionPricesByForm :many
SELECT
    sp.session_id,
    sp.currency_code,
    sp.amount_cents
FROM session_prices sp
JOIN sessions s ON s.id = sp.session_id
WHERE
    s.form_id = ?
    AND s.is_active = ?;
