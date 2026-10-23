package registration

import (
	"errors"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/auth"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

var errAboveNetPaid = errors.New("refund above the net amount paid")

type refundRequest struct {
	validate.IDPath

	AmountCents int64  `json:"amountCents" validate:"required,min=1,max=100000000"`
	Note        string `json:"note"        validate:"required,min=3,max=500"`
}

// AdminAddRefund records a refund up to the net received, also on a cancelled
// order. No money moves through any gateway.
func (s server) AdminAddRefund(c fiber.Ctx) error {
	var body refundRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	session, ok := auth.GetSessionLocals(c)
	if !ok {
		return api.Error(api.ErrorTypeUnauthorized, nil)
	}

	build := func(order database.GetOrderByIdRow) (paymentRow, error) {
		if body.AmountCents > order.AmountPaidCents {
			return paymentRow{}, api.Error(
				api.ErrorTypeBadRequest,
				errAboveNetPaid,
			)
		}

		return paymentRow{
			method: methodRefund, amountCents: body.AmountCents,
			note: &body.Note, reference: nil, userID: session.UserID,
		}, nil
	}

	return s.recordPayment(c, body.ID, requireRefundable, build)
}
