-- +goose Up
CREATE TABLE payments (
    id BLOB PRIMARY KEY,
    order_id BLOB NOT NULL REFERENCES orders(id) ON DELETE RESTRICT, -- the money ledger is never deleted with an order

    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    method TEXT NOT NULL
        CHECK (method = upper(method)), -- CHECK IN ('ONLINE_PAYMENT', 'CASH', 'BANK_TRANSFER', 'YAPE', 'PLIN', 'REFUND', 'OTHER')
    provider_reference TEXT,
    note TEXT,

    recorded_by BLOB REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),

    CHECK (method <> 'ONLINE_PAYMENT' OR provider_reference IS NOT NULL)
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_recorded_by ON payments(recorded_by);
-- Only gateway charge ids are unique: a staff reference is free text and may repeat or quote a charge id.
CREATE UNIQUE INDEX idx_payments_provider_reference
    ON payments(provider_reference)
    WHERE method = 'ONLINE_PAYMENT';

-- +goose Down
DROP INDEX IF EXISTS idx_payments_provider_reference;
DROP INDEX IF EXISTS idx_payments_recorded_by;
DROP INDEX IF EXISTS idx_payments_order_id;
DROP TABLE IF EXISTS payments;
