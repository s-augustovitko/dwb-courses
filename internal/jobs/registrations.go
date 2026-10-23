package jobs

import (
	"context"
	"database/sql"
	"time"

	"github.com/rs/zerolog/log"

	"dwb-courses/internal/config"
	"dwb-courses/internal/database"
)

type deps interface {
	DB() database.DBTX
	DBConn() *sql.DB
	Cfg() *config.Config
	Mailer() *config.Mailer
}

// startDelay lets the server settle before the first run; restarts must not
// postpone the jobs.
const startDelay = time.Minute

// RunRegistrations runs the jobs shortly after start, then every tick until ctx
// is done.
func RunRegistrations(ctx context.Context, d deps) {
	if !sleep(ctx, startDelay) {
		return
	}

	runAllJobs(ctx, d)

	ticker := time.NewTicker(d.Cfg().Jobs.TickerDuration)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			runAllJobs(ctx, d)
		}
	}
}

func runAllJobs(ctx context.Context, d deps) {
	cfg := d.Cfg().Jobs

	for _, j := range []runner{
		draftEmailsJob(d),
		expiredDraftsJob(d),
		paymentRemindersJob(d),
	} {
		// Each job gets its own budget so a slow one cannot starve the rest.
		if err := runWithTimeout(
			ctx,
			j,
			int64(cfg.MaxFetch),
			cfg.Timeout,
		); err != nil {
			log.Error().
				Err(err).
				Str("job", j.label()).
				Msg("registration job failed")
		}
	}
}

func runWithTimeout(
	ctx context.Context,
	j runner,
	limit int64,
	timeout time.Duration,
) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	return j.run(ctx, limit)
}
