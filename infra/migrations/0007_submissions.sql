-- +goose Up
CREATE TABLE submissions (
    id BLOB PRIMARY KEY,
    form_id BLOB NOT NULL REFERENCES forms(id) ON DELETE RESTRICT,

    audience TEXT NOT NULL
        CHECK (audience = upper(audience)), -- CHECK IN ('LOCAL', 'FOREIGNER')
    dietary_preference TEXT
        CHECK (dietary_preference IS NULL OR dietary_preference = upper(dietary_preference)), -- CHECK IN ('REGULAR', 'VEGETARIAN')

    id_type_id BLOB NOT NULL REFERENCES id_types(id),
    document_number TEXT NOT NULL CHECK (document_number = upper(document_number)),

    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    country_code TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    email TEXT NOT NULL CHECK (email = lower(email)),

    arrival_date INTEGER,
    departure_date INTEGER CHECK (departure_date >= arrival_date),

    insurance_provider TEXT,
    insurance_policy_number TEXT,

    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_country_code TEXT,
    emergency_contact_email TEXT CHECK (emergency_contact_email = lower(emergency_contact_email)),

    cancelled_at INTEGER, -- set when the registration is cancelled; frees the document for a new registration

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_submissions_active_key
    ON submissions(form_id, id_type_id, document_number)
    WHERE cancelled_at IS NULL;

CREATE INDEX idx_submissions_form_id ON submissions(form_id);

CREATE TABLE submission_sessions (
    submission_id BLOB NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    session_id BLOB NOT NULL REFERENCES sessions(id) ON DELETE RESTRICT,

    PRIMARY KEY (submission_id, session_id)
);

CREATE INDEX idx_submission_sessions_session_id ON submission_sessions(session_id);

CREATE TABLE submission_meals (
    submission_id BLOB NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    meal_id BLOB NOT NULL REFERENCES meals(id) ON DELETE RESTRICT,

    PRIMARY KEY (submission_id, meal_id)
);

CREATE INDEX idx_submission_meals_meal_id ON submission_meals(meal_id);

-- +goose Down
DROP INDEX IF EXISTS idx_submission_meals_meal_id;
DROP TABLE IF EXISTS submission_meals;
DROP INDEX IF EXISTS idx_submission_sessions_session_id;
DROP TABLE IF EXISTS submission_sessions;
DROP INDEX IF EXISTS idx_submissions_form_id;
DROP INDEX IF EXISTS idx_submissions_active_key;
DROP TABLE IF EXISTS submissions;
