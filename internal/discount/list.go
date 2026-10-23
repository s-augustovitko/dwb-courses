package discount

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

// List returns the form's discounts with their prices, by active state.
func (s server) List(c fiber.Ctx) error {
	var params listParams
	if err := c.Bind().All(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	q := database.New(s.DB())

	discounts, err := q.ListDiscountsByForm(
		ctx,
		database.ListDiscountsByFormParams{
			FormID:   params.FormID[:],
			IsActive: params.Active,
		},
	)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	prices, err := q.ListDiscountPricesByForm(
		ctx,
		database.ListDiscountPricesByFormParams{
			FormID:   params.FormID[:],
			IsActive: params.Active,
		},
	)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	byItem := pricing.DiscountPrices(prices)

	out := make([]discountResponse, 0, len(discounts))
	for _, discount := range discounts {
		out = append(out, discountResFromDB(discount, byItem))
	}

	return api.Success(c, out)
}
