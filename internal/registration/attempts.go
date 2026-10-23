package registration

import (
	"sync"
	"time"
)

const (
	maxChargeAttempts = 5
	attemptWindow     = 24 * time.Hour
)

// attemptCounter counts attempts per key in a fixed window. It lives in this
// process's memory (the API runs as a single instance), so the counts reset
// when the API restarts.
type attemptCounter struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	entries map[string]attemptEntry
}

type attemptEntry struct {
	start time.Time
	count int
}

// allowAttempt records an attempt for key and reports whether it is within the
// limit; refused attempts are not counted.
func (a *attemptCounter) allowAttempt(key string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()

	now := time.Now() //nolint:forbidigo // duration math only; keeps monotonic clock

	// Drop expired windows so the map only holds orders with recent attempts.
	for k, entry := range a.entries {
		if now.Sub(entry.start) >= a.window {
			delete(a.entries, k)
		}
	}

	entry, ok := a.entries[key]
	if !ok {
		entry = attemptEntry{start: now, count: 0}
	}

	if entry.count >= a.limit {
		return false
	}

	entry.count++
	a.entries[key] = entry

	return true
}
