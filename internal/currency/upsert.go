package currency

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type upsertRequest struct {
	validate.CurrencyCodeField

	DisplayName string `json:"displayName" validate:"required,max=100"`
}

// Upsert creates a currency, or renames it if it already exists.
func (s server) Upsert(c fiber.Ctx) error {
	var body upsertRequest
	if err := c.Bind().Body(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	var res database.Currency

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		nextOrder, err := q.GetNextCurrencySortOrder(ctx, true)
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		res, err = q.UpsertCurrency(ctx, database.UpsertCurrencyParams{
			Code:        body.Code,
			DisplayName: body.DisplayName,
			SortOrder:   nextOrder,
		})
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return nil
	})
	if err != nil {
		return err
	}

	return api.Success(c, currencyResFromDB(res))
}
