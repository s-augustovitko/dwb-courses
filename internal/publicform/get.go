package publicform

import (
	"context"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/pricing"
	"dwb-courses/internal/validate"
)

// Get returns an enabled form with everything the public page needs to render.
func (s server) Get(c fiber.Ctx) error {
	var params validate.IDPath
	if err := c.Bind().URI(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	q := database.New(s.DB())

	form, err := q.GetVisibleFormById(ctx, params.ID[:])
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	currencies, err := loadCurrencies(ctx, q, form.ID)
	if err != nil {
		return err
	}

	idTypes, err := loadIDTypes(ctx, q)
	if err != nil {
		return err
	}

	offered := offeredCurrencies(currencies)

	sessions, err := loadSessions(ctx, q, form.ID, offered)
	if err != nil {
		return err
	}

	meals, err := loadMeals(ctx, q, form.ID, offered)
	if err != nil {
		return err
	}

	discounts, err := loadDiscounts(ctx, q, form.ID, offered)
	if err != nil {
		return err
	}

	return api.Success(c, formDetail{
		ID:                      params.ID.String(),
		Title:                   form.Title,
		Description:             form.Description,
		ShowArrivalAndDeparture: form.ShowArrivalAndDeparture,
		ShowInsurance:           form.ShowInsurance,
		ShowEmergencyContact:    form.ShowEmergencyContact,
		DisableSessionSelection: form.DisableSessionSelection,
		DisableMealSelection:    form.DisableMealSelection,
		DisableDonation:         form.DisableDonation,
		Currencies:              currencies,
		IDTypes:                 idTypes,
		Sessions:                sessions,
		Meals:                   meals,
		Discounts:               discounts,
	})
}

func loadCurrencies(
	ctx context.Context,
	q *database.Queries,
	formID []byte,
) ([]currencyOption, error) {
	rows, err := q.ListActiveFormCurrencies(ctx, formID)
	if err != nil {
		return nil, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	if len(rows) == 0 {
		return nil, api.Error(api.ErrorTypeNotFound, nil)
	}

	out := make([]currencyOption, 0, len(rows))
	for _, row := range rows {
		out = append(
			out,
			currencyOption{
				Code:        row.Code,
				DisplayName: row.DisplayName,
				IsDefault:   row.IsDefault,
			},
		)
	}

	return out, nil
}

func loadIDTypes(
	ctx context.Context,
	q *database.Queries,
) ([]idTypeOption, error) {
	rows, err := q.ListIdTypes(ctx, true)
	if err != nil {
		return nil, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	out := make([]idTypeOption, 0, len(rows))

	for _, row := range rows {
		out = append(out, idTypeOption{
			ID:           api.UUIDString(row.ID),
			Label:        row.Label,
			AllowLetters: row.AllowLetters,
			MaxLen:       row.MaxLen,
		})
	}

	return out, nil
}

type itemRow struct {
	id       []byte
	name     string
	hint     string
	unixDate int64
}

func loadSessions(
	ctx context.Context,
	q *database.Queries,
	formID []byte,
	offered map[string]bool,
) ([]pricedOption, error) {
	sessions, err := q.ListActiveSessionsByForm(ctx, formID)
	if err != nil {
		return nil, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	prices, err := q.ListSessionPricesByForm(
		ctx,
		database.ListSessionPricesByFormParams{
			FormID:   formID,
			IsActive: true,
		},
	)
	if err != nil {
		return nil, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	items := make([]itemRow, len(sessions))
	for i, session := range sessions {
		items[i] = itemRow{
			session.ID,
			session.Name,
			session.HintText,
			session.SessionDate,
		}
	}

	return buildOptions(items, pricing.SessionPrices(prices), offered), nil
}

func loadMeals(
	ctx context.Context,
	q *database.Queries,
	formID []byte,
	offered map[string]bool,
) ([]pricedOption, error) {
	meals, err := q.ListActiveMealsByForm(ctx, formID)
	if err != nil {
		return nil, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	prices, err := q.ListMealPricesByForm(
		ctx,
		database.ListMealPricesByFormParams{
			FormID:   formID,
			IsActive: true,
		},
	)
	if err != nil {
		return nil, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	items := make([]itemRow, len(meals))
	for i, meal := range meals {
		items[i] = itemRow{meal.ID, meal.Name, meal.HintText, meal.MealDate}
	}

	return buildOptions(items, pricing.MealPrices(prices), offered), nil
}

func offeredCurrencies(currencies []currencyOption) map[string]bool {
	offered := make(map[string]bool, len(currencies))
	for _, currency := range currencies {
		offered[currency.Code] = true
	}

	return offered
}

func offeredPrices(
	prices []pricing.Price,
	offered map[string]bool,
) []pricing.Price {
	out := []pricing.Price{}

	for _, price := range prices {
		if offered[price.CurrencyCode] {
			out = append(out, price)
		}
	}

	return out
}

func buildOptions(
	items []itemRow,
	prices pricing.ByItem,
	offered map[string]bool,
) []pricedOption {
	out := make([]pricedOption, 0, len(items))

	for _, item := range items {
		out = append(out, pricedOption{
			ID: api.UUIDString(item.id), Name: item.name, HintText: item.hint,
			Date:   api.FromUnix(item.unixDate),
			Prices: offeredPrices(prices.PricesFor(item.id), offered),
		})
	}

	return out
}

func loadDiscounts(
	ctx context.Context,
	q *database.Queries,
	formID []byte,
	offered map[string]bool,
) ([]publicDiscount, error) {
	discounts, err := q.ListDiscountsByForm(
		ctx,
		database.ListDiscountsByFormParams{FormID: formID, IsActive: true},
	)
	if err != nil {
		return nil, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	rows, err := q.ListDiscountPricesByForm(
		ctx,
		database.ListDiscountPricesByFormParams{FormID: formID, IsActive: true},
	)
	if err != nil {
		return nil, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	prices := pricing.DiscountPrices(rows)
	now := api.Now().Unix()
	out := make([]publicDiscount, 0, len(discounts))

	for _, discount := range discounts {
		expired := discount.CutoffDate.Valid && now > discount.CutoffDate.Int64
		offeredPrices := offeredPrices(prices.PricesFor(discount.ID), offered)

		if discount.DiscountType == discountTypeOther || expired ||
			len(offeredPrices) == 0 {
			continue
		}

		item := publicDiscount{
			ID:           api.UUIDString(discount.ID),
			DiscountType: discount.DiscountType,
			Name:         discount.Name,
			HintText:     discount.HintText,
			CutoffDate:   nil,
			Prices:       offeredPrices,
		}

		if discount.CutoffDate.Valid {
			cutoff := api.FromUnix(discount.CutoffDate.Int64)
			item.CutoffDate = &cutoff
		}

		out = append(out, item)
	}

	return out, nil
}
