package idtypes

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

type listParams struct {
	Active bool `query:"active,default:true"`
}

// List returns the id types, filtered by active state.
func (s server) List(c fiber.Ctx) error {
	var params listParams
	if err := c.Bind().Query(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	idTypes, err := database.New(s.DB()).ListIdTypes(ctx, params.Active)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	out := make([]idTypeResponse, 0, len(idTypes))
	for _, item := range idTypes {
		out = append(out, idTypeResFromDB(item))
	}

	return api.Success(c, out)
}
