-- name: CreateDiscount :one
INSERT INTO discounts (
    id,
    form_id,
    discount_type,
    name,
    hint_text,
    sort_order,
    cutoff_date
) VALUES (
    ?, ?, ?, ?, ?, ?, ?
)
RETURNING *;

-- name: ListEligibleDiscountsForSubmission :many
-- Automatic discounts for a submission that selected every active session; a price row in its currency
-- means the discount is offered (MEALS_INCLUDED is worth the selected meals). EARLY_BIRD is checked against now.
WITH QueryContext AS (
    SELECT
        (
            SELECT COUNT(*)
            FROM sessions s
            WHERE
                s.form_id = @form_id
                AND s.is_active = TRUE
                AND s.id NOT IN (
                    SELECT ss.session_id
                    FROM submission_sessions ss
                    WHERE ss.submission_id = @submission_id
                )
        ) AS unselected_active_sessions,
        (
            SELECT COUNT(*)
            FROM submission_sessions ss
            WHERE ss.submission_id = @submission_id
        ) AS selected_sessions,
        (
            SELECT EXISTS (
                SELECT 1
                FROM submission_meals
                WHERE submission_id = @submission_id
            )
        ) AS has_meals,
        (
            SELECT COALESCE(SUM(mp.amount_cents), 0)
            FROM submission_meals sm
            JOIN meal_prices mp ON mp.meal_id = sm.meal_id
            WHERE
                sm.submission_id = @submission_id
                AND mp.currency_code = @currency_code
        ) AS meals_discount_amount
)
SELECT
    d.id,
    d.discount_type,
    d.name,
    CAST(
        CASE
            WHEN d.discount_type = 'MEALS_INCLUDED' THEN ctx.meals_discount_amount
            ELSE dp.amount_cents
        END AS INTEGER
    ) AS amount_cents
FROM discounts d
JOIN discount_prices dp ON dp.discount_id = d.id AND dp.currency_code = @currency_code
CROSS JOIN QueryContext ctx
WHERE
    d.form_id = @form_id
    AND d.is_active = TRUE
    AND ctx.selected_sessions > 0
    AND ctx.unselected_active_sessions = 0
    AND (
        (
            d.discount_type = 'EARLY_BIRD'
            AND unixepoch() <= d.cutoff_date
        )
        OR (d.discount_type = 'ALL_SESSIONS')
        OR (d.discount_type = 'MEALS_INCLUDED' AND ctx.has_meals)
    )
ORDER BY d.sort_order, d.id;

-- name: UpdateDiscount :execrows
UPDATE discounts
SET
    discount_type = ?,
    name = ?,
    hint_text = ?,
    cutoff_date = ?,
    updated_at = unixepoch()
WHERE
    id = ?
    AND form_id = ?;

-- name: SetDiscountActive :execrows
UPDATE discounts
SET
    is_active = ?,
    sort_order = ?,
    updated_at = unixepoch()
WHERE
    id = ?
    AND form_id = ?;

-- name: InsertDiscountPrice :exec
INSERT INTO discount_prices (
    discount_id,
    currency_code,
    amount_cents
) VALUES (
    ?, ?, ?
);

-- name: ListDiscountPrices :many
SELECT
    discount_id,
    currency_code,
    amount_cents
FROM discount_prices
WHERE discount_id = ?;

-- name: GetDiscountPrice :one
SELECT
    discount_id,
    currency_code,
    amount_cents
FROM discount_prices
WHERE
    discount_id = ?
    AND currency_code = ?
LIMIT 1;

-- name: DeleteDiscountPrices :exec
DELETE FROM discount_prices
WHERE discount_id = ?;

-- name: ListDiscountsByForm :many
-- Admin-facing: all discounts for a form, filtered by active state.
SELECT *
FROM discounts
WHERE
    form_id = ?
    AND is_active = ?
ORDER BY sort_order;

-- name: GetNextDiscountSortOrder :one
SELECT COALESCE(MAX(sort_order), 0) + 1
FROM discounts
WHERE
    form_id = ?
    AND is_active = ?;

-- name: SetDiscountOrder :execrows
UPDATE discounts
SET
    sort_order = ?,
    updated_at = unixepoch()
WHERE
    id = ?
    AND form_id = ?
    AND is_active = TRUE;

-- name: GetDiscountById :one
SELECT *
FROM discounts
WHERE id = ?
LIMIT 1;

-- name: ListDiscountPricesByForm :many
SELECT
    dp.discount_id,
    dp.currency_code,
    dp.amount_cents
FROM discount_prices dp
JOIN discounts d ON d.id = dp.discount_id
WHERE
    d.form_id = ?
    AND d.is_active = ?;
