package forms

import (
	"context"
	"database/sql"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

type createRequest struct {
	CommonFields

	IsEnabled bool `json:"isEnabled"`

	Currencies []string `json:"currencies" validate:"min=1,max=20,unique,dive,iso4217"`
}

// Create creates a form with its currencies.
func (s server) Create(c fiber.Ctx) error {
	var body createRequest
	if err := c.Bind().Body(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	var (
		currencies []database.ListFormCurrenciesRow
		newForm    database.Form
	)

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		formID, err := uuid.NewV7()
		if err != nil {
			return api.Error(api.ErrorTypeUnexpected, err)
		}

		newForm, err = q.CreateForm(ctx, database.CreateFormParams{
			ID:                      formID[:],
			Title:                   body.Title,
			Description:             body.Description,
			IsEnabled:               body.IsEnabled,
			ShowArrivalAndDeparture: body.ShowArrivalAndDeparture,
			ShowInsurance:           body.ShowInsurance,
			ShowEmergencyContact:    body.ShowEmergencyContact,
			DisableSessionSelection: body.DisableSessionSelection,
			DisableMealSelection:    body.DisableMealSelection,
			DisableDonation:         body.DisableDonation,
		})
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		if err = addCurrencies(ctx, q, formID[:], body.Currencies); err != nil {
			return err
		}

		currencies, err = q.ListFormCurrencies(ctx, formID[:])
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return nil
	})
	if err != nil {
		return err
	}

	return api.Success(c, formResFromDB(newForm, currencies))
}

func addCurrencies(
	ctx context.Context,
	q *database.Queries,
	formID []byte,
	codes []string,
) error {
	for _, code := range codes {
		if _, err := q.GetActiveCurrencyByCode(ctx, code); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return api.Error(api.ErrorTypeBadRequest, err)
			}

			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		if err := q.AddFormCurrency(ctx, database.AddFormCurrencyParams{
			FormID:       formID,
			CurrencyCode: code,
		}); err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}
	}

	return nil
}
