package api

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"dwb-courses/internal/database"
)

type withDB interface {
	DBConn() *sql.DB
	DB() database.DBTX
}

func deferTxRollback(tx *sql.Tx, logger *zerolog.Logger) {
	err := tx.Rollback()
	if err != nil && !errors.Is(err, sql.ErrTxDone) {
		logger.Error().Err(err).Msg("could not rollback transaction")
	}
}

// WithTx runs fn inside a database transaction, committing on success and
// rolling back otherwise.
func WithTx(
	ctx context.Context,
	s withDB,
	logger *zerolog.Logger,
	fn func(q *database.Queries) error,
) error {
	tx, err := s.DBConn().BeginTx(ctx, nil)
	if err != nil {
		return Error(ErrorTypeUnexpected, err)
	}
	defer deferTxRollback(tx, logger)

	if err := fn(database.New(tx)); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return Error(ErrorTypeFromSQL(err), err)
	}

	return nil
}

const centsPerUnit = 100

// FormatCents formats cents as an amount.
func FormatCents(cents int64, currencyCode string) string {
	sign := ""
	if cents < 0 {
		sign = "-"
		cents = -cents
	}

	return fmt.Sprintf(
		"%s%d.%02d %s",
		sign,
		cents/centsPerUnit,
		cents%centsPerUnit,
		currencyCode,
	)
}

// UUIDFromBytes reads a 16-byte database id. Ids are always UUIDs, so a
// malformed one yields the empty (nil) UUID.
func UUIDFromBytes(raw []byte) uuid.UUID {
	id, _ := uuid.FromBytes(raw)

	return id
}

// UUIDString renders a 16-byte database id as a UUID string, or "" if invalid.
func UUIDString(raw []byte) string {
	id, err := uuid.FromBytes(raw)
	if err != nil {
		return ""
	}

	return id.String()
}

// CheckAffectedRows turns an :execrows result into an error: the SQL error, or
// NotFound when no row matched.
func CheckAffectedRows(rows int64, err error) error {
	if err != nil {
		return Error(ErrorTypeFromSQL(err), err)
	}

	if rows == 0 {
		return Error(ErrorTypeNotFound, nil)
	}

	return nil
}
