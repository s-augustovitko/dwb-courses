package currency

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type setActiveRequest struct {
	validate.CurrencyCodeField

	Active bool `json:"active"`
}

// SetActive activates or deactivates a currency; the default stays active.
func (s server) SetActive(c fiber.Ctx) error {
	var body setActiveRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		current, err := q.GetCurrencyByCode(ctx, body.Code)
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		if current.IsDefault && !body.Active {
			return api.Error(api.ErrorTypeConflict, nil)
		}

		nextOrder, err := q.GetNextCurrencySortOrder(ctx, body.Active)
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		if !body.Active {
			if err := q.RemoveFormCurrenciesByCurrencyCode(
				ctx,
				body.Code,
			); err != nil {
				return api.Error(api.ErrorTypeFromSQL(err), err)
			}
		}

		if err := q.SetCurrencyActive(ctx, database.SetCurrencyActiveParams{
			IsActive:  body.Active,
			SortOrder: nextOrder,
			Code:      body.Code,
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
