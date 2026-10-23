package session

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/pricing"
	"dwb-courses/internal/validate"
)

type createRequest struct {
	validate.WithFormPath
	CommonFields
}

// Create creates a session with its prices at the end of the active ones.
func (s server) Create(c fiber.Ctx) error {
	var body createRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	var (
		newSession database.Session
		prices     []database.SessionPrice
	)

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		var err error

		newSession, prices, err = insertSession(ctx, q, body)

		return err
	})
	if err != nil {
		return err
	}

	return api.Success(
		c,
		sessionResFromDB(newSession, pricing.SessionPrices(prices)),
	)
}

func insertSession(
	ctx context.Context,
	q *database.Queries,
	body createRequest,
) (database.Session, []database.SessionPrice, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return database.Session{}, nil, api.Error(api.ErrorTypeUnexpected, err)
	}

	nextOrder, err := q.GetNextSessionSortOrder(
		ctx,
		database.GetNextSessionSortOrderParams{
			FormID:   body.FormID[:],
			IsActive: true,
		},
	)
	if err != nil {
		return database.Session{}, nil, api.Error(
			api.ErrorTypeFromSQL(err),
			err,
		)
	}

	created, err := q.CreateSession(ctx, database.CreateSessionParams{
		ID:          id[:],
		FormID:      body.FormID[:],
		Name:        body.Name,
		HintText:    body.HintText,
		SortOrder:   nextOrder,
		SessionDate: body.SessionDate.UTC().Unix(),
	})
	if err != nil {
		return database.Session{}, nil, api.Error(
			api.ErrorTypeFromSQL(err),
			err,
		)
	}

	if err := replacePrices(
		ctx,
		q,
		body.FormID[:],
		created.ID,
		body.Prices,
	); err != nil {
		return database.Session{}, nil, err
	}

	prices, err := q.ListSessionPrices(ctx, created.ID)
	if err != nil {
		return database.Session{}, nil, api.Error(
			api.ErrorTypeFromSQL(err),
			err,
		)
	}

	return created, prices, nil
}
