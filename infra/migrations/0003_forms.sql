-- +goose Up
CREATE TABLE forms (
    id BLOB PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',

    show_arrival_and_departure BOOLEAN NOT NULL DEFAULT FALSE,
    show_insurance BOOLEAN NOT NULL DEFAULT FALSE,
    show_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE,

    disable_session_selection BOOLEAN NOT NULL DEFAULT FALSE,
    disable_meal_selection BOOLEAN NOT NULL DEFAULT FALSE,
    disable_donation BOOLEAN NOT NULL DEFAULT FALSE,

    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE form_currencies (
    form_id BLOB NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    currency_code TEXT NOT NULL REFERENCES currencies(code),

    PRIMARY KEY (form_id, currency_code)
);

CREATE INDEX idx_form_currencies_currency_code ON form_currencies(currency_code);

-- +goose Down
DROP INDEX IF EXISTS idx_form_currencies_currency_code;
DROP TABLE IF EXISTS form_currencies;
DROP TABLE IF EXISTS forms;
