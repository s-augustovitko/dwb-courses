package session

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type updateOrderRequest struct {
	validate.WithFormPath

	Items []validate.OrderItem `json:"items" validate:"min=2,max=500,unique=Order,unique=ID,dive"`
}

// UpdateOrder sets the sort order of the form's active sessions; the request
// must list all of them.
func (s server) UpdateOrder(c fiber.Ctx) error {
	var body updateOrderRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		active, err := q.ListSessionsByForm(
			ctx,
			database.ListSessionsByFormParams{
				FormID:   body.FormID[:],
				IsActive: true,
			},
		)
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		if len(active) != len(body.Items) {
			return api.Error(api.ErrorTypeBadRequest, nil)
		}

		for _, item := range body.Items {
			if err := api.CheckAffectedRows(
				q.SetSessionOrder(ctx, database.SetSessionOrderParams{
					SortOrder: item.Order,
					ID:        item.ID[:],
					FormID:    body.FormID[:],
				}),
			); err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return err
	}

	return api.Success(c, true)
}
