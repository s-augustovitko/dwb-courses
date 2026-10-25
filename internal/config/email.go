package config

import (
	"github.com/matcornic/hermes/v2"

	"dwb-courses/internal/mail"
)

// Mailer bundles the email sender and templating engine.
type Mailer struct {
	mail.Sender
	*hermes.Hermes
}

// NewMailer builds the templating engine around the given email sender.
func NewMailer(cfg *Config, sender mail.Sender) *Mailer {
	return &Mailer{
		Sender: sender,
		Hermes: &hermes.Hermes{
			Product: hermes.Product{
				Name:        cfg.Email.Name,
				Link:        cfg.Email.Link,
				Logo:        cfg.Email.Header,
				Copyright:   cfg.Email.Copyright,
				TroubleText: cfg.Email.Troubleshoot,
			},
			Theme:              &hermes.Default{},
			TextDirection:      hermes.TDLeftToRight,
			DisableCSSInlining: false,
		},
	}
}
