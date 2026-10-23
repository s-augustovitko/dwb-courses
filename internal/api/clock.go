package api

import "time"

// Now returns the current time in UTC.
func Now() time.Time {
	//nolint:forbidigo // the one sanctioned call
	return time.Now().UTC()
}

// FromUnix converts Unix seconds to a UTC time.
func FromUnix(seconds int64) time.Time {
	//nolint:forbidigo // the one sanctioned call
	return time.Unix(seconds, 0).UTC()
}
