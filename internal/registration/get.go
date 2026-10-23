package registration

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

// Get returns the cart for a token, with the registrant's data masked.
func (s server) Get(c fiber.Ctx) error {
	var params TokenPath
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	q := database.New(s.DB())

	row, err := orderByToken(ctx, q, params.Token)
	if err != nil {
		return err
	}

	sub, form, err := loadSubmissionAndForm(ctx, q, row)
	if err != nil {
		return err
	}

	cart, err := buildCart(ctx, q, row, sub, form)
	if err != nil {
		return err
	}

	return api.Success(c, cart)
}
