package publicform

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

func formSummaryFromDB(form database.ListEnabledFormTitlesRow) formSummary {
	return formSummary{ID: api.UUIDString(form.ID), Title: form.Title}
}

// List returns the enabled forms.
func (s server) List(c fiber.Ctx) error {
	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	forms, err := database.New(s.DB()).ListEnabledFormTitles(ctx)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	out := make([]formSummary, 0, len(forms))
	for _, form := range forms {
		out = append(out, formSummaryFromDB(form))
	}

	return api.Success(c, out)
}
