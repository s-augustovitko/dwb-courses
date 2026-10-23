package user

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
	"dwb-courses/internal/database"
)

// Router registers user-management routes, all admin-only.
func Router(router fiber.Router, srv api.Server) {
	s := server{srv}
	r := router.Group("/user")

	r.Get("", auth.Guard(s, auth.PermissionAdmin, s.List))
	r.Patch("/:id/role", auth.Guard(s, auth.PermissionAdmin, s.UpdateRole))
	r.Delete("/:id", auth.Guard(s, auth.PermissionAdmin, s.Delete))
}

type server struct {
	api.Server
}

// requireNotLastAdmin returns LAST_ADMIN when the change would leave no admin;
// newRole is "" for a delete.
func requireNotLastAdmin(
	ctx context.Context,
	q *database.Queries,
	userID uuid.UUID,
	newRole auth.Role,
) error {
	target, err := q.GetUserById(ctx, userID[:])
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	if target.Role == string(auth.RoleAdmin) && newRole != auth.RoleAdmin {
		adminCount, err := q.CountUsersByRole(ctx, string(auth.RoleAdmin))
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		if adminCount <= 1 {
			return api.Error(api.ErrorTypeLastAdmin, nil)
		}
	}

	return nil
}
