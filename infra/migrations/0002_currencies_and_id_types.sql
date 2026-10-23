-- +goose Up
CREATE TABLE currencies (
    code TEXT PRIMARY KEY -- PEN, USD
        CHECK (length(code) = 3 AND code = upper(code)),
    display_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE, -- at most one currency is the default

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

    CHECK (NOT is_default OR is_active)
);

CREATE UNIQUE INDEX idx_currencies_single_default
    ON currencies(is_default)
    WHERE is_default = TRUE;

CREATE TABLE id_types (
    id BLOB PRIMARY KEY,
    label TEXT NOT NULL UNIQUE COLLATE NOCASE, -- NOCASE folds ASCII only: "Carné" and "CARNÉ" differ

    sort_order INTEGER NOT NULL DEFAULT 0,
    allow_letters BOOLEAN NOT NULL DEFAULT FALSE,
    max_len INTEGER NOT NULL DEFAULT 12 -- exact length when letters are not allowed
        CHECK (max_len BETWEEN 1 AND 32),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO currencies (
    code,
    display_name,
    sort_order,
    is_default
) VALUES
('PEN', 'Soles', 0, TRUE),
('USD', 'Dólares', 1, FALSE);

INSERT INTO id_types (
    id,
    label,
    sort_order,
    allow_letters,
    max_len
) VALUES
(randomblob(16), 'DNI', 0, FALSE, 8),
(randomblob(16), 'CE', 1, TRUE, 12),
(randomblob(16), 'Pasaporte', 2, TRUE, 12);

-- +goose Down
DROP TABLE IF EXISTS id_types;
DROP INDEX IF EXISTS idx_currencies_single_default;
DROP TABLE IF EXISTS currencies;
