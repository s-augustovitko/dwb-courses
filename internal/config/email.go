package config

import (
	"github.com/matcornic/hermes/v2"
	"github.com/wneessen/go-mail"
)

// Mailer bundles the SMTP client and templating engine.
type Mailer struct {
	*mail.Client
	*hermes.Hermes
}

const smtpImplicitTLSPort = 465

// InitMailer builds the SMTP mail client and templating engine.
func InitMailer(cfg *Config) (*Mailer, error) {
	var tlsOption mail.Option
	if cfg.SMTP.Port == smtpImplicitTLSPort {
		tlsOption = mail.WithSSL() // Implicit TLS for port 465
	} else {
		tlsOption = mail.WithTLSPolicy(
			mail.TLSMandatory,
		) // STARTTLS for port 587
	}

	client, err := mail.NewClient(
		cfg.SMTP.Host,
		mail.WithPort(cfg.SMTP.Port),
		tlsOption,
		mail.WithSMTPAuth(mail.SMTPAuthAutoDiscover),
		mail.WithUsername(cfg.SMTP.User),
		mail.WithPassword(cfg.SMTP.Pass),
	)
	if err != nil {
		return nil, err
	}

	return &Mailer{
		Client: client,
		Hermes: &hermes.Hermes{
			Product: hermes.Product{
				Name:        cfg.Email.Name,
				Link:        cfg.Email.Link,
				Logo:        cfg.Email.Logo,
				Copyright:   cfg.Email.Copyright,
				TroubleText: cfg.Email.Troubleshoot,
			},
			Theme:              &hermes.Default{},
			TextDirection:      hermes.TDLeftToRight,
			DisableCSSInlining: false,
		},
	}, nil
}
