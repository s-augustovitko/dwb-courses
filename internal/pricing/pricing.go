// Package pricing holds the per-currency price handling shared by sessions,
// meals and discounts.
package pricing

import (
	"context"
	"slices"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

// Price is an amount in cents for one currency, as returned by the API.
type Price struct {
	CurrencyCode string `json:"currencyCode"`
	AmountCents  int64  `json:"amountCents"`
}

// ByItem holds prices keyed by item id.
type ByItem map[string][]Price

// SessionPrices indexes session price rows by session id.
func SessionPrices(rows []database.SessionPrice) ByItem {
	return groupByItem(rows, func(row database.SessionPrice) ([]byte, Price) {
		return row.SessionID, Price{
			CurrencyCode: row.CurrencyCode,
			AmountCents:  row.AmountCents,
		}
	})
}

// MealPrices indexes meal price rows by meal id.
func MealPrices(rows []database.MealPrice) ByItem {
	return groupByItem(rows, func(row database.MealPrice) ([]byte, Price) {
		return row.MealID, Price{
			CurrencyCode: row.CurrencyCode,
			AmountCents:  row.AmountCents,
		}
	})
}

// DiscountPrices indexes discount price rows by discount id.
func DiscountPrices(rows []database.DiscountPrice) ByItem {
	return groupByItem(rows, func(row database.DiscountPrice) ([]byte, Price) {
		return row.DiscountID, Price{
			CurrencyCode: row.CurrencyCode,
			AmountCents:  row.AmountCents,
		}
	})
}

func groupByItem[T any](rows []T, split func(T) ([]byte, Price)) ByItem {
	out := make(ByItem, len(rows))

	for _, row := range rows {
		id, price := split(row)
		out[string(id)] = append(out[string(id)], price)
	}

	return out
}

// PricesFor returns the item's prices, or an empty list.
func (b ByItem) PricesFor(itemID []byte) []Price {
	if prices, ok := b[string(itemID)]; ok {
		return prices
	}

	return []Price{}
}

// ReplacePrices makes prices the item's only prices: deleteAll drops the
// current ones, insertOne adds one. prices must hold exactly one price per
// currency the form
// offers (the request tags make codes unique).
func ReplacePrices(
	ctx context.Context,
	q *database.Queries,
	formID []byte,
	prices []validate.PriceField,
	deleteAll func() error,
	insertOne func(validate.PriceField) error,
) error {
	offered, err := q.ListFormCurrencies(ctx, formID)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	for _, price := range prices {
		isOffered := slices.ContainsFunc(
			offered,
			func(row database.ListFormCurrenciesRow) bool {
				return row.CurrencyCode == price.CurrencyCode
			},
		)
		if !isOffered {
			return api.Error(api.ErrorTypeBadRequest, nil)
		}
	}

	if len(prices) != len(offered) {
		return api.Error(api.ErrorTypeBadRequest, nil)
	}

	if err := deleteAll(); err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	for _, price := range prices {
		if err := insertOne(price); err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}
	}

	return nil
}
