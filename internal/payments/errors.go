package payments

import "errors"

var (
	// ErrOutcomeUnknown means the provider may or may not have charged the
	// card; rely on its webhook.
	ErrOutcomeUnknown = errors.New("payment outcome unknown")
	// ErrRejected means the provider refused the request itself (configuration
	// or validation problem).
	ErrRejected = errors.New("payment request rejected")
	// ErrNotFound means the provider has no such charge.
	ErrNotFound = errors.New("payment not found")
)
