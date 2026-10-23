package user

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

// Delete deletes a user, refusing to delete the last admin.
func (s server) Delete(c fiber.Ctx) error {
	var params validate.IDPath
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		if err := requireNotLastAdmin(ctx, q, params.ID, ""); err != nil {
			return err
		}

		if err := q.DeleteUser(ctx, params.ID[:]); err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return nil
	})
	if err != nil {
		return err
	}

	return api.Success(c, true)
}
