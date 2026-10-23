-- name: CreateMeal :one
INSERT INTO meals (
    id,
    form_id,
    name,
    hint_text,
    sort_order,
    meal_date
) VALUES (
    ?, ?, ?, ?, ?, ?
)
RETURNING *;

-- name: ListActiveMealsByForm :many
SELECT *
FROM meals
WHERE
    form_id = ?
    AND is_active = TRUE
ORDER BY sort_order, meal_date;

-- name: GetMealById :one
SELECT *
FROM meals
WHERE id = ?
LIMIT 1;

-- name: UpdateMeal :execrows
UPDATE meals
SET
    name = ?,
    hint_text = ?,
    meal_date = ?,
    updated_at = unixepoch()
WHERE
    id = ?
    AND form_id = ?;

-- name: SetMealActive :execrows
UPDATE meals
SET
    is_active = ?,
    sort_order = ?,
    updated_at = unixepoch()
WHERE
    id = ?
    AND form_id = ?;

-- name: InsertMealPrice :exec
INSERT INTO meal_prices (
    meal_id,
    currency_code,
    amount_cents
) VALUES (
    ?, ?, ?
);

-- name: ListMealPrices :many
SELECT
    meal_id,
    currency_code,
    amount_cents
FROM meal_prices
WHERE meal_id = ?;

-- name: GetMealPrice :one
SELECT
    meal_id,
    currency_code,
    amount_cents
FROM meal_prices
WHERE
    meal_id = ?
    AND currency_code = ?
LIMIT 1;

-- name: DeleteMealPrices :exec
DELETE FROM meal_prices
WHERE meal_id = ?;

-- name: ListMealsByForm :many
-- Admin-facing: all meals for a form, filtered by active state.
SELECT *
FROM meals
WHERE
    form_id = ?
    AND is_active = ?
ORDER BY sort_order, meal_date;

-- name: GetNextMealSortOrder :one
SELECT COALESCE(MAX(sort_order), 0) + 1
FROM meals
WHERE
    form_id = ?
    AND is_active = ?;

-- name: SetMealOrder :execrows
UPDATE meals
SET
    sort_order = ?,
    updated_at = unixepoch()
WHERE
    id = ?
    AND form_id = ?
    AND is_active = TRUE;

-- name: ListMealPricesByForm :many
SELECT
    mp.meal_id,
    mp.currency_code,
    mp.amount_cents
FROM meal_prices mp
JOIN meals m ON m.id = mp.meal_id
WHERE
    m.form_id = ?
    AND m.is_active = ?;
