package registration

import (
	"context"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

const methodRefund = "REFUND"

var errAboveBalance = errors.New("payment above the balance")

type paymentRequest struct {
	validate.IDPath

	Method            string  `json:"method"            validate:"required,oneof=CASH BANK_TRANSFER YAPE PLIN OTHER"`
	AmountCents       int64   `json:"amountCents"       validate:"required,min=1,max=100000000"`
	Note              *string `json:"note"              validate:"omitempty,max=500"`
	ProviderReference *string `json:"providerReference" validate:"omitempty,max=100"`
}

type paymentRow struct {
	method      string
	amountCents int64
	note        *string
	reference   *string
	userID      uuid.UUID
}

// AdminAddPayment records a payment made outside the website; it cannot exceed
// the balance.
func (s server) AdminAddPayment(c fiber.Ctx) error {
	var body paymentRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	session, ok := auth.GetSessionLocals(c)
	if !ok {
		return api.Error(api.ErrorTypeUnauthorized, nil)
	}

	build := func(order database.GetOrderByIdRow) (paymentRow, error) {
		if body.AmountCents > order.TotalAmountCents-order.AmountPaidCents {
			return paymentRow{},
				api.Error(api.ErrorTypeBadRequest, errAboveBalance)
		}

		return paymentRow{
			method:      body.Method,
			amountCents: body.AmountCents,
			note:        body.Note,
			reference:   body.ProviderReference,
			userID:      session.UserID,
		}, nil
	}

	return s.recordPayment(c, body.ID, requireEditable, build)
}

func (s server) recordPayment(
	c fiber.Ctx,
	orderID uuid.UUID,
	guard orderGuard,
	build func(order database.GetOrderByIdRow) (paymentRow, error),
) error {
	return s.changeOrder(
		c,
		orderID,
		guard,
		func(ctx context.Context, q *database.Queries, order database.GetOrderByIdRow) error {
			row, err := build(order)
			if err != nil {
				return err
			}

			if err := insertPayment(ctx, q, order.ID, row); err != nil {
				return err
			}

			_, err = refreshStatus(ctx, q, order.ID)

			return err
		},
	)
}

func insertPayment(
	ctx context.Context,
	q *database.Queries,
	orderID []byte,
	row paymentRow,
) error {
	id, err := uuid.NewV7()
	if err != nil {
		return api.Error(api.ErrorTypeUnexpected, err)
	}

	_, err = q.CreateManualPayment(ctx, database.CreateManualPaymentParams{
		ID:                id[:],
		OrderID:           orderID,
		AmountCents:       row.amountCents,
		Method:            row.method,
		ProviderReference: nullString(row.reference),
		RecordedBy:        row.userID[:],
		Note:              nullString(row.note),
	})
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return nil
}
