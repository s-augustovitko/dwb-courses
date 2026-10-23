package registration

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

var errUnknownStatus = errors.New("unknown order status")

type listParams struct {
	FormID uuid.UUID `query:"formId"`
	// Comma-separated statuses, checked by checkStatuses.
	Status string `query:"status"           validate:"max=100"`
	Search string `query:"q"                validate:"max=100"`
	Limit  int    `query:"limit,default:50" validate:"min=1,max=100"`
	Offset int    `query:"offset"           validate:"min=0,max=1000000"`
}

type listItem struct {
	OrderID        string    `json:"orderId"`
	Status         string    `json:"status"`
	FormID         string    `json:"formId"`
	FormTitle      string    `json:"formTitle"`
	FirstName      string    `json:"firstName"`
	LastName       string    `json:"lastName"`
	DocumentNumber string    `json:"documentNumber"`
	Email          string    `json:"email"`
	CurrencyCode   string    `json:"currencyCode"`
	TotalCents     int64     `json:"totalCents"`
	PaidCents      int64     `json:"paidCents"`
	CreatedAt      time.Time `json:"createdAt"`
}

type listResponse struct {
	Items   []listItem `json:"items"`
	HasMore bool       `json:"hasMore"`
}

// AdminList returns registrations for staff, newest first, with optional form,
// status and text filters.
func (s server) AdminList(c fiber.Ctx) error {
	var params listParams
	if err := c.Bind().Query(&params); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	pageSize := int64(params.Limit)

	args, err := listRegistrationsArgs(params, pageSize)
	if err != nil {
		return err
	}

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	rows, err := database.New(s.DB()).ListRegistrations(ctx, args)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	hasMore := int64(len(rows)) > pageSize
	if hasMore {
		rows = rows[:pageSize]
	}

	items := make([]listItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, listItemFromDB(row))
	}

	return api.Success(c, listResponse{Items: items, HasMore: hasMore})
}

func listRegistrationsArgs(
	params listParams,
	pageSize int64,
) (database.ListRegistrationsParams, error) {
	args := database.ListRegistrationsParams{
		FormID: nil,
		Statuses: sql.NullString{
			String: params.Status,
			Valid:  params.Status != "",
		},
		Search:     sql.NullString{String: "", Valid: false},
		PageLimit:  pageSize + 1,
		PageOffset: int64(params.Offset),
	}

	if params.FormID != uuid.Nil {
		args.FormID = params.FormID[:]
	}

	if args.Statuses.Valid {
		if err := checkStatuses(params.Status); err != nil {
			return args, err
		}
	}

	if text := strings.TrimSpace(params.Search); text != "" {
		args.Search = sql.NullString{String: text, Valid: true}
	}

	return args, nil
}

var orderStatuses = map[string]bool{
	statusDraft:             true,
	statusPending:           true,
	statusPartiallyPaid:     true,
	statusPaid:              true,
	statusPartiallyRefunded: true,
	statusRefunded:          true,
	statusCancelled:         true,
}

func checkStatuses(list string) error {
	for status := range strings.SplitSeq(list, ",") {
		if !orderStatuses[status] {
			return api.Error(api.ErrorTypeBadRequest, errUnknownStatus)
		}
	}

	return nil
}

func listItemFromDB(row database.ListRegistrationsRow) listItem {
	return listItem{
		OrderID:        api.UUIDString(row.OrderID),
		Status:         row.Status,
		FormID:         api.UUIDString(row.FormID),
		FormTitle:      row.FormTitle,
		FirstName:      row.FirstName,
		LastName:       row.LastName,
		DocumentNumber: row.DocumentNumber,
		Email:          row.Email,
		CurrencyCode:   row.CurrencyCode,
		TotalCents:     row.TotalAmountCents,
		PaidCents:      row.AmountPaidCents,
		CreatedAt:      api.FromUnix(row.CreatedAt),
	}
}
