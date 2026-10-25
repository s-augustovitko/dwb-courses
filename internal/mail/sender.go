// Package mail is the provider-neutral email API; providers implement Sender.
package mail

import "context"

// InlineImage is an image the HTML body references with "cid:<CID>".
type InlineImage struct {
	CID      string
	Name     string
	MimeType string
	Content  []byte
}

// Message is one HTML email to a single recipient.
type Message struct {
	From         string
	To           string
	Subject      string
	HTML         string
	InlineImages []InlineImage
}

// Sender sends emails through a provider.
type Sender interface {
	Send(ctx context.Context, message Message) error
}
