package meal

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type updateRequest struct {
	validate.FormItemPath
	CommonFields
}

// Update updates a meal and replaces its prices.
func (s server) Update(c fiber.Ctx) error {
	var body updateRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		if err := api.CheckAffectedRows(
			q.UpdateMeal(ctx, database.UpdateMealParams{
				Name:     body.Name,
				HintText: body.HintText,
				MealDate: body.MealDate.UTC().Unix(),
				ID:       body.ID[:],
				FormID:   body.FormID[:],
			}),
		); err != nil {
			return err
		}

		return replacePrices(ctx, q, body.FormID[:], body.ID[:], body.Prices)
	})
	if err != nil {
		return err
	}

	return api.Success(c, true)
}
