package jobs

import (
	"context"
	"database/sql"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

type reminderRow = database.ListOrdersNeedingReminderRow

func paymentRemindersJob(d deps) job[reminderRow] {
	cfg := d.Cfg().Jobs

	return job[reminderRow]{
		name:  "payment reminders",
		delay: cfg.DelayEmailSend,
		fetch: func(ctx context.Context, limit int64) ([]reminderRow, error) {
			params := database.ListOrdersNeedingReminderParams{
				MaxEmailAttempts: int64(cfg.MaxEmailAttempts),
				MaxFetch:         limit,
			}

			return database.New(d.DB()).
				ListOrdersNeedingReminder(ctx, params)
		},
		orderID: func(r reminderRow) []byte { return r.ID },
		process: func(ctx context.Context, row reminderRow) error {
			return rotateAndEmail(
				ctx,
				d,
				reminderRotation(
					row,
					func(ctx context.Context, link string) error {
						return sendPaymentReminderEmail(
							ctx,
							d,
							emailDataRegistration{
								To:        row.Email,
								FirstName: row.FirstName,
								Link:      link,
							},
							api.FormatCents(row.BalanceCents, row.CurrencyCode),
						)
					},
				),
			)
		},
	}
}

func reminderRotation(
	row reminderRow,
	send func(ctx context.Context, link string) error,
) rotation {
	return rotation{
		orderID:  row.ID,
		failures: row.EmailFailures,
		mark: func(
			ctx context.Context,
			q *database.Queries,
			hash sql.NullString,
		) (int64, error) {
			return q.MarkReminderSentAndSetHash(
				ctx,
				database.MarkReminderSentAndSetHashParams{
					AccessTokenHash: hash,
					ID:              row.ID,
				},
			)
		},
		undo: func(
			ctx context.Context,
			q *database.Queries,
			hash sql.NullString,
			failures int64,
		) error {
			return q.UndoReminder(ctx, database.UndoReminderParams{
				PreviousHash:       row.AccessTokenHash,
				PreviousReminderAt: row.LastReminderAt,
				Failures:           failures,
				ID:                 row.ID,
				SentHash:           hash,
			})
		},
		send: send,
	}
}
