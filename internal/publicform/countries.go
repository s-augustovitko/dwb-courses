package publicform

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
)

// Countries returns the country catalog.
func (s server) Countries(c fiber.Ctx) error {
	return api.Success(c, s.catalog.List())
}
