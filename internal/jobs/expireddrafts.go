package jobs

import (
	"context"

	"github.com/rs/zerolog/log"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

type expiredDraftRow = database.ListExpiredDraftsRow

func expiredDraftsJob(d deps) job[expiredDraftRow] {
	cfg := d.Cfg().Jobs

	return job[expiredDraftRow]{
		name:  "expired drafts",
		delay: cfg.DelayDelete,
		fetch: func(
			ctx context.Context,
			limit int64,
		) ([]expiredDraftRow, error) {
			params := database.ListExpiredDraftsParams{
				MaxEmailAttempts: int64(cfg.MaxEmailAttempts),
				MaxFetch:         limit,
			}

			return database.New(d.DB()).ListExpiredDrafts(ctx, params)
		},
		orderID: func(r expiredDraftRow) []byte { return r.ID },
		process: func(ctx context.Context, row expiredDraftRow) error {
			var deleted int64

			err := api.WithTx(
				ctx,
				d,
				&log.Logger,
				func(q *database.Queries) error {
					var err error

					deleted, err = q.DeleteDraftOrder(ctx, row.ID)
					if err != nil || deleted == 0 {
						return err
					}

					return q.DeleteSubmission(ctx, row.SubmissionID)
				},
			)
			if err == nil && deleted > 0 && row.PaymentPendingAt.Valid {
				log.Error().
					Str("order", api.UUIDString(row.ID)).
					Msg("deleted a draft whose online payment never " +
						"got an outcome; check Culqi for a charge " +
						"on this order")
			}

			return err
		},
	}
}
