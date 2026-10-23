package registration

import (
	"context"
	"database/sql"
	"slices"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

// Order statuses; the SQL queries and the orders.status CHECK use the same
// literals.
const (
	statusDraft             = "DRAFT"
	statusPending           = "PENDING"
	statusPartiallyPaid     = "PARTIALLY_PAID"
	statusPaid              = "PAID"
	statusPartiallyRefunded = "PARTIALLY_REFUNDED"
	statusRefunded          = "REFUNDED"
	statusCancelled         = "CANCELLED"
)

// deriveStatus maps the order totals to its status; CANCELLED and DRAFT are
// handled by the callers. REFUNDED and PARTIALLY_REFUNDED are final for the
// registrant: the public pay flow and the reminders skip them, staff can still
// edit them.
func deriveStatus(
	totalCents, paidCents int64,
	hasPayments, hasRefunds bool,
) string {
	switch {
	case hasPayments && paidCents <= 0:
		return statusRefunded
	case totalCents <= 0:
		return statusPaid
	case paidCents <= 0:
		return statusPending
	case paidCents < totalCents && hasRefunds:
		return statusPartiallyRefunded
	case paidCents < totalCents:
		return statusPartiallyPaid
	default:
		return statusPaid
	}
}

func requireDraft(status string, pendingAt sql.NullInt64) error {
	if status != statusDraft || paymentPending(pendingAt) {
		return api.Error(api.ErrorTypeConflict, nil)
	}

	return nil
}

// Not cancelled, Not Draft and Not Payment Pending.
func requireEditable(order database.GetOrderByIdRow) error {
	if order.Status == statusCancelled {
		return api.Error(api.ErrorTypeConflict, nil)
	}

	return requireRefundable(order)
}

func requireRefundable(order database.GetOrderByIdRow) error {
	if order.Status == statusDraft || paymentPending(order.PaymentPendingAt) {
		return api.Error(api.ErrorTypeConflict, nil)
	}

	return nil
}

// refreshStatus stores the status from the current items and payments
// and returns the order.
// Cancelled orders keep their status.
func refreshStatus(
	ctx context.Context, q *database.Queries, orderID []byte,
) (database.GetOrderByIdRow, error) {
	order, err := q.GetOrderById(ctx, orderID)
	if err != nil {
		return database.GetOrderByIdRow{}, api.Error(
			api.ErrorTypeFromSQL(err),
			err,
		)
	}

	if order.Status == statusCancelled {
		return order, nil
	}

	payments, err := q.ListPaymentsByOrder(ctx, orderID)
	if err != nil {
		return database.GetOrderByIdRow{}, api.Error(
			api.ErrorTypeFromSQL(err),
			err,
		)
	}

	hasRefunds := slices.ContainsFunc(
		payments,
		func(p database.Payment) bool { return p.Method == methodRefund },
	)

	status := deriveStatus(
		order.TotalAmountCents,
		order.AmountPaidCents,
		len(payments) > 0,
		hasRefunds,
	)

	err = q.SetOrderStatus(
		ctx,
		database.SetOrderStatusParams{Status: status, ID: order.ID},
	)
	if err != nil {
		return database.GetOrderByIdRow{}, api.Error(
			api.ErrorTypeFromSQL(err),
			err,
		)
	}

	order.Status = status

	return order, nil
}
