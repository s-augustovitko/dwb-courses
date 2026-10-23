package discount

import (
	"bytes"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type setActiveRequest struct {
	validate.FormItemPath

	Active bool `json:"active"`
}

// SetActive activates or deactivates a discount, moving it to the group's end.
func (s server) SetActive(c fiber.Ctx) error {
	var body setActiveRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		current, err := q.GetDiscountById(ctx, body.ID[:])
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		if !bytes.Equal(current.FormID, body.FormID[:]) {
			return api.Error(api.ErrorTypeNotFound, nil)
		}

		nextOrder, err := q.GetNextDiscountSortOrder(
			ctx,
			database.GetNextDiscountSortOrderParams{
				FormID:   body.FormID[:],
				IsActive: body.Active,
			},
		)
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return api.CheckAffectedRows(
			q.SetDiscountActive(ctx, database.SetDiscountActiveParams{
				IsActive:  body.Active,
				SortOrder: nextOrder,
				ID:        body.ID[:],
				FormID:    body.FormID[:],
			}),
		)
	})
	if err != nil {
		return err
	}

	return api.Success(c, true)
}
