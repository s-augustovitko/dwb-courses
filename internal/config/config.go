package config

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/kelseyhightower/envconfig"
	"go.yaml.in/yaml/v3"
)

type (
	service struct {
		Host string `envconfig:"SERVICE_HOST" yaml:"host"`
		Port string `envconfig:"SERVICE_PORT" yaml:"port"`

		Concurrency int `envconfig:"SERVICE_CONCURRENCY" yaml:"concurrency"`

		Name  string   `envconfig:"SERVICE_NAME"  yaml:"name"`
		Env   string   `envconfig:"SERVICE_ENV"   yaml:"env"`
		Hosts []string `envconfig:"SERVICE_HOSTS" yaml:"hosts"`
	}

	cors struct {
		Origins []string `envconfig:"CORS_ORIGINS" yaml:"origins"`

		Methods []string `envconfig:"CORS_METHODS" yaml:"methods"`
		Headers []string `envconfig:"CORS_HEADERS" yaml:"headers"`
	}

	timeout struct {
		Sm time.Duration `envconfig:"TIMEOUT_SM" yaml:"sm"`
		Md time.Duration `envconfig:"TIMEOUT_MD" yaml:"md"`
		Lg time.Duration `envconfig:"TIMEOUT_LG" yaml:"lg"`
	}

	database struct {
		Host string `envconfig:"DATABASE_HOST" yaml:"host"`

		MaxConnections int `envconfig:"DATABASE_MAX_CONNECTIONS" yaml:"max_connections"`
	}

	defaultUser struct {
		Name  string `envconfig:"DEFAULT_USER_NAME"  yaml:"name"`
		Email string `envconfig:"DEFAULT_USER_EMAIL" yaml:"email"`
	}

	auth struct {
		CookieMaxAge time.Duration `envconfig:"AUTH_COOKIE_MAX_AGE" yaml:"cookie_max_age"`
		CookieName   string        `envconfig:"AUTH_COOKIE_NAME"    yaml:"cookie_name"`
		RefreshRate  time.Duration `envconfig:"AUTH_REFRESH_RATE"   yaml:"refresh_rate"`

		MaxConcurrentHashes int `envconfig:"AUTH_MAX_CONCURRENT_HASHES" yaml:"max_concurrent_hashes"`
	}

	email struct {
		Name         string `envconfig:"EMAIL_NAME"         yaml:"name"`
		Reply        string `envconfig:"EMAIL_REPLY"        yaml:"reply"`
		Link         string `envconfig:"EMAIL_LINK"         yaml:"link"`
		Logo         string `envconfig:"EMAIL_LOGO"         yaml:"logo"`
		Copyright    string `envconfig:"EMAIL_COPYRIGHT"    yaml:"copyright"`
		Troubleshoot string `envconfig:"EMAIL_TROUBLESHOOT" yaml:"troubleshoot"`

		Greeting  string `envconfig:"EMAIL_GREETING"  yaml:"greeting"`
		Signature string `envconfig:"EMAIL_SIGNATURE" yaml:"signature"`
	}

	templates struct {
		PrimaryColor   string `envconfig:"TEMPLATES_PRIMARY_COLOR"    yaml:"primary_color"`
		OnPrimaryColor string `envconfig:"TEMPLATES_ON_PRIMARY_COLOR" yaml:"on_primary_color"`

		AdminPath string `envconfig:"TEMPLATES_ADMIN_PATH" yaml:"admin_path"`
	}

	smtp struct {
		From string `envconfig:"SMTP_FROM" yaml:"from"`
		Host string `envconfig:"SMTP_HOST" yaml:"host"`
		User string `envconfig:"SMTP_USER" yaml:"user"`
		Pass string `envconfig:"SMTP_PASS" yaml:"pass"`
		Port int    `envconfig:"SMTP_PORT" yaml:"port"`
	}

	culqi struct {
		BaseURL      string `envconfig:"CULQI_BASE_URL"       yaml:"base_url"`
		PublicKey    string `envconfig:"CULQI_PUBLIC_KEY"     yaml:"public_key"`
		SecretKey    string `envconfig:"CULQI_SECRET_KEY"     yaml:"secret_key"`
		RSAID        string `envconfig:"CULQI_RSA_ID"         yaml:"rsa_id"`
		RSAPublicKey string `envconfig:"CULQI_RSA_PUBLIC_KEY" yaml:"rsa_public_key"`
	}

	jobs struct {
		DelayEmailSend time.Duration `envconfig:"JOBS_DELAY_EMAIL_SEND" yaml:"delay_email_send"`
		DelayDelete    time.Duration `envconfig:"JOBS_DELAY_DELETE"     yaml:"delay_delete"`
		TickerDuration time.Duration `envconfig:"JOBS_TICKER_DURATION"  yaml:"ticker_duration"`
		Timeout        time.Duration `envconfig:"JOBS_TIMEOUT"          yaml:"timeout"`
		MaxFetch       int           `envconfig:"JOBS_MAX_FETCH"        yaml:"max_fetch"`

		MaxEmailAttempts int `envconfig:"JOBS_MAX_EMAIL_ATTEMPTS" yaml:"max_email_attempts"`
	}

	registration struct {
		MaxDonationCents int64 `envconfig:"REGISTRATION_MAX_DONATION_CENTS" yaml:"max_donation_cents"`
	}

	rateLimit struct {
		GlobalIP             int `envconfig:"RATE_LIMIT_GLOBAL_IP"              yaml:"global_ip"`
		AuthEmail            int `envconfig:"RATE_LIMIT_AUTH_EMAIL"             yaml:"auth_email"`
		AuthIP               int `envconfig:"RATE_LIMIT_AUTH_IP"                yaml:"auth_ip"`
		PublicFormIP         int `envconfig:"RATE_LIMIT_PUBLIC_FORM_IP"         yaml:"public_form_ip"`
		PublicRegistrationIP int `envconfig:"RATE_LIMIT_PUBLIC_REGISTRATION_IP" yaml:"public_registration_ip"`

		PaymentIP       int `envconfig:"RATE_LIMIT_PAYMENT_IP"        yaml:"payment_ip"`
		PaymentGlobal   int `envconfig:"RATE_LIMIT_PAYMENT_GLOBAL"    yaml:"payment_global"`
		PaymentConfigIP int `envconfig:"RATE_LIMIT_PAYMENT_CONFIG_IP" yaml:"payment_config_ip"`
		WebhookGlobal   int `envconfig:"RATE_LIMIT_WEBHOOK_GLOBAL"    yaml:"webhook_global"`
	}

	// Config holds the application's configuration.
	Config struct {
		Email        email        `yaml:"email"`
		Templates    templates    `yaml:"templates"`
		SMTP         smtp         `yaml:"smtp"`
		Service      service      `yaml:"service"`
		Auth         auth         `yaml:"auth"`
		Cors         cors         `yaml:"cors"`
		Timeout      timeout      `yaml:"timeout"`
		Database     database     `yaml:"database"`
		DefaultUser  defaultUser  `yaml:"default_user"`
		Culqi        culqi        `yaml:"culqi"`
		Jobs         jobs         `yaml:"jobs"`
		RateLimit    rateLimit    `yaml:"rate_limit"`
		Registration registration `yaml:"registration"`
	}
)

// SmCtx returns a context with the short timeout.
func (c Config) SmCtx(
	ctx context.Context,
) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, c.Timeout.Sm)
}

// MdCtx returns a context with the medium timeout.
func (c Config) MdCtx(
	ctx context.Context,
) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, c.Timeout.Md)
}

// LgCtx returns a context with the long timeout.
func (c Config) LgCtx(
	ctx context.Context,
) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, c.Timeout.Lg)
}

// Load reads config from the YAML file, then overlays it with env vars.
func Load(configPath string) (*Config, error) {
	if configPath == "" {
		return nil, errors.New("provide a config path with the -config flag")
	}

	cfg := defaultConfig()

	if err := readFile(configPath, cfg); err != nil {
		return nil, err
	}

	if err := readEnv(cfg); err != nil {
		return nil, err
	}

	if err := validateRequired(cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

const defaultCulqiBaseURL = "https://api.culqi.com/v2"

// defaultConfig holds the values used when neither YAML nor env sets them.
//
//nolint:mnd,exhaustruct_v5 // defaults literal
func defaultConfig() *Config {
	return &Config{
		Service: service{Host: "0.0.0.0", Port: "3000", Concurrency: 2048},
		Cors: cors{
			Methods: []string{
				"GET",
				"POST",
				"PUT",
				"PATCH",
				"DELETE",
				"OPTIONS",
			},
			Headers: []string{"Content-Type", "Accept"},
		},
		Timeout: timeout{
			Sm: 2 * time.Second,
			Md: 5 * time.Second,
			Lg: 15 * time.Second,
		},
		Database: database{Host: "/data/main.db", MaxConnections: 8},
		Auth: auth{
			CookieMaxAge: time.Hour,
			CookieName:   "__Host-session",
			RefreshRate:  15 * time.Minute,

			MaxConcurrentHashes: 1,
		},
		Email:     email{Greeting: "Hola", Signature: "Atentamente"},
		Templates: templates{AdminPath: "/admin"},
		Jobs: jobs{
			DelayEmailSend: time.Second,
			DelayDelete:    50 * time.Millisecond,
			TickerDuration: 15 * time.Minute,
			Timeout:        15 * time.Minute,
			MaxFetch:       150,

			MaxEmailAttempts: 7,
		},
		Culqi:        culqi{BaseURL: defaultCulqiBaseURL},
		Registration: registration{MaxDonationCents: 1000000},
		RateLimit: rateLimit{
			GlobalIP:             300,
			AuthEmail:            10,
			AuthIP:               20,
			PublicFormIP:         120,
			PublicRegistrationIP: 120,
			PaymentIP:            10,
			PaymentGlobal:        120,
			PaymentConfigIP:      120,
			WebhookGlobal:        240,
		},
	}
}

// validateRequired reports the first required field left unset by both the YAML
// file and env vars.
func validateRequired(cfg *Config) error {
	required := []struct {
		set  bool
		name string
	}{
		{cfg.Service.Name != "", "service.name"},
		{cfg.Service.Env != "", "service.env"},
		{len(cfg.Service.Hosts) != 0, "service.hosts"},

		{len(cfg.Cors.Origins) != 0, "cors.origins"},

		{cfg.Auth.MaxConcurrentHashes > 0, "auth.max_concurrent_hashes"},

		{cfg.Timeout.Sm > 0, "timeout.sm"},
		{cfg.Timeout.Md > 0, "timeout.md"},
		{cfg.Timeout.Lg > 0, "timeout.lg"},
		{cfg.Jobs.Timeout > 0, "jobs.timeout"},

		{cfg.Email.Reply != "", "email.reply"},
		{cfg.Email.Copyright != "", "email.copyright"},
		{cfg.Email.Link != "", "email.link"},
		{cfg.Email.Name != "", "email.name"},
		{cfg.Email.Logo != "", "email.logo"},
		{cfg.Email.Troubleshoot != "", "email.troubleshoot"},

		{cfg.Templates.PrimaryColor != "", "templates.primary_color"},

		{cfg.SMTP.From != "", "smtp.from"},
		{cfg.SMTP.Host != "", "smtp.host"},
		{cfg.SMTP.User != "", "smtp.user"},
		{cfg.SMTP.Port != 0, "smtp.port"},
		{cfg.SMTP.Pass != "", "SMTP_PASS"},

		{cfg.DefaultUser.Email != "", "default_user.email"},
		{cfg.DefaultUser.Name != "", "default_user.name"},

		{cfg.Culqi.BaseURL != "", "culqi.base_url"},
		{cfg.Culqi.PublicKey != "", "CULQI_PUBLIC_KEY"},
		{cfg.Culqi.SecretKey != "", "CULQI_SECRET_KEY"},
		{cfg.Culqi.RSAID != "", "CULQI_RSA_ID"},
		{cfg.Culqi.RSAPublicKey != "", "CULQI_RSA_PUBLIC_KEY"},
	}

	for _, r := range required {
		if !r.set {
			return fmt.Errorf("missing required config value: %s", r.name)
		}
	}

	return nil
}

func readFile(path string, cfg *Config) error {
	f, err := os.Open(path) // #nosec G304
	if err != nil {
		return err
	}

	defer func() { _ = f.Close() }()

	decoder := yaml.NewDecoder(f)

	return decoder.Decode(cfg)
}

func readEnv(cfg *Config) error {
	return envconfig.Process("", cfg)
}
