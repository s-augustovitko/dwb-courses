package idtypes

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

// Update updates an id type. Existing registrations are not re-checked against
// the new rules.
func (s server) Update(c fiber.Ctx) error {
	var body updateRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	if err := body.validateLetterLength(); err != nil {
		return err
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	if err := api.CheckAffectedRows(
		database.New(s.DB()).UpdateIdType(ctx, database.UpdateIdTypeParams{
			ID:           body.ID[:],
			Label:        body.Label,
			AllowLetters: body.AllowLetters,
			MaxLen:       body.MaxLen,
		}),
	); err != nil {
		return err
	}

	return api.Success(c, true)
}
