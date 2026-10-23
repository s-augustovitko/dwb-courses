package idtypes

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

// Create creates an id type at the end of the active id types.
func (s server) Create(c fiber.Ctx) error {
	var body CommonFields
	if err := c.Bind().Body(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	if err := body.validateLetterLength(); err != nil {
		return err
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	var res database.IDType

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		id, err := uuid.NewV7()
		if err != nil {
			return api.Error(api.ErrorTypeUnexpected, err)
		}

		nextOrder, err := q.GetNextIdTypeSortOrder(ctx, true)
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		res, err = q.CreateIdType(ctx, database.CreateIdTypeParams{
			ID:           id[:],
			Label:        body.Label,
			SortOrder:    nextOrder,
			AllowLetters: body.AllowLetters,
			MaxLen:       body.MaxLen,
		})
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		return nil
	})
	if err != nil {
		return err
	}

	return api.Success(c, idTypeResFromDB(res))
}
