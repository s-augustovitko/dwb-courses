package forms

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type setEnabledRequest struct {
	validate.IDPath

	Enabled bool `json:"enabled"`
}

// SetEnabled enables or disables a form.
func (s server) SetEnabled(c fiber.Ctx) error {
	var body setEnabledRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	if err := api.CheckAffectedRows(
		database.New(s.DB()).SetFormEnabled(ctx, database.SetFormEnabledParams{
			ID:        body.ID[:],
			IsEnabled: body.Enabled,
		}),
	); err != nil {
		return err
	}

	return api.Success(c, true)
}
