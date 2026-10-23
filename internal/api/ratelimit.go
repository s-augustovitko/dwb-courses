package api

import (
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
)

// RateLimiter limits requests per client IP for the named public route group.
func RateLimiter(s Server, name string, maxRequests int) fiber.Handler {
	return KeyedRateLimiter(s.Storage(), maxRequests, func(c fiber.Ctx) string {
		return "public:" + name + ":" + c.IP()
	})
}

// GlobalRateLimiter caps the total requests per minute for the named route
// group across all clients.
func GlobalRateLimiter(s Server, name string, maxRequests int) fiber.Handler {
	return KeyedRateLimiter(s.Storage(), maxRequests, func(_ fiber.Ctx) string {
		return "public:" + name + ":global"
	})
}

// KeyedRateLimiter limits requests per minute by key.
func KeyedRateLimiter(
	storage fiber.Storage,
	maxRequests int,
	key func(fiber.Ctx) string,
) fiber.Handler {
	return limiter.New(
		//exhaustruct:ignore
		limiter.Config{
			Storage:    storage,
			Max:        maxRequests,
			Expiration: time.Minute,
			LimitReached: func(_ fiber.Ctx) error {
				return Error(ErrorTypeRateLimit, nil)
			},
			KeyGenerator: key,
		})
}
