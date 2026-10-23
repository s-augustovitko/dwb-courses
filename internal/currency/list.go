package currency

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

type listParams struct {
	Active bool `query:"active,default:true"`
}

// List returns the currencies, filtered by active state.
func (s server) List(c fiber.Ctx) error {
	var params listParams
	if err := c.Bind().Query(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	currencies, err := database.New(s.DB()).ListCurrencies(ctx, params.Active)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	out := make([]currencyResponse, 0, len(currencies))
	for _, currency := range currencies {
		out = append(out, currencyResFromDB(currency))
	}

	return api.Success(c, out)
}
