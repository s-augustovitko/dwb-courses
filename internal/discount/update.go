package discount

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

// Update updates a discount and replaces its prices.
func (s server) Update(c fiber.Ctx) error {
	var params validate.FormItemPath
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	body, err := bindFields(c)
	if err != nil {
		return err
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	err = api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		if err := api.CheckAffectedRows(
			q.UpdateDiscount(ctx, database.UpdateDiscountParams{
				DiscountType: string(body.DiscountType),
				Name:         body.Name,
				HintText:     body.HintText,
				CutoffDate:   cutoffToDB(body.CutoffDate),
				ID:           params.ID[:],
				FormID:       params.FormID[:],
			}),
		); err != nil {
			return err
		}

		return replacePrices(
			ctx,
			q,
			params.FormID[:],
			params.ID[:],
			body.Prices,
		)
	})
	if err != nil {
		return err
	}

	return api.Success(c, true)
}
