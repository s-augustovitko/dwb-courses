package currency

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
	"dwb-courses/internal/database"
)

// Router registers currency-management routes.
func Router(router fiber.Router, srv api.Server) {
	s := server{srv}
	r := router.Group("/currency")

	r.Get("", auth.Guard(s, auth.PermissionRead, s.List))

	r.Post("", auth.Guard(s, auth.PermissionWrite, s.Upsert))
	r.Patch("/order", auth.Guard(s, auth.PermissionWrite, s.UpdateOrder))

	r.Patch("/:code/active", auth.Guard(s, auth.PermissionAdmin, s.SetActive))
	r.Patch("/:code/default", auth.Guard(s, auth.PermissionAdmin, s.SetDefault))
}

type server struct {
	api.Server
}

type currencyResponse struct {
	Code        string `json:"code"`
	DisplayName string `json:"displayName"`
	SortOrder   int64  `json:"sortOrder"`
	IsDefault   bool   `json:"isDefault"`
}

func currencyResFromDB(currency database.Currency) currencyResponse {
	return currencyResponse{
		Code:        currency.Code,
		DisplayName: currency.DisplayName,
		SortOrder:   currency.SortOrder,
		IsDefault:   currency.IsDefault,
	}
}
