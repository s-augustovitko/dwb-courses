package currency

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

// SetDefault makes an active currency the default. Forms that do not offer it
// become foreigner-only: LOCAL registrants pay in the default currency.
func (s server) SetDefault(c fiber.Ctx) error {
	var params validate.CurrencyCodeField
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		if _, err := q.GetActiveCurrencyByCode(ctx, params.Code); err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		if err := q.ClearDefaultCurrency(ctx); err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		if err := q.SetDefaultCurrency(ctx, params.Code); err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return nil
	})
	if err != nil {
		return err
	}

	return api.Success(c, true)
}
