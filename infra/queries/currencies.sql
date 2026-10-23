-- name: UpsertCurrency :one
INSERT INTO currencies (
    code,
    display_name,
    sort_order
) VALUES (
    ?, ?, ?
)
ON CONFLICT (code)
DO UPDATE SET
    display_name = excluded.display_name,
    updated_at = unixepoch()
RETURNING *;

-- name: ListCurrencies :many
SELECT *
FROM currencies
WHERE is_active = ?
ORDER BY sort_order, display_name;

-- name: GetActiveCurrencyByCode :one
SELECT *
FROM currencies
WHERE
    code = ?
    AND is_active = TRUE
LIMIT 1;

-- name: SetCurrencyOrder :execrows
UPDATE currencies
SET
    sort_order = ?,
    updated_at = unixepoch()
WHERE
    code = ?
    AND is_active = TRUE;

-- name: SetCurrencyActive :exec
UPDATE currencies
SET
    is_active = ?,
    sort_order = ?,
    updated_at = unixepoch()
WHERE code = ?;

-- name: GetNextCurrencySortOrder :one
SELECT COALESCE(MAX(sort_order), 0) + 1
FROM currencies
WHERE is_active = ?;

-- name: GetCurrencyByCode :one
SELECT *
FROM currencies
WHERE code = ?
LIMIT 1;

-- name: ClearDefaultCurrency :exec
UPDATE currencies
SET
    is_default = FALSE,
    updated_at = unixepoch()
WHERE is_default = TRUE;

-- name: SetDefaultCurrency :exec
UPDATE currencies
SET
    is_default = TRUE,
    updated_at = unixepoch()
WHERE
    code = ?
    AND is_active = TRUE;
