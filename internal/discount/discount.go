package discount

import (
	"context"
	"database/sql"
	"slices"
	"time"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
	"dwb-courses/internal/database"
	"dwb-courses/internal/pricing"
	"dwb-courses/internal/validate"
)

// Router registers discount routes.
func Router(router fiber.Router, srv api.Server) {
	s := server{srv}
	r := router.Group("/form/:formId/discount")

	r.Get("", auth.Guard(s, auth.PermissionRead, s.List))

	r.Post("", auth.Guard(s, auth.PermissionWrite, s.Create))
	r.Put("/:id", auth.Guard(s, auth.PermissionWrite, s.Update))
	r.Patch("/order", auth.Guard(s, auth.PermissionWrite, s.UpdateOrder))
	r.Patch("/:id/active", auth.Guard(s, auth.PermissionWrite, s.SetActive))
}

type server struct {
	api.Server
}

type discountType string

const (
	discountTypeOther         discountType = "OTHER"
	discountTypeAllSession    discountType = "ALL_SESSIONS"
	discountTypeEarlyBird     discountType = "EARLY_BIRD"
	discountTypeMealsIncluded discountType = "MEALS_INCLUDED"
)

var validDiscountTypes = []discountType{
	discountTypeOther,
	discountTypeAllSession,
	discountTypeEarlyBird,
	discountTypeMealsIncluded,
}

func (d discountType) IsValid() bool {
	return slices.Contains(validDiscountTypes, d)
}

type discountResponse struct {
	ID           string          `json:"id"`
	DiscountType discountType    `json:"discountType"`
	Name         string          `json:"name"`
	HintText     string          `json:"hintText"`
	SortOrder    int64           `json:"sortOrder"`
	CutoffDate   *time.Time      `json:"cutoffDate,omitempty"`
	IsActive     bool            `json:"isActive"`
	Prices       []pricing.Price `json:"prices"`
}

func discountResFromDB(
	discount database.Discount,
	prices pricing.ByItem,
) discountResponse {
	out := discountResponse{
		ID:           api.UUIDString(discount.ID),
		DiscountType: discountType(discount.DiscountType),
		Name:         discount.Name,
		HintText:     discount.HintText,
		SortOrder:    discount.SortOrder,
		CutoffDate:   nil,
		IsActive:     discount.IsActive,
		Prices:       prices.PricesFor(discount.ID),
	}

	if discount.CutoffDate.Valid {
		parsed := api.FromUnix(discount.CutoffDate.Int64)
		out.CutoffDate = &parsed
	}

	return out
}

// CommonFields holds the discount fields shared by create and update.
type CommonFields struct {
	DiscountType discountType `json:"discountType" validate:"required,oneof=OTHER ALL_SESSIONS EARLY_BIRD MEALS_INCLUDED"`

	Name     string                `json:"name"     validate:"required,max=100"`
	HintText string                `json:"hintText" validate:"max=64"`
	Prices   []validate.PriceField `json:"prices"   validate:"required,max=20,unique=CurrencyCode,dive"`

	//nolint:lll // struct tags cannot be wrapped
	CutoffDate *time.Time `json:"cutoffDate,omitempty" validate:"required_if=DiscountType EARLY_BIRD,excluded_unless=DiscountType EARLY_BIRD"`
}

// bindFields binds the body and rejects a zero amount except for
// MEALS_INCLUDED, whose amount is the selected meals' total (stored as 0).
func bindFields(c fiber.Ctx) (CommonFields, error) {
	var body CommonFields
	if err := c.Bind().Body(&body); err != nil {
		return body, api.Error(api.ErrorTypeBadRequest, err)
	}

	if body.DiscountType == discountTypeMealsIncluded {
		for i := range body.Prices {
			body.Prices[i].AmountCents = 0
		}

		return body, nil
	}

	for _, price := range body.Prices {
		if price.AmountCents < 1 {
			return body, api.Error(api.ErrorTypeBadRequest, nil)
		}
	}

	return body, nil
}

func cutoffToDB(cutoff *time.Time) sql.NullInt64 {
	if cutoff == nil {
		return sql.NullInt64{Int64: 0, Valid: false}
	}

	return sql.NullInt64{Int64: cutoff.UTC().Unix(), Valid: true}
}

func replacePrices(
	ctx context.Context,
	q *database.Queries,
	formID, discountID []byte,
	prices []validate.PriceField,
) error {
	return pricing.ReplacePrices(ctx, q, formID, prices,
		func() error { return q.DeleteDiscountPrices(ctx, discountID) },
		func(price validate.PriceField) error {
			return q.InsertDiscountPrice(
				ctx,
				database.InsertDiscountPriceParams{
					DiscountID:   discountID,
					CurrencyCode: price.CurrencyCode,
					AmountCents:  price.AmountCents,
				},
			)
		},
	)
}
