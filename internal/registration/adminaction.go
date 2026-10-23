package registration

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

// orderChange is one admin change applied to an editable order inside a
// transaction.
type orderChange func(ctx context.Context, q *database.Queries, order database.GetOrderByIdRow) error

type orderGuard func(order database.GetOrderByIdRow) error

// editOrder runs a change on an editable order (see requireEditable) and
// returns the refreshed staff view.
func (s server) editOrder(
	c fiber.Ctx,
	orderID uuid.UUID,
	change orderChange,
) error {
	return s.changeOrder(c, orderID, requireEditable, change)
}

func (s server) changeOrder(
	c fiber.Ctx,
	orderID uuid.UUID,
	guard orderGuard,
	change orderChange,
) error {
	defer s.locks.lock(orderID.String())()

	ctx, cancel := s.Cfg().MdCtx(c)
	defer cancel()

	var view staffResponse

	err := api.WithTx(ctx, s, s.Logger(c), func(q *database.Queries) error {
		order, err := q.GetOrderById(ctx, orderID[:])
		if err != nil {
			return api.Error(api.ErrorTypeFromSQL(err), err)
		}

		if err := guard(order); err != nil {
			return err
		}

		if err := change(ctx, q, order); err != nil {
			return err
		}

		view, err = staffView(ctx, q, order.ID)

		return err
	})
	if err != nil {
		return err
	}

	if view.BalanceCents < 0 && view.Status != statusCancelled {
		s.Logger(c).Warn().
			Str("order", orderID.String()).
			Int64("balanceCents", view.BalanceCents).
			Msg("payments exceed the order total; refund the difference")
	}

	return api.Success(c, view)
}
