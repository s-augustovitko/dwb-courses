-- name: CreateUser :one
INSERT INTO users (
    id,
    name,
    email,
    role,
    password_hash
) VALUES (
    ?, ?, ?, ?, ?
)
RETURNING id, name, email, role, created_at;

-- name: GetUserByEmail :one
SELECT
    id,
    email,
    role,
    password_hash
FROM users
WHERE email = ?
LIMIT 1;

-- name: GetUserById :one
SELECT
    id,
    name,
    email,
    role
FROM users
WHERE id = ?
LIMIT 1;

-- name: UpdateUserRole :exec
UPDATE users
SET
    role = ?,
    updated_at = unixepoch()
WHERE id = ?;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = ?;

-- name: ListUsers :many
SELECT
    id,
    name,
    email,
    role,
    created_at
FROM users
ORDER BY created_at, id;

-- name: CountUsersByRole :one
SELECT COUNT(*) AS count
FROM users
WHERE role = ?;
