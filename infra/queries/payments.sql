-- name: CreateManualPayment :one
-- Staff-recorded payment or refund; method ONLINE_PAYMENT is reserved for the gateway path.
INSERT INTO payments (
    id,
    order_id,
    amount_cents,
    method,
    provider_reference,
    recorded_by,
    note
) VALUES (
    ?, ?, ?, ?, ?, ?, ?
)
RETURNING *;

-- name: ListPaymentsByOrder :many
SELECT *
FROM payments
WHERE order_id = ?
ORDER BY created_at, id;

-- name: CreateOnlinePaymentIfNew :execrows
-- Idempotent on the gateway charge id; staff payments never collide with it.
INSERT INTO payments (
    id,
    order_id,
    amount_cents,
    method,
    provider_reference,
    note
) VALUES (
    ?, ?, ?, 'ONLINE_PAYMENT', ?, ?
)
ON CONFLICT (provider_reference) WHERE method = 'ONLINE_PAYMENT' DO NOTHING;

-- name: GetOnlinePaymentByReference :one
SELECT
    id,
    order_id
FROM payments
WHERE
    provider_reference = ?
    AND method = 'ONLINE_PAYMENT'
LIMIT 1;
