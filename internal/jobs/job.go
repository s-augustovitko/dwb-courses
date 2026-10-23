package jobs

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"

	"dwb-courses/internal/api"
)

type runner interface {
	label() string
	run(ctx context.Context, limit int64) error
}

// job fetches a batch of rows and processes each, pausing delay between rows.
type job[T any] struct {
	name    string
	delay   time.Duration
	fetch   func(ctx context.Context, limit int64) ([]T, error)
	orderID func(T) []byte
	process func(ctx context.Context, row T) error
}

func (j job[T]) label() string { return j.name }

func (j job[T]) run(ctx context.Context, limit int64) error {
	rows, err := j.fetch(ctx, limit)
	if err != nil {
		return err
	}

	for i, row := range rows {
		if i > 0 && !sleep(ctx, j.delay) {
			return ctx.Err()
		}

		if err := j.process(ctx, row); err != nil {
			log.Error().
				Err(err).
				Str("job", j.name).
				Str("order", api.UUIDString(j.orderID(row))).
				Msg("job item failed")
		}
	}

	return nil
}

// sleep waits for d and reports false if ctx ended first.
func sleep(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()

	select {
	case <-t.C:
		return true
	case <-ctx.Done():
		return false
	}
}
