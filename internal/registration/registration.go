package registration

import (
	"sync"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
	"dwb-courses/internal/countries"
	"dwb-courses/internal/payments"
)

// Router registers the public registration routes and the staff routes.
func Router(
	router fiber.Router,
	srv api.Server,
	catalog *countries.Catalog,
	gateway payments.Gateway,
) {
	s := server{
		Server: srv, catalog: catalog, gateway: gateway,
		locks: &keyedLock{
			mu:      sync.Mutex{},
			entries: make(map[string]*lockEntry),
		},
		attempts: &attemptCounter{
			mu:      sync.Mutex{},
			limit:   maxChargeAttempts,
			window:  attemptWindow,
			entries: map[string]attemptEntry{},
		},
	}
	s.publicRoutes(router)
	s.adminRoutes(router)
}

// publicRoutes registers the unauthenticated, rate-limited routes.
func (s server) publicRoutes(router fiber.Router) {
	public := router.Group(
		"/public/registration",
		api.RateLimiter(
			s,
			"registration",
			s.Cfg().RateLimit.PublicRegistrationIP,
		),
	)

	public.Post("", s.Create)
	public.Get("/:token", s.Get)
	public.Put("/:token", s.Update)
	public.Post("/:token/submit", s.Submit)
	public.Post(
		"/:token/pay",
		api.RateLimiter(s, "pay", s.Cfg().RateLimit.PaymentIP),
		api.GlobalRateLimiter(s, "pay", s.Cfg().RateLimit.PaymentGlobal),
		s.Pay)
	public.Get("/:token/qr", s.QR)

	router.Post(
		"/public/webhooks/culqi",
		api.GlobalRateLimiter(s, "webhook", s.Cfg().RateLimit.WebhookGlobal),
		s.CulqiWebhook,
	)

	router.Get(
		"/public/payment/config",
		api.RateLimiter(s, "payconfig", s.Cfg().RateLimit.PaymentConfigIP),
		s.PaymentConfig,
	)
}

func (s server) adminRoutes(router fiber.Router) {
	staff := router.Group("/registration")

	staff.Get("",
		auth.Guard(s, auth.PermissionRead, s.AdminList))
	staff.Get("/:id",
		auth.Guard(s, auth.PermissionRead, s.AdminGet))

	staff.Post("",
		auth.Guard(s, auth.PermissionWrite, s.AdminCreate))
	staff.Patch("/:id",
		auth.Guard(s, auth.PermissionWrite, s.AdminUpdatePerson))
	staff.Put("/:id/items",
		auth.Guard(s, auth.PermissionWrite, s.AdminEditItems))
	staff.Post("/:id/discounts",
		auth.Guard(s, auth.PermissionWrite, s.AdminAddDiscount))
	staff.Delete(
		"/:id/discounts/:lineId",
		auth.Guard(s, auth.PermissionWrite, s.AdminRemoveDiscount))
	staff.Post("/:id/payments",
		auth.Guard(s, auth.PermissionWrite, s.AdminAddPayment))

	staff.Post("/:id/refunds",
		auth.Guard(s, auth.PermissionAdmin, s.AdminAddRefund))
	staff.Post("/:id/cancel",
		auth.Guard(s, auth.PermissionAdmin, s.AdminCancel))
}

// TokenPath is the bearer token identifying a registration in the :token param.
type TokenPath struct {
	Token string `uri:"token" validate:"required,len=43,base64rawurl"`
}

type server struct {
	api.Server

	catalog  *countries.Catalog
	gateway  payments.Gateway
	locks    *keyedLock
	attempts *attemptCounter
}
