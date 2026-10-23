package forms

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

// GetByID returns a form with its currencies.
func (s server) GetByID(c fiber.Ctx) error {
	var params validate.IDPath
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	q := database.New(s.DB())

	form, err := q.GetFormById(ctx, params.ID[:])
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	currencies, err := q.ListFormCurrencies(ctx, params.ID[:])
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return api.Success(c, formResFromDB(form, currencies))
}
