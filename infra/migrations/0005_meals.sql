-- +goose Up
CREATE TABLE meals (
    id BLOB PRIMARY KEY,
    form_id BLOB NOT NULL REFERENCES forms(id) ON DELETE RESTRICT,

    name TEXT NOT NULL,
    hint_text TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    meal_date INTEGER NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_meals_form_id ON meals(form_id);

CREATE TABLE meal_prices (
    meal_id BLOB NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    currency_code TEXT NOT NULL REFERENCES currencies(code),
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),

    PRIMARY KEY (meal_id, currency_code)
);

-- +goose Down
DROP TABLE IF EXISTS meal_prices;
DROP INDEX IF EXISTS idx_meals_form_id;
DROP TABLE IF EXISTS meals;
