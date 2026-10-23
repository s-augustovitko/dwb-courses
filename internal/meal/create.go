package meal

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

// Create creates a meal with its prices at the end of the form's active meals.
func (s server) Create(c fiber.Ctx) error {
	var body createRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	var (
		newMeal database.Meal
		prices  []database.MealPrice
	)

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		var err error

		newMeal, prices, err = insertMeal(ctx, q, body)

		return err
	})
	if err != nil {
		return err
	}

	return api.Success(c, mealResFromDB(newMeal, pricing.MealPrices(prices)))
}

func insertMeal(
	ctx context.Context,
	q *database.Queries,
	body createRequest,
) (database.Meal, []database.MealPrice, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return database.Meal{}, nil, api.Error(api.ErrorTypeUnexpected, err)
	}

	nextOrder, err := q.GetNextMealSortOrder(
		ctx,
		database.GetNextMealSortOrderParams{
			FormID:   body.FormID[:],
			IsActive: true,
		},
	)
	if err != nil {
		return database.Meal{}, nil, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	created, err := q.CreateMeal(ctx, database.CreateMealParams{
		ID:        id[:],
		FormID:    body.FormID[:],
		Name:      body.Name,
		HintText:  body.HintText,
		SortOrder: nextOrder,
		MealDate:  body.MealDate.UTC().Unix(),
	})
	if err != nil {
		return database.Meal{}, nil, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	if err := replacePrices(
		ctx,
		q,
		body.FormID[:],
		created.ID,
		body.Prices,
	); err != nil {
		return database.Meal{}, nil, err
	}

	prices, err := q.ListMealPrices(ctx, created.ID)
	if err != nil {
		return database.Meal{}, nil, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return created, prices, nil
}
