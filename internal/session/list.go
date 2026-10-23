package session

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/pricing"
	"dwb-courses/internal/validate"
)

type listParams struct {
	validate.WithFormPath

	Active bool `query:"active,default:true"`
}

// List returns the form's sessions with their prices, filtered by active state.
func (s server) List(c fiber.Ctx) error {
	var params listParams
	if err := c.Bind().All(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	q := database.New(s.DB())

	sessions, err := q.ListSessionsByForm(
		ctx,
		database.ListSessionsByFormParams{
			FormID:   params.FormID[:],
			IsActive: params.Active,
		},
	)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	prices, err := q.ListSessionPricesByForm(
		ctx,
		database.ListSessionPricesByFormParams{
			FormID:   params.FormID[:],
			IsActive: params.Active,
		},
	)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	byItem := pricing.SessionPrices(prices)

	out := make([]sessionResponse, 0, len(sessions))
	for _, session := range sessions {
		out = append(out, sessionResFromDB(session, byItem))
	}

	return api.Success(c, out)
}
