package auth

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
)

// Router registers auth routes and their access requirements.
func Router(router fiber.Router, srv api.Server) {
	s := server{srv}
	r := router.Group("/auth")

	// Two limits: per IP against password spraying,
	// per email against guessing one account.
	ipLimiter := api.RateLimiter(
		srv, "auth_ip",
		srv.Cfg().RateLimit.AuthIP)
	emailLimiter := api.KeyedRateLimiter(
		srv.Storage(),
		srv.Cfg().RateLimit.AuthEmail,
		emailRateLimitKey)

	r.Post("/create-user", Guard(s, PermissionAdmin, s.CreateUser))

	r.Get("/validate", Guard(s, PermissionRead, s.Validate))
	r.Post("/login", ipLimiter, emailLimiter, s.LogIn)
	r.Delete("/logout", s.LogOut)

	// TODO: add reset-password, forgot-password and change-password routes
}

type server struct {
	api.Server
}

func emailRateLimitKey(c fiber.Ctx) string {
	type withEmail struct {
		Email string `json:"email" validate:"required,lowercase,email,ascii,max=254"`
	}

	var data withEmail

	// An unparsable or invalid email falls back to the IP, so arbitrary input
	// never becomes a storage key.
	key := c.IP()
	if err := c.Bind().Body(&data); err == nil {
		key = data.Email
	}

	return "auth_limit:" + key
}
