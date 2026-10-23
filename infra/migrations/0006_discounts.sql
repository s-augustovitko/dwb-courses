-- +goose Up
CREATE TABLE discounts (
    id BLOB PRIMARY KEY,
    form_id BLOB NOT NULL REFERENCES forms(id) ON DELETE RESTRICT,

    discount_type TEXT NOT NULL
        CHECK (discount_type = upper(discount_type)), -- CHECK IN ('EARLY_BIRD', 'ALL_SESSIONS', 'MEALS_INCLUDED', 'OTHER')
    name TEXT NOT NULL,
    hint_text TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    cutoff_date INTEGER,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

    CHECK (discount_type <> 'EARLY_BIRD' OR cutoff_date IS NOT NULL)
);

CREATE INDEX idx_discounts_form_id ON discounts(form_id);

CREATE TABLE discount_prices (
    discount_id BLOB NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
    currency_code TEXT NOT NULL REFERENCES currencies(code),
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),

    PRIMARY KEY (discount_id, currency_code)
);

-- +goose Down
DROP TABLE IF EXISTS discount_prices;
DROP INDEX IF EXISTS idx_discounts_form_id;
DROP TABLE IF EXISTS discounts;
