package idtypes

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

// GetByID returns an id type.
func (s server) GetByID(c fiber.Ctx) error {
	var params validate.IDPath
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	res, err := database.New(s.DB()).GetIdTypeById(ctx, params.ID[:])
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return api.Success(c, idTypeResFromDB(res))
}
