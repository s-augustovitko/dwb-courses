package jobs

import (
	"context"
	"database/sql"

	"dwb-courses/internal/database"
)

type draftEmailRow = database.ListDraftsNeedingEmailRow

func draftEmailsJob(d deps) job[draftEmailRow] {
	cfg := d.Cfg().Jobs

	return job[draftEmailRow]{
		name:  "draft emails",
		delay: cfg.DelayEmailSend,
		fetch: func(ctx context.Context, limit int64) ([]draftEmailRow, error) {
			params := database.ListDraftsNeedingEmailParams{
				MaxEmailAttempts: int64(cfg.MaxEmailAttempts),
				MaxFetch:         limit,
			}

			return database.New(d.DB()).ListDraftsNeedingEmail(ctx, params)
		},
		orderID: func(r draftEmailRow) []byte { return r.ID },
		process: func(ctx context.Context, row draftEmailRow) error {
			return rotateAndEmail(
				ctx,
				d,
				draftRotation(row, func(link string) error {
					return sendDraftReminderEmail(d, emailDataRegistration{
						To:        row.Email,
						FirstName: row.FirstName,
						Link:      link,
					})
				}),
			)
		},
	}
}

func draftRotation(
	row draftEmailRow,
	send func(link string) error,
) rotation {
	return rotation{
		orderID:  row.ID,
		failures: row.EmailFailures,
		mark: func(
			ctx context.Context,
			q *database.Queries,
			hash sql.NullString,
		) (int64, error) {
			return q.SetOrderTokenHashAndDraftSent(
				ctx,
				database.SetOrderTokenHashAndDraftSentParams{
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
			return q.UndoDraftEmail(ctx, database.UndoDraftEmailParams{
				PreviousHash: row.AccessTokenHash,
				Failures:     failures,
				ID:           row.ID,
				SentHash:     hash,
			})
		},
		send: send,
	}
}
