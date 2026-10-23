package main

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/healthcheck"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
	"dwb-courses/internal/config"
	"dwb-courses/internal/countries"
	"dwb-courses/internal/currency"
	"dwb-courses/internal/discount"
	"dwb-courses/internal/forms"
	"dwb-courses/internal/idtypes"
	"dwb-courses/internal/meal"
	"dwb-courses/internal/payments"
	"dwb-courses/internal/payments/culqi"
	"dwb-courses/internal/publicform"
	"dwb-courses/internal/registration"
	"dwb-courses/internal/session"
	"dwb-courses/internal/user"
)

func newGateway(cfg *config.Config) payments.Gateway {
	return culqi.New(cfg.Culqi.BaseURL, cfg.Culqi.SecretKey)
}

func registerRoutes(
	router fiber.Router,
	srv api.Server,
	catalog *countries.Catalog,
) {
	router.Get(healthcheck.LivenessEndpoint, healthcheck.New(healthcheck.Config{
		Probe:          func(_ fiber.Ctx) bool { return true },
		ResponseFormat: healthcheck.FormatJSON,
		Next:           nil,
	}))
	router.Get(
		healthcheck.ReadinessEndpoint,
		healthcheck.New(healthcheck.Config{
			Probe:          srv.Ready,
			ResponseFormat: healthcheck.FormatJSON,
			Next:           nil,
		}),
	)

	auth.Router(router, srv)
	user.Router(router, srv)
	currency.Router(router, srv)
	idtypes.Router(router, srv)
	forms.Router(router, srv)
	discount.Router(router, srv)
	session.Router(router, srv)
	meal.Router(router, srv)
	publicform.Router(router, srv, catalog)
	registration.Router(router, srv, catalog, newGateway(srv.Cfg()))
}
