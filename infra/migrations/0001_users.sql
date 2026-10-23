-- +goose Up
CREATE TABLE users (
    id BLOB PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
        CHECK (email = lower(email)),
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'READER'
        CHECK (role = upper(role)), -- CHECK IN ('READER', 'WRITER', 'ADMIN')

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- +goose Down
DROP TABLE IF EXISTS users;
