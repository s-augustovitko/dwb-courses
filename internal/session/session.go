package session

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

// Router registers session routes.
func Router(router fiber.Router, srv api.Server) {
	s := server{srv}
	r := router.Group("/form/:formId/session")

	r.Get("", auth.Guard(s, auth.PermissionRead, s.List))

	r.Post("", auth.Guard(s, auth.PermissionWrite, s.Create))
	r.Put("/:id", auth.Guard(s, auth.PermissionWrite, s.Update))
	r.Patch("/order", auth.Guard(s, auth.PermissionWrite, s.UpdateOrder))

	r.Patch("/:id/active", auth.Guard(s, auth.PermissionWrite, s.SetActive))
}

type server struct {
	api.Server
}

// CommonFields holds the session fields shared by create and update.
type CommonFields struct {
	Name        string                `json:"name"        validate:"required,max=100"`
	HintText    string                `json:"hintText"    validate:"max=64"`
	SessionDate time.Time             `json:"sessionDate" validate:"required"`
	Prices      []validate.PriceField `json:"prices"      validate:"required,max=20,unique=CurrencyCode,dive"`
}

type sessionResponse struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	HintText    string          `json:"hintText"`
	SortOrder   int64           `json:"sortOrder"`
	SessionDate time.Time       `json:"sessionDate"`
	IsActive    bool            `json:"isActive"`
	Prices      []pricing.Price `json:"prices"`
}

func sessionResFromDB(
	session database.Session,
	prices pricing.ByItem,
) sessionResponse {
	return sessionResponse{
		ID:          api.UUIDString(session.ID),
		Name:        session.Name,
		HintText:    session.HintText,
		SortOrder:   session.SortOrder,
		SessionDate: api.FromUnix(session.SessionDate),
		IsActive:    session.IsActive,
		Prices:      prices.PricesFor(session.ID),
	}
}

func replacePrices(
	ctx context.Context,
	q *database.Queries,
	formID, sessionID []byte,
	prices []validate.PriceField,
) error {
	return pricing.ReplacePrices(ctx, q, formID, prices,
		func() error { return q.DeleteSessionPrices(ctx, sessionID) },
		func(price validate.PriceField) error {
			return q.InsertSessionPrice(ctx, database.InsertSessionPriceParams{
				SessionID:    sessionID,
				CurrencyCode: price.CurrencyCode,
				AmountCents:  price.AmountCents,
			})
		},
	)
}
