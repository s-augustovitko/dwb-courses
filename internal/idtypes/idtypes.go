package idtypes

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

// Router registers id type routes.
func Router(router fiber.Router, srv api.Server) {
	s := server{srv}
	r := router.Group("/id-type")

	r.Get("", auth.Guard(s, auth.PermissionRead, s.List))
	r.Get("/:id", auth.Guard(s, auth.PermissionRead, s.GetByID))

	r.Post("", auth.Guard(s, auth.PermissionWrite, s.Create))
	r.Put("/:id", auth.Guard(s, auth.PermissionWrite, s.Update))
	r.Patch("/order", auth.Guard(s, auth.PermissionWrite, s.UpdateOrder))

	r.Patch("/:id/active", auth.Guard(s, auth.PermissionAdmin, s.SetActive))
}

type server struct {
	api.Server
}

// CommonFields holds the id-type fields shared by create and update.
type CommonFields struct {
	Label        string `json:"label"        validate:"required,max=100"`
	MaxLen       int64  `json:"maxLen"       validate:"min=1,max=32"`
	AllowLetters bool   `json:"allowLetters"`
}

// validateLetterLength rejects an id type whose max length can't hold a
// lettered document.
func (f CommonFields) validateLetterLength() error {
	if f.AllowLetters && f.MaxLen < validate.MinLetterDocumentLen {
		return api.Error(api.ErrorTypeBadRequest, nil)
	}

	return nil
}

type idTypeResponse struct {
	ID           string `json:"id"`
	Label        string `json:"label"`
	SortOrder    int64  `json:"sortOrder"`
	AllowLetters bool   `json:"allowLetters"`
	MaxLen       int64  `json:"maxLen"`
}

func idTypeResFromDB(idType database.IDType) idTypeResponse {
	return idTypeResponse{
		ID:           api.UUIDString(idType.ID),
		Label:        idType.Label,
		SortOrder:    idType.SortOrder,
		AllowLetters: idType.AllowLetters,
		MaxLen:       idType.MaxLen,
	}
}
