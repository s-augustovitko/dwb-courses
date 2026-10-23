-- +goose Up
CREATE TABLE sessions (
    id BLOB PRIMARY KEY,
    form_id BLOB NOT NULL REFERENCES forms(id) ON DELETE RESTRICT,

    name TEXT NOT NULL,
    hint_text TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    session_date INTEGER NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_sessions_form_id ON sessions(form_id);

CREATE TABLE session_prices (
    session_id BLOB NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    currency_code TEXT NOT NULL REFERENCES currencies(code),
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),

    PRIMARY KEY (session_id, currency_code)
);

-- +goose Down
DROP TABLE IF EXISTS session_prices;
DROP INDEX IF EXISTS idx_sessions_form_id;
DROP TABLE IF EXISTS sessions;
