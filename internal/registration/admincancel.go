package registration

import (
	"context"

	"github.com/gofiber/fiber/v3"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/validate"
)

type cancelRequest struct {
	validate.IDPath

	ConfirmReceivedMoney bool `json:"confirmReceivedMoney"`
}

// AdminCancel cancels a registration and frees its document; money received
// needs explicit confirmation and can still be refunded afterwards.
func (s server) AdminCancel(c fiber.Ctx) error {
	var body cancelRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	return s.editOrder(
		c,
		body.ID,
		func(ctx context.Context, q *database.Queries, order database.GetOrderByIdRow) error {
			if order.AmountPaidCents > 0 && !body.ConfirmReceivedMoney {
				return api.Error(api.ErrorTypeConflict, nil)
			}

			return markCancelled(ctx, q, order)
		},
	)
}

// markCancelled sets the terminal status, drops the public link and frees the
// document key.
func markCancelled(
	ctx context.Context,
	q *database.Queries,
	order database.GetOrderByIdRow,
) error {
	err := q.SetOrderStatus(
		ctx,
		database.SetOrderStatusParams{Status: statusCancelled, ID: order.ID},
	)
	if err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	if err := q.ClearOrderTokenHash(ctx, order.ID); err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	if err := q.CancelSubmission(ctx, order.SubmissionID); err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return nil
}
