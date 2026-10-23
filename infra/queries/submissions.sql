-- name: CreateSubmission :one
INSERT INTO submissions (
    id,
    form_id,
    first_name,
    last_name,
    document_number,
    id_type_id,
    country_code,
    phone_number,
    email,
    arrival_date,
    departure_date,
    insurance_provider,
    insurance_policy_number,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_country_code,
    emergency_contact_email,
    audience,
    dietary_preference
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
RETURNING *;

-- name: GetSubmissionById :one
SELECT *
FROM submissions
WHERE id = ?
LIMIT 1;

-- name: UpdateSubmission :exec
UPDATE submissions
SET
    first_name = ?,
    last_name = ?,
    document_number = ?,
    id_type_id = ?,
    country_code = ?,
    phone_number = ?,
    email = ?,
    arrival_date = ?,
    departure_date = ?,
    insurance_provider = ?,
    insurance_policy_number = ?,
    emergency_contact_name = ?,
    emergency_contact_phone = ?,
    emergency_contact_country_code = ?,
    emergency_contact_email = ?,
    updated_at = unixepoch()
WHERE id = ?;

-- name: DeleteSubmission :exec
DELETE FROM submissions
WHERE id = ?;

-- name: AddSubmissionSession :exec
INSERT INTO submission_sessions (
    submission_id,
    session_id
) VALUES (
    ?, ?
);

-- name: LinkAllActiveSessionsToSubmission :exec
-- For forms with disable_session_selection: links every active session of the form.
INSERT INTO submission_sessions (
    submission_id,
    session_id
)
SELECT
    ?,
    id
FROM sessions
WHERE
    form_id = ?
    AND is_active = 1;

-- name: RemoveSubmissionSession :exec
DELETE FROM submission_sessions
WHERE
    submission_id = ?
    AND session_id = ?;

-- name: CountSubmissionSessions :one
SELECT COUNT(*) AS count
FROM submission_sessions
WHERE submission_id = ?;

-- name: AddSubmissionMeal :exec
INSERT INTO submission_meals (
    submission_id,
    meal_id
) VALUES (
    ?, ?
);

-- name: LinkAllActiveMealsToSubmission :exec
-- For forms with disable_meal_selection: links every active meal of the form.
INSERT INTO submission_meals (
    submission_id,
    meal_id
)
SELECT
    ?,
    id
FROM meals
WHERE
    form_id = ?
    AND is_active = 1;

-- name: RemoveSubmissionMeal :exec
DELETE FROM submission_meals
WHERE
    submission_id = ?
    AND meal_id = ?;

-- name: CountSubmissionMeals :one
SELECT COUNT(*) AS count
FROM submission_meals
WHERE submission_id = ?;
