package forms

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type updateRequest struct {
	validate.IDPath
	CommonFields
}

// Update updates a form's details.
func (s server) Update(c fiber.Ctx) error {
	var body updateRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	if err := api.CheckAffectedRows(
		database.New(s.DB()).UpdateForm(ctx, database.UpdateFormParams{
			ID:                      body.ID[:],
			Title:                   body.Title,
			Description:             body.Description,
			ShowArrivalAndDeparture: body.ShowArrivalAndDeparture,
			ShowInsurance:           body.ShowInsurance,
			ShowEmergencyContact:    body.ShowEmergencyContact,
			DisableSessionSelection: body.DisableSessionSelection,
			DisableMealSelection:    body.DisableMealSelection,
			DisableDonation:         body.DisableDonation,
		}),
	); err != nil {
		return err
	}

	return api.Success(c, true)
}
