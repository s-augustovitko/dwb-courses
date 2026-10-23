package auth

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
)

type validateResponse struct {
	ID          string       `json:"id"`
	Permissions []Permission `json:"permissions"`
}

// Validate returns the current session's identity and permissions.
func (s server) Validate(c fiber.Ctx) error {
	user, ok := GetSessionLocals(c)
	if !ok {
		return api.Error(api.ErrorTypeUnauthorized, nil)
	}

	return api.Success(c, validateResponse{
		ID:          user.UserID.String(),
		Permissions: user.Role.getPermissions(),
	})
}
