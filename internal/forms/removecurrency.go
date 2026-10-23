package forms

import (
	"slices"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type removeCurrencyRequest struct {
	validate.IDPath
	validate.CurrencyCodeField
}

// RemoveCurrency stops offering a currency on a form, which keeps at least one.
func (s server) RemoveCurrency(c fiber.Ctx) error {
	var params removeCurrencyRequest
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		offered, err := q.ListFormCurrencies(ctx, params.ID[:])
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		isOffered := slices.ContainsFunc(
			offered,
			func(row database.ListFormCurrenciesRow) bool {
				return row.CurrencyCode == params.Code
			},
		)
		if !isOffered {
			return api.Error(api.ErrorTypeNotFound, nil)
		}

		if len(offered) == 1 {
			return api.Error(api.ErrorTypeConflict, nil)
		}

		if err := q.RemoveFormCurrency(ctx, database.RemoveFormCurrencyParams{
			FormID:       params.ID[:],
			CurrencyCode: params.Code,
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
