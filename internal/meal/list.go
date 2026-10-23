package meal

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/pricing"
	"dwb-courses/internal/validate"
)

type listParams struct {
	validate.WithFormPath

	Active bool `query:"active,default:true"`
}

// List returns the form's meals with their prices, filtered by active state.
func (s server) List(c fiber.Ctx) error {
	var params listParams
	if err := c.Bind().All(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	q := database.New(s.DB())

	meals, err := q.ListMealsByForm(ctx, database.ListMealsByFormParams{
		FormID:   params.FormID[:],
		IsActive: params.Active,
	})
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	prices, err := q.ListMealPricesByForm(
		ctx,
		database.ListMealPricesByFormParams{
			FormID:   params.FormID[:],
			IsActive: params.Active,
		},
	)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	byItem := pricing.MealPrices(prices)

	out := make([]mealResponse, 0, len(meals))
	for _, meal := range meals {
		out = append(out, mealResFromDB(meal, byItem))
	}

	return api.Success(c, out)
}
