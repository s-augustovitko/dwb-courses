package discount

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/pricing"
	"dwb-courses/internal/validate"
)

// Create creates a discount with its prices at the end of the active ones.
func (s server) Create(c fiber.Ctx) error {
	var params validate.WithFormPath
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	body, err := bindFields(c)
	if err != nil {
		return err
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	var (
		newDiscount database.Discount
		prices      []database.DiscountPrice
	)

	err = api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		var err error

		newDiscount, prices, err = insertDiscount(ctx, q, params.FormID, body)

		return err
	})
	if err != nil {
		return err
	}

	return api.Success(
		c,
		discountResFromDB(newDiscount, pricing.DiscountPrices(prices)),
	)
}

func insertDiscount(
	ctx context.Context,
	q *database.Queries,
	formID uuid.UUID,
	body CommonFields,
) (database.Discount, []database.DiscountPrice, error) {
	nextOrder, err := q.GetNextDiscountSortOrder(
		ctx,
		database.GetNextDiscountSortOrderParams{
			FormID:   formID[:],
			IsActive: true,
		},
	)
	if err != nil {
		return database.Discount{}, nil, api.Error(
			api.ErrorTypeFromSQL(err),
			err,
		)
	}

	id, err := uuid.NewV7()
	if err != nil {
		return database.Discount{}, nil, api.Error(api.ErrorTypeUnexpected, err)
	}

	created, err := q.CreateDiscount(ctx, database.CreateDiscountParams{
		ID:           id[:],
		FormID:       formID[:],
		DiscountType: string(body.DiscountType),
		Name:         body.Name,
		HintText:     body.HintText,
		SortOrder:    nextOrder,
		CutoffDate:   cutoffToDB(body.CutoffDate),
	})
	if err != nil {
		return database.Discount{}, nil, api.Error(
			api.ErrorTypeFromSQL(err),
			err,
		)
	}

	if err := replacePrices(
		ctx,
		q,
		formID[:],
		created.ID,
		body.Prices,
	); err != nil {
		return database.Discount{}, nil, err
	}

	prices, err := q.ListDiscountPrices(ctx, created.ID)
	if err != nil {
		return database.Discount{}, nil, api.Error(
			api.ErrorTypeFromSQL(err),
			err,
		)
	}

	return created, prices, nil
}
