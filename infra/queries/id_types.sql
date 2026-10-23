-- name: CreateIdType :one
INSERT INTO id_types (
    id,
    label,
    sort_order,
    allow_letters,
    max_len
) VALUES (
    ?, ?, ?, ?, ?
)
RETURNING *;

-- name: ListIdTypes :many
SELECT *
FROM id_types
WHERE is_active = ?
ORDER BY sort_order, label;

-- name: GetIdTypeById :one
SELECT *
FROM id_types
WHERE id = ?
LIMIT 1;

-- name: UpdateIdType :execrows
UPDATE id_types
SET
    label = ?,
    allow_letters = ?,
    max_len = ?,
    updated_at = unixepoch()
WHERE id = ?;

-- name: SetIdTypeActive :exec
UPDATE id_types
SET
    is_active = ?,
    sort_order = ?,
    updated_at = unixepoch()
WHERE id = ?;

-- name: GetNextIdTypeSortOrder :one
SELECT COALESCE(MAX(sort_order), 0) + 1
FROM id_types
WHERE is_active = ?;

-- name: SetIdTypeOrder :execrows
UPDATE id_types
SET
    sort_order = ?,
    updated_at = unixepoch()
WHERE
    id = ?
    AND is_active = TRUE;
