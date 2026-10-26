package dashboard

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
)

// Router registers dashboard routes.
func Router(router fiber.Router, srv api.Server) {
	s := server{srv}

	router.Get("/dashboard", auth.Guard(s, auth.PermissionRead, s.Get))
}

type server struct {
	api.Server
}
