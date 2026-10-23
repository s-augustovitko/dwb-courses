package auth

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
)

// LogOut revokes the caller's session.
func (s server) LogOut(c fiber.Ctx) error {
	if err := revokeSession(c, s); err != nil {
		return api.Error(api.ErrorTypeUnexpected, err)
	}

	return api.Success(c, true)
}
