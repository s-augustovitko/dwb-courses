package registration

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

// QR returns the staff URL to encode for a submitted registration.
func (s server) QR(c fiber.Ctx) error {
	var params TokenPath
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	row, err := orderByToken(ctx, database.New(s.DB()), params.Token)
	if err != nil {
		return err
	}

	if row.Status == statusDraft {
		return api.Error(api.ErrorTypeConflict, nil)
	}

	orderID := api.UUIDString(row.ID)

	return api.Success(c,
		submitResponse{
			OrderID: orderID,
			QRURL:   staffRegistrationURL(s.Cfg(), orderID),
		})
}
