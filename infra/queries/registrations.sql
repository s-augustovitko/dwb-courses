-- name: GetRegistrationByKey :one
SELECT
    o.id AS order_id,
    o.status,
    o.submission_id,
    o.payment_pending_at,
    s.email
FROM submissions s
JOIN orders o ON o.submission_id = s.id
WHERE
    s.form_id = ?
    AND s.id_type_id = ?
    AND s.document_number = ?
    AND s.cancelled_at IS NULL
LIMIT 1;

-- name: CreateDraftOrder :one
INSERT INTO orders (
    id,
    submission_id,
    currency_code,
    status,
    access_token_hash
) VALUES (
    ?, ?, ?, 'DRAFT', ?
)
RETURNING *;

-- name: GetOrderByTokenHash :one
SELECT
    o.*,
    t.total_amount_cents,
    t.amount_paid_cents
FROM orders o
JOIN order_totals t ON t.order_id = o.id
WHERE o.access_token_hash = ?
LIMIT 1;

-- name: SetOrderTokenHashAndDraftSent :execrows
-- Re-checks the list conditions so a draft that was edited or submitted meanwhile keeps its link.
-- updated_at is left alone: the email is not activity, and UndoDraftEmail can then retry next tick.
UPDATE orders
SET
    access_token_hash = ?,
    draft_email_sent_at = unixepoch(),
    email_failures = 0
WHERE
    id = ?
    AND status = 'DRAFT'
    AND draft_email_sent_at IS NULL
    AND (payment_pending_at IS NULL OR payment_pending_at <= unixepoch() - 86400) -- paymentPendingWindow
    AND updated_at <= unixepoch() - 86400;

-- name: UndoDraftEmail :exec
-- Restores the previous link after a failed send and counts the failure, unless the token changed
-- again meanwhile.
UPDATE orders
SET
    access_token_hash = @previous_hash,
    draft_email_sent_at = NULL,
    email_failures = @failures
WHERE
    id = @id
    AND access_token_hash = @sent_hash;

-- name: CountUnselectedActiveSessions :one
-- Active sessions of the form that the submission did not select (0 means every open session is selected).
SELECT COUNT(*) AS count
FROM sessions s
WHERE
    s.form_id = ?
    AND s.is_active = TRUE
    AND s.id NOT IN (
        SELECT session_id
        FROM submission_sessions
        WHERE submission_id = ?
    );

-- name: SetOrderPending :exec
UPDATE orders
SET
    status = 'PENDING',
    updated_at = unixepoch()
WHERE
    id = ?
    AND status = 'DRAFT';

-- name: SetSubmissionDietaryPreference :exec
UPDATE submissions
SET
    dietary_preference = ?,
    updated_at = unixepoch()
WHERE id = ?;

-- name: UpdateDraftOrderCurrency :exec
UPDATE orders
SET
    currency_code = ?,
    updated_at = unixepoch()
WHERE
    id = ?
    AND status = 'DRAFT';

-- name: ClearSubmissionSessions :exec
DELETE FROM submission_sessions
WHERE submission_id = ?;

-- name: ClearSubmissionMeals :exec
DELETE FROM submission_meals
WHERE submission_id = ?;

-- name: ClearOrderSessionItems :exec
DELETE FROM order_session_items
WHERE order_id = ?;

-- name: ClearOrderMealItems :exec
DELETE FROM order_meal_items
WHERE order_id = ?;

-- name: ClearOrderDiscountItems :exec
DELETE FROM order_discount_items
WHERE order_id = ?;

-- name: ClearOrderDonationItem :exec
DELETE FROM order_donation_items
WHERE order_id = ?;

-- name: ListDraftsNeedingEmail :many
-- Drafts idle for 24 hours that have not been emailed yet.
SELECT
    o.id,
    o.access_token_hash,
    o.email_failures,
    s.email,
    s.first_name
FROM orders o
JOIN submissions s ON s.id = o.submission_id
WHERE
    o.status = 'DRAFT'
    AND o.draft_email_sent_at IS NULL
    AND o.email_failures < @max_email_attempts
    AND (o.payment_pending_at IS NULL OR o.payment_pending_at <= unixepoch() - 86400) -- paymentPendingWindow
    AND o.updated_at <= unixepoch() - 86400
ORDER BY o.updated_at, o.id
LIMIT @max_fetch;

-- name: DeleteDraftOrder :execrows
-- Only deletes a DRAFT idle for 24 hours with no payment, recorded or in flight.
DELETE FROM orders
WHERE
    orders.id = ?
    AND status = 'DRAFT'
    AND (payment_pending_at IS NULL OR payment_pending_at <= unixepoch() - 86400) -- paymentPendingWindow
    AND updated_at <= unixepoch() - 86400
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = orders.id);

-- name: SetPaymentPending :exec
-- No updated_at: the payment flow already calls TouchOrder.
UPDATE orders
SET payment_pending_at = unixepoch()
WHERE id = ?;

-- name: ClearPaymentPending :exec
-- No updated_at: the payment flow already calls TouchOrder or SetOrderStatus.
UPDATE orders
SET payment_pending_at = NULL
WHERE id = ?;

-- name: TouchOrder :exec
-- Marks the order as active now (a payment attempt starts), which keeps the draft cleanup away from it.
UPDATE orders
SET updated_at = unixepoch()
WHERE id = ?;

-- name: ListExpiredDrafts :many
-- Drafts emailed 24 hours ago, or whose email was given up, once idle for the same 48 hours.
SELECT
    o.id,
    o.submission_id,
    o.payment_pending_at
FROM orders o
WHERE
    o.status = 'DRAFT'
    AND (
        o.draft_email_sent_at <= unixepoch() - 86400
        OR (o.email_failures >= @max_email_attempts AND o.updated_at <= unixepoch() - 172800)
    )
    AND (o.payment_pending_at IS NULL OR o.payment_pending_at <= unixepoch() - 86400) -- paymentPendingWindow
    AND o.updated_at <= unixepoch() - 86400
ORDER BY o.updated_at, o.id
LIMIT @max_fetch;

-- name: ListOrdersNeedingReminder :many
-- Owing orders, 14 days after submit or the last reminder, while a selected session is still ahead.
SELECT
    o.id,
    o.currency_code,
    o.access_token_hash,
    o.last_reminder_at,
    o.email_failures,
    s.email,
    s.first_name,
    CAST(t.total_amount_cents - t.amount_paid_cents AS INTEGER) AS balance_cents
FROM orders o
JOIN order_totals t ON t.order_id = o.id
JOIN submissions s ON s.id = o.submission_id
WHERE
    o.status IN ('PENDING', 'PARTIALLY_PAID')
    AND (o.payment_pending_at IS NULL OR o.payment_pending_at <= unixepoch() - 86400) -- paymentPendingWindow
    AND o.reminder_count < 25
    AND o.email_failures < @max_email_attempts
    AND COALESCE(o.last_reminder_at, o.updated_at) <= unixepoch() - 1209600
    AND t.total_amount_cents > t.amount_paid_cents
ORDER BY COALESCE(o.last_reminder_at, o.updated_at), o.id
LIMIT @max_fetch;

-- name: MarkReminderSentAndSetHash :execrows
-- Re-checks that the order is still open, owing and not mid-payment, so a payment that landed after
-- the list gets no reminder. updated_at is left alone so UndoReminder restores the exact schedule.
UPDATE orders
SET
    access_token_hash = ?,
    reminder_count = reminder_count + 1,
    last_reminder_at = unixepoch(),
    email_failures = 0
WHERE
    id = ?
    AND status IN ('PENDING', 'PARTIALLY_PAID')
    AND (payment_pending_at IS NULL OR payment_pending_at <= unixepoch() - 86400) -- paymentPendingWindow
    AND EXISTS (
        SELECT 1
        FROM order_totals t
        WHERE
            t.order_id = orders.id
            AND t.total_amount_cents > t.amount_paid_cents
    );

-- name: UndoReminder :exec
-- Restores the previous link and schedule after a failed send and counts the failure, unless the
-- token changed meanwhile.
UPDATE orders
SET
    access_token_hash = @previous_hash,
    reminder_count = reminder_count - 1,
    last_reminder_at = @previous_reminder_at,
    email_failures = @failures
WHERE
    id = @id
    AND access_token_hash = @sent_hash;

-- name: CancelSubmission :exec
UPDATE submissions
SET
    cancelled_at = unixepoch(),
    updated_at = unixepoch()
WHERE id = ?;

-- name: ClearOrderTokenHash :exec
UPDATE orders
SET
    access_token_hash = NULL,
    updated_at = unixepoch()
WHERE id = ?;

-- name: ListOrderDiscountLines :many
-- Discount lines of an order with the catalog type, to tell automatic from manual discounts.
SELECT
    odi.id,
    odi.discount_id,
    odi.name_snapshot,
    odi.amount_cents,
    d.discount_type
FROM order_discount_items odi
JOIN discounts d ON d.id = odi.discount_id
WHERE odi.order_id = ?
ORDER BY odi.created_at, odi.id;

-- name: ListRegistrations :many
-- Staff list; statuses is comma-separated; search is a literal, ASCII-case-insensitive substring.
SELECT
    o.id AS order_id,
    o.status,
    o.currency_code,
    o.created_at,
    s.form_id,
    f.title AS form_title,
    s.first_name,
    s.last_name,
    s.document_number,
    s.email,
    t.total_amount_cents,
    t.amount_paid_cents
FROM orders o
JOIN order_totals t ON t.order_id = o.id
JOIN submissions s ON s.id = o.submission_id
JOIN forms f ON f.id = s.form_id
WHERE
    (CAST(sqlc.narg('form_id') AS BLOB) IS NULL OR s.form_id = sqlc.narg('form_id'))
    AND (
        (CAST(sqlc.narg('statuses') AS TEXT) IS NULL AND o.status != 'DRAFT')
        OR instr(',' || sqlc.narg('statuses') || ',', ',' || o.status || ',') > 0
    )
    AND (
        CAST(sqlc.narg('search') AS TEXT) IS NULL
        OR instr(lower(s.first_name), lower(sqlc.narg('search'))) > 0
        OR instr(lower(s.last_name), lower(sqlc.narg('search'))) > 0
        OR instr(lower(s.document_number), lower(sqlc.narg('search'))) > 0
        OR instr(lower(s.email), lower(sqlc.narg('search'))) > 0
    )
ORDER BY o.created_at DESC, o.id DESC
LIMIT @page_limit OFFSET @page_offset;
