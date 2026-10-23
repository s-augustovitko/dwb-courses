package idtypes

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type setActiveRequest struct {
	validate.IDPath

	Active bool `json:"active"`
}

// SetActive activates or deactivates an id type, moving it to the group's end.
func (s server) SetActive(c fiber.Ctx) error {
	var body setActiveRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		current, err := q.GetIdTypeById(ctx, body.ID[:])
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		if current.IsActive == body.Active {
			return nil
		}

		nextOrder, err := q.GetNextIdTypeSortOrder(ctx, body.Active)
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		if err := q.SetIdTypeActive(ctx, database.SetIdTypeActiveParams{
			IsActive:  body.Active,
			SortOrder: nextOrder,
			ID:        body.ID[:],
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
