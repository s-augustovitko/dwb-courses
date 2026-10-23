-- name: CreateForm :one
INSERT INTO forms (
    id,
    title,
    description,
    is_enabled,
    show_arrival_and_departure,
    show_insurance,
    show_emergency_contact,
    disable_session_selection,
    disable_meal_selection,
    disable_donation
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
RETURNING *;

-- name: GetFormById :one
SELECT *
FROM forms
WHERE id = ?
LIMIT 1;

-- name: GetVisibleFormById :one
-- Public-facing: 404s at the query level if the form has been disabled.
SELECT *
FROM forms
WHERE
    id = ?
    AND is_enabled = TRUE
LIMIT 1;

-- name: ListForms :many
SELECT
    f.id,
    f.title,
    f.is_enabled,
    (
        SELECT COUNT(*)
        FROM sessions s
        WHERE s.form_id = f.id
    ) AS session_count,
    (
        SELECT COUNT(*)
        FROM meals m
        WHERE m.form_id = f.id
    ) AS meal_count,
    (
        SELECT COUNT(*)
        FROM form_currencies fc
        WHERE fc.form_id = f.id
    ) AS currencies_count,
    CAST(COALESCE((
        SELECT c.display_name
        FROM form_currencies fc
        JOIN currencies c ON c.code = fc.currency_code
        WHERE fc.form_id = f.id
        ORDER BY c.sort_order, c.display_name
        LIMIT 1
    ), '') AS TEXT) AS main_currency,
    f.updated_at
FROM forms f
WHERE f.is_enabled = ?
ORDER BY f.created_at DESC;

-- name: UpdateForm :execrows
UPDATE forms
SET
    title = ?,
    description = ?,
    show_arrival_and_departure = ?,
    show_insurance = ?,
    show_emergency_contact = ?,
    disable_session_selection = ?,
    disable_meal_selection = ?,
    disable_donation = ?,
    updated_at = unixepoch()
WHERE id = ?;

-- name: SetFormEnabled :execrows
UPDATE forms
SET
    is_enabled = ?,
    updated_at = unixepoch()
WHERE id = ?;

-- name: AddFormCurrency :exec
INSERT INTO form_currencies (
    form_id,
    currency_code
) VALUES (
    ?, ?
)
ON CONFLICT DO NOTHING;

-- name: RemoveFormCurrency :exec
DELETE FROM form_currencies
WHERE
    form_id = ?
    AND currency_code = ?;

-- name: RemoveFormCurrenciesByCurrencyCode :exec
DELETE FROM form_currencies
WHERE currency_code = ?;

-- name: ListFormCurrencies :many
SELECT
    fc.form_id,
    fc.currency_code,
    c.display_name
FROM form_currencies fc
JOIN currencies c ON c.code = fc.currency_code
WHERE fc.form_id = ?
ORDER BY c.sort_order, c.display_name;

-- name: ListEnabledFormTitles :many
SELECT
    id,
    title
FROM forms
WHERE is_enabled = TRUE
ORDER BY created_at DESC;

-- name: ListActiveFormCurrencies :many
SELECT
    c.code,
    c.display_name,
    c.is_default
FROM form_currencies fc
JOIN currencies c ON c.code = fc.currency_code
WHERE
    fc.form_id = ?
    AND c.is_active = TRUE
ORDER BY c.sort_order, c.display_name;
