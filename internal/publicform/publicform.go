package publicform

import (
	"time"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/countries"
	"dwb-courses/internal/pricing"
)

// Router registers the public, unauthenticated form routes.
func Router(router fiber.Router, srv api.Server, catalog *countries.Catalog) {
	s := server{Server: srv, catalog: catalog}
	limit := api.RateLimiter(srv, "form", srv.Cfg().RateLimit.PublicFormIP)

	router.Get("/public/country", limit, s.Countries)

	r := router.Group("/public/form", limit)
	r.Get("", s.List)
	r.Get("/:id", s.Get)
}

type server struct {
	api.Server

	catalog *countries.Catalog
}

type formSummary struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type currencyOption struct {
	Code        string `json:"code"`
	DisplayName string `json:"displayName"`
	IsDefault   bool   `json:"isDefault"`
}

type idTypeOption struct {
	ID           string `json:"id"`
	Label        string `json:"label"`
	AllowLetters bool   `json:"allowLetters"`
	MaxLen       int64  `json:"maxLen"`
}

type pricedOption struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	HintText string          `json:"hintText"`
	Date     time.Time       `json:"date"`
	Prices   []pricing.Price `json:"prices"`
}

const discountTypeOther = "OTHER"

type publicDiscount struct {
	ID           string          `json:"id"`
	DiscountType string          `json:"discountType"`
	Name         string          `json:"name"`
	HintText     string          `json:"hintText"`
	CutoffDate   *time.Time      `json:"cutoffDate,omitempty"`
	Prices       []pricing.Price `json:"prices"`
}

type formDetail struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`

	ShowArrivalAndDeparture bool `json:"showArrivalAndDeparture"`
	ShowInsurance           bool `json:"showInsurance"`
	ShowEmergencyContact    bool `json:"showEmergencyContact"`

	DisableSessionSelection bool `json:"disableSessionSelection"`
	DisableMealSelection    bool `json:"disableMealSelection"`
	DisableDonation         bool `json:"disableDonation"`

	Currencies []currencyOption `json:"currencies"`
	IDTypes    []idTypeOption   `json:"idTypes"`
	Sessions   []pricedOption   `json:"sessions"`
	Meals      []pricedOption   `json:"meals"`
	Discounts  []publicDiscount `json:"discounts"`
}
