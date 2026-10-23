package user

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type updateRoleRequest struct {
	validate.IDPath

	Role string `json:"role" validate:"required,uppercase,oneof=READER WRITER ADMIN"`
}

// UpdateRole changes a user's role, refusing to demote the last admin.
func (s server) UpdateRole(c fiber.Ctx) error {
	var body updateRoleRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		if err := requireNotLastAdmin(
			ctx,
			q,
			body.ID,
			auth.Role(body.Role),
		); err != nil {
			return err
		}

		if err := q.UpdateUserRole(ctx, database.UpdateUserRoleParams{
			Role: body.Role,
			ID:   body.ID[:],
		}); err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return nil
	})
	if err != nil {
		return err
	}

	return api.Success(c, true)
}
