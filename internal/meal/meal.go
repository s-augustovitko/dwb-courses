package meal

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
	"dwb-courses/internal/database"
	"dwb-courses/internal/pricing"
	"dwb-courses/internal/validate"
)

// Router registers meal routes.
func Router(router fiber.Router, srv api.Server) {
	s := server{srv}
	r := router.Group("/form/:formId/meal")

	r.Get("", auth.Guard(s, auth.PermissionRead, s.List))

	r.Post("", auth.Guard(s, auth.PermissionWrite, s.Create))
	r.Put("/:id", auth.Guard(s, auth.PermissionWrite, s.Update))
	r.Patch("/order", auth.Guard(s, auth.PermissionWrite, s.UpdateOrder))

	r.Patch("/:id/active", auth.Guard(s, auth.PermissionWrite, s.SetActive))
}

type server struct {
	api.Server
}

// CommonFields holds the meal fields shared by create and update.
type CommonFields struct {
	Name     string                `json:"name"     validate:"required,max=100"`
	HintText string                `json:"hintText" validate:"max=64"`
	MealDate time.Time             `json:"mealDate" validate:"required"`
	Prices   []validate.PriceField `json:"prices"   validate:"required,max=20,unique=CurrencyCode,dive"`
}

type mealResponse struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	HintText  string          `json:"hintText"`
	SortOrder int64           `json:"sortOrder"`
	MealDate  time.Time       `json:"mealDate"`
	IsActive  bool            `json:"isActive"`
	Prices    []pricing.Price `json:"prices"`
}

func mealResFromDB(meal database.Meal, prices pricing.ByItem) mealResponse {
	return mealResponse{
		ID:        api.UUIDString(meal.ID),
		Name:      meal.Name,
		HintText:  meal.HintText,
		SortOrder: meal.SortOrder,
		MealDate:  api.FromUnix(meal.MealDate),
		IsActive:  meal.IsActive,
		Prices:    prices.PricesFor(meal.ID),
	}
}

func replacePrices(
	ctx context.Context,
	q *database.Queries,
	formID, mealID []byte,
	prices []validate.PriceField,
) error {
	return pricing.ReplacePrices(ctx, q, formID, prices,
		func() error { return q.DeleteMealPrices(ctx, mealID) },
		func(price validate.PriceField) error {
			return q.InsertMealPrice(ctx, database.InsertMealPriceParams{
				MealID:       mealID,
				CurrencyCode: price.CurrencyCode,
				AmountCents:  price.AmountCents,
			})
		},
	)
}
