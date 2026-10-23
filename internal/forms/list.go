package forms

import (
	"time"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

type listParams struct {
	Enabled bool `query:"enabled,default:true"`
}

type listResponse struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	IsEnabled bool   `json:"isEnabled"`

	SessionCount    int    `json:"sessionCount"`
	MealCount       int    `json:"mealCount"`
	CurrenciesCount int    `json:"currenciesCount"`
	MainCurrency    string `json:"mainCurrency"`

	UpdatedAt time.Time `json:"updatedAt"`
}

func listResFromDB(data database.ListFormsRow) listResponse {
	return listResponse{
		ID:              api.UUIDString(data.ID),
		Title:           data.Title,
		IsEnabled:       data.IsEnabled,
		SessionCount:    int(data.SessionCount),
		MealCount:       int(data.MealCount),
		CurrenciesCount: int(data.CurrenciesCount),
		MainCurrency:    data.MainCurrency,
		UpdatedAt:       api.FromUnix(data.UpdatedAt),
	}
}

// List returns every form, filtered by enabled state.
func (s server) List(c fiber.Ctx) error {
	var params listParams
	if err := c.Bind().Query(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().SmCtx(c)
	defer cancel()

	forms, err := database.New(s.DB()).ListForms(ctx, params.Enabled)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	out := make([]listResponse, 0, len(forms))
	for _, item := range forms {
		out = append(out, listResFromDB(item))
	}

	return api.Success(c, out)
}
