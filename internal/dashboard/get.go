package dashboard

import (
	"context"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"slices"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

const cacheTTL = time.Minute

const cacheKeyPrefix = "dashboard:"

type getParams struct {
	// Comma-separated form ids; empty means every form.
	FormIDs string `query:"formIds" validate:"max=2000"`
}

type earning struct {
	CurrencyCode string `json:"currencyCode"`
	TotalCents   int64  `json:"totalCents"`
	PaidCents    int64  `json:"paidCents"`
}

type sessionCount struct {
	SessionID string `json:"sessionId"`
	Name      string `json:"name"`
	FormTitle string `json:"formTitle"`
	Status    string `json:"status"`
	People    int64  `json:"people"`
}

type mealCount struct {
	MealID            string `json:"mealId"`
	Name              string `json:"name"`
	FormTitle         string `json:"formTitle"`
	Status            string `json:"status"`
	DietaryPreference string `json:"dietaryPreference"`
	People            int64  `json:"people"`
}

type paymentTotal struct {
	CurrencyCode string `json:"currencyCode"`
	CurrencyName string `json:"currencyName"`
	Method       string `json:"method"`
	Status       string `json:"status"`
	AmountCents  int64  `json:"amountCents"`
}

type statusCount struct {
	Status string `json:"status"`
	People int64  `json:"people"`
}

type getResponse struct {
	Earnings []earning      `json:"earnings"`
	Statuses []statusCount  `json:"statuses"`
	Sessions []sessionCount `json:"sessions"`
	Meals    []mealCount    `json:"meals"`
	Payments []paymentTotal `json:"payments"`
}

// Get returns the dashboard totals, cached for a minute per form filter.
func (s server) Get(c fiber.Ctx) error {
	var params getParams
	if err := c.Bind().Query(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	formIDs, err := hexFormIDs(params.FormIDs)
	if err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	cacheKey := cacheKeyPrefix + formIDs.String

	if cached, err := s.Storage().Get(cacheKey); err == nil && cached != nil {
		var res getResponse
		if err := json.Unmarshal(cached, &res); err == nil {
			return api.Success(c, res)
		}
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	res, err := loadResponse(ctx, database.New(s.DB()), formIDs)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	if data, err := json.Marshal(res); err == nil {
		if err := s.Storage().Set(cacheKey, data, cacheTTL); err != nil {
			s.Logger(c).Warn().Err(err).Msg("could not cache dashboard")
		}
	}

	return api.Success(c, res)
}

// hexFormIDs turns the UUID list into the sorted, deduplicated hex list the
// queries match on, so the same forms in any order share a cache entry.
func hexFormIDs(list string) (sql.NullString, error) {
	if list == "" {
		return sql.NullString{String: "", Valid: false}, nil
	}

	ids := []string{}

	for raw := range strings.SplitSeq(list, ",") {
		id, err := uuid.Parse(raw)
		if err != nil {
			return sql.NullString{String: "", Valid: false}, err
		}

		ids = append(ids, hex.EncodeToString(id[:]))
	}

	slices.Sort(ids)

	return sql.NullString{
		String: strings.Join(slices.Compact(ids), ","),
		Valid:  true,
	}, nil
}

func loadResponse(
	ctx context.Context,
	q *database.Queries,
	formIDs sql.NullString,
) (getResponse, error) {
	earningRows, err := q.DashboardEarnings(ctx, formIDs)
	if err != nil {
		return getResponse{}, err
	}

	statusRows, err := q.DashboardStatusCounts(ctx, formIDs)
	if err != nil {
		return getResponse{}, err
	}

	sessionRows, err := q.DashboardSessionCounts(ctx, formIDs)
	if err != nil {
		return getResponse{}, err
	}

	mealRows, err := q.DashboardMealCounts(ctx, formIDs)
	if err != nil {
		return getResponse{}, err
	}

	paymentRows, err := q.DashboardPaymentTotals(ctx, formIDs)
	if err != nil {
		return getResponse{}, err
	}

	return getResponse{
		Earnings: mapRows(earningRows, earningFromDB),
		Statuses: mapRows(statusRows, statusCountFromDB),
		Sessions: mapRows(sessionRows, sessionCountFromDB),
		Meals:    mapRows(mealRows, mealCountFromDB),
		Payments: mapRows(paymentRows, paymentTotalFromDB),
	}, nil
}

func mapRows[Row, Item any](rows []Row, fromDB func(Row) Item) []Item {
	items := make([]Item, 0, len(rows))
	for _, row := range rows {
		items = append(items, fromDB(row))
	}

	return items
}

func earningFromDB(row database.DashboardEarningsRow) earning {
	return earning{
		CurrencyCode: row.CurrencyCode,
		TotalCents:   row.TotalAmountCents,
		PaidCents:    row.AmountPaidCents,
	}
}

func statusCountFromDB(row database.DashboardStatusCountsRow) statusCount {
	return statusCount{
		Status: row.Status,
		People: row.People,
	}
}

func sessionCountFromDB(row database.DashboardSessionCountsRow) sessionCount {
	return sessionCount{
		SessionID: api.UUIDString(row.SessionID),
		Name:      row.Name,
		FormTitle: row.FormTitle,
		Status:    row.Status,
		People:    row.People,
	}
}

func mealCountFromDB(row database.DashboardMealCountsRow) mealCount {
	return mealCount{
		MealID:            api.UUIDString(row.MealID),
		Name:              row.Name,
		FormTitle:         row.FormTitle,
		Status:            row.Status,
		DietaryPreference: row.DietaryPreference.String,
		People:            row.People,
	}
}

func paymentTotalFromDB(row database.DashboardPaymentTotalsRow) paymentTotal {
	return paymentTotal{
		CurrencyCode: row.CurrencyCode,
		CurrencyName: row.CurrencyName,
		Method:       row.Method,
		Status:       row.Status,
		AmountCents:  row.AmountCents,
	}
}
