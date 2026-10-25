package registration

import (
	"context"
	"database/sql"
	"errors"
	"slices"
	"time"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

type cartLine struct {
	Manual      bool       `json:"manual"`
	LineID      string     `json:"lineId"`
	ItemID      string     `json:"itemId"`
	Name        string     `json:"name"`
	AmountCents int64      `json:"amountCents"`
	HintText    string     `json:"hintText,omitempty"`
	CutoffDate  *time.Time `json:"cutoffDate,omitempty"`
}

type cartResponse struct {
	orderLines

	OrderID        string `json:"orderId"`
	FormID         string `json:"formId"`
	Status         string `json:"status"`
	Audience       string `json:"audience"`
	CurrencyCode   string `json:"currencyCode"`
	FirstName      string `json:"firstName"`
	MaskedDocument string `json:"maskedDocument"`
	MaskedEmail    string `json:"maskedEmail"`
	Dietary        string `json:"dietaryPreference"`
	TotalCents     int64  `json:"totalCents"`
	PaidCents      int64  `json:"paidCents"`
	PaymentPending bool   `json:"paymentPending"`
	OnlinePayable  bool   `json:"onlinePayable"`
}

// orderLines are the order's line items, shared by the cart and the staff view.
type orderLines struct {
	Sessions      []cartLine `json:"sessions"`
	Meals         []cartLine `json:"meals"`
	Discounts     []cartLine `json:"discounts"`
	DonationCents int64      `json:"donationCents"`
}

const maskedDocumentVisible = 3

func buildCart(
	ctx context.Context,
	q *database.Queries,
	order database.GetOrderByIdRow,
	sub database.Submission,
	form database.Form,
) (cartResponse, error) {
	orderID := api.UUIDString(order.ID)
	formID := api.UUIDString(sub.FormID)

	lines, err := loadLines(ctx, q, order.ID)
	if err != nil {
		return cartResponse{}, err
	}

	// A discount capped to 0 still applies but would show as "- S/ 0.00".
	lines.Discounts = slices.DeleteFunc(
		lines.Discounts,
		func(line cartLine) bool {
			return line.AmountCents == 0
		},
	)

	sessions, meals, err := submissionItemCounts(ctx, q, sub.ID)
	if err != nil {
		return cartResponse{}, err
	}

	return cartResponse{
		orderLines:     lines,
		OrderID:        orderID,
		FormID:         formID,
		Status:         order.Status,
		Audience:       sub.Audience,
		CurrencyCode:   order.CurrencyCode,
		FirstName:      sub.FirstName,
		MaskedDocument: maskTail(sub.DocumentNumber, maskedDocumentVisible),
		MaskedEmail:    maskEmail(sub.Email),
		Dietary:        sub.DietaryPreference.String,
		TotalCents:     order.TotalAmountCents,
		PaidCents:      order.AmountPaidCents,
		PaymentPending: paymentPending(order.PaymentPendingAt),
		OnlinePayable: onlinePayable(
			order,
			sub,
			form,
			sessions+meals > 0,
		),
	}, nil
}

func loadCart(
	ctx context.Context,
	q *database.Queries,
	orderID []byte,
) (cartResponse, error) {
	order, err := q.GetOrderById(ctx, orderID)
	if err != nil {
		return cartResponse{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	sub, form, err := loadSubmissionAndForm(ctx, q, order)
	if err != nil {
		return cartResponse{}, err
	}

	return buildCart(ctx, q, order, sub, form)
}

//nolint:funlen // Function is simple enough to understand
func loadLines(
	ctx context.Context,
	q *database.Queries,
	orderID []byte,
) (orderLines, error) {
	sessions, err := q.ListOrderSessionItems(ctx, orderID)
	if err != nil {
		return orderLines{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	meals, err := q.ListOrderMealItems(ctx, orderID)
	if err != nil {
		return orderLines{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	discounts, err := q.ListOrderDiscountLines(ctx, orderID)
	if err != nil {
		return orderLines{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	donation, err := q.GetOrderDonationItem(ctx, orderID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return orderLines{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	lines := orderLines{
		Sessions: convertLines(
			sessions,
			func(item database.OrderSessionItem) cartLine {
				return cartLine{
					Manual:      false,
					LineID:      api.UUIDString(item.ID),
					ItemID:      api.UUIDString(item.SessionID),
					Name:        item.NameSnapshot,
					AmountCents: item.UnitPriceCents,
					HintText:    "",
					CutoffDate:  nil,
				}
			},
		),
		Meals: convertLines(
			meals,
			func(item database.OrderMealItem) cartLine {
				return cartLine{
					Manual:      false,
					LineID:      api.UUIDString(item.ID),
					ItemID:      api.UUIDString(item.MealID),
					Name:        item.NameSnapshot,
					AmountCents: item.UnitPriceCents,
					HintText:    "",
					CutoffDate:  nil,
				}
			}),
		Discounts: convertLines(
			discounts,
			func(item database.ListOrderDiscountLinesRow) cartLine {
				return cartLine{
					Manual:      item.DiscountType == discountTypeOther,
					LineID:      api.UUIDString(item.ID),
					ItemID:      api.UUIDString(item.DiscountID),
					Name:        item.NameSnapshot,
					AmountCents: item.AmountCents,
					HintText:    item.HintText,
					CutoffDate:  cutoffDate(item.CutoffDate),
				}
			},
		),
		DonationCents: donation.AmountCents,
	}

	return lines, nil
}

func cutoffDate(unix sql.NullInt64) *time.Time {
	if !unix.Valid {
		return nil
	}

	date := api.FromUnix(unix.Int64)

	return &date
}

func convertLines[T any](rows []T, convert func(T) cartLine) []cartLine {
	out := make([]cartLine, 0, len(rows))

	for _, row := range rows {
		out = append(out, convert(row))
	}

	return out
}
