package forms

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type addCurrencyRequest struct {
	validate.IDPath
	validate.CurrencyCodeField
}

// AddCurrency offers an active currency on a form; adding an offered one again
// is a no-op.
func (s server) AddCurrency(c fiber.Ctx) error {
	var params addCurrencyRequest
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		if _, err := q.GetFormById(ctx, params.ID[:]); err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return addCurrencies(ctx, q, params.ID[:], []string{params.Code})
	})
	if err != nil {
		return err
	}

	return api.Success(c, true)
}
