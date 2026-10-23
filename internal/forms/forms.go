package forms

import (
	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
	"dwb-courses/internal/database"
)

// Router registers form routes.
func Router(router fiber.Router, srv api.Server) {
	s := server{srv}
	r := router.Group("/form")

	r.Get("", auth.Guard(s, auth.PermissionRead, s.List))
	r.Get("/:id", auth.Guard(s, auth.PermissionRead, s.GetByID))

	r.Post("", auth.Guard(s, auth.PermissionWrite, s.Create))
	r.Put("/:id", auth.Guard(s, auth.PermissionWrite, s.Update))
	r.Patch("/:id/enabled", auth.Guard(s, auth.PermissionWrite, s.SetEnabled))

	r.Put(
		"/:id/currencies/:code",
		auth.Guard(s, auth.PermissionAdmin, s.AddCurrency),
	)
	r.Delete(
		"/:id/currencies/:code",
		auth.Guard(s, auth.PermissionAdmin, s.RemoveCurrency),
	)
}

type server struct {
	api.Server
}

// CommonFields holds the form fields shared by create and update.
type CommonFields struct {
	Title       string `json:"title"       validate:"required,max=200"`
	Description string `json:"description" validate:"max=2000"`

	ShowArrivalAndDeparture bool `json:"showArrivalAndDeparture"`
	ShowInsurance           bool `json:"showInsurance"`
	ShowEmergencyContact    bool `json:"showEmergencyContact"`

	DisableSessionSelection bool `json:"disableSessionSelection"`
	DisableMealSelection    bool `json:"disableMealSelection"`
	DisableDonation         bool `json:"disableDonation"`
}

type currencyRefResponse struct {
	Code        string `json:"code"`
	DisplayName string `json:"displayName"`
}

type formResponse struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`

	ShowArrivalAndDeparture bool `json:"showArrivalAndDeparture"`
	ShowInsurance           bool `json:"showInsurance"`
	ShowEmergencyContact    bool `json:"showEmergencyContact"`

	DisableSessionSelection bool `json:"disableSessionSelection"`
	DisableMealSelection    bool `json:"disableMealSelection"`
	DisableDonation         bool `json:"disableDonation"`

	IsEnabled bool `json:"isEnabled"`

	Currencies []currencyRefResponse `json:"currencies"`
}

func formResFromDB(
	form database.Form,
	currencies []database.ListFormCurrenciesRow,
) formResponse {
	out := formResponse{
		ID:                      api.UUIDString(form.ID),
		Title:                   form.Title,
		Description:             form.Description,
		ShowArrivalAndDeparture: form.ShowArrivalAndDeparture,
		ShowInsurance:           form.ShowInsurance,
		ShowEmergencyContact:    form.ShowEmergencyContact,
		DisableSessionSelection: form.DisableSessionSelection,
		DisableMealSelection:    form.DisableMealSelection,
		DisableDonation:         form.DisableDonation,
		IsEnabled:               form.IsEnabled,
		Currencies: make(
			[]currencyRefResponse,
			0,
			len(currencies),
		),
	}

	for _, currency := range currencies {
		out.Currencies = append(out.Currencies, currencyRefResponse{
			Code:        currency.CurrencyCode,
			DisplayName: currency.DisplayName,
		})
	}

	return out
}
