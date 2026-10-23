package registration

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
)

const (
	onlinePaymentNote = "Pago en línea"

	currencyPEN = "PEN"
	currencyUSD = "USD"

	paymentPendingWindow = 24 * time.Hour
)

var (
	errCurrencyMismatch = errors.New(
		"charge currency differs from the order currency",
	)
	errOrderGone = errors.New("order no longer exists")
)

type onlineCharge struct {
	id           string
	amountCents  int64
	currencyCode string
}

func paymentPending(at sql.NullInt64) bool {
	return at.Valid &&
		api.Now().Sub(api.FromUnix(at.Int64)) < paymentPendingWindow
}

func onlineCurrency(code string) bool {
	return code == currencyPEN || code == currencyUSD
}

// paymentRecord is the order after a payment was stored; notify means the
// registrant still has to be emailed.
type paymentRecord struct {
	order  database.GetOrderByIdRow
	notify bool
}

// recordOnlinePayment stores a charge in a transaction. The logger already
// carries the charge and order ids.
func (s server) recordOnlinePayment(
	ctx context.Context,
	logger *zerolog.Logger,
	orderID uuid.UUID,
	charge onlineCharge,
) (paymentRecord, error) {
	var record paymentRecord

	err := api.WithTx(ctx, s, logger, func(q *database.Queries) error {
		var err error

		record, err = storeOnlinePayment(ctx, q, logger, orderID, charge)

		return err
	})
	if err != nil {
		return paymentRecord{}, err
	}

	return record, nil
}

func storeOnlinePayment(
	ctx context.Context,
	q *database.Queries,
	logger *zerolog.Logger,
	orderID uuid.UUID,
	charge onlineCharge,
) (paymentRecord, error) {
	order, err := q.GetOrderById(ctx, orderID[:])
	if errors.Is(err, sql.ErrNoRows) {
		return paymentRecord{}, errOrderGone
	}

	if err != nil {
		return paymentRecord{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	if charge.currencyCode != order.CurrencyCode {
		logger.Error().
			Msg("online payment currency differs from the order; settle it by hand")

		return paymentRecord{}, errCurrencyMismatch
	}

	paymentID, err := uuid.NewV7()
	if err != nil {
		return paymentRecord{}, api.Error(api.ErrorTypeUnexpected, err)
	}

	inserted, err := q.CreateOnlinePaymentIfNew(
		ctx,
		database.CreateOnlinePaymentIfNewParams{
			ID:                paymentID[:],
			OrderID:           orderID[:],
			AmountCents:       charge.amountCents,
			ProviderReference: sql.NullString{String: charge.id, Valid: true},
			Note: sql.NullString{
				String: onlinePaymentNote,
				Valid:  true,
			},
		},
	)
	if err != nil {
		return paymentRecord{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	if inserted != 1 {
		return paymentRecord{order: order, notify: false}, nil
	}

	notify, err := settleOnlinePayment(ctx, q, logger, orderID, charge)
	if err != nil {
		return paymentRecord{}, err
	}

	return paymentRecord{order: order, notify: notify}, nil
}

// settleOnlinePayment lifts the pending block and derives the status after a
// new online payment; money on a cancelled order or above the total is logged
// for a refund in Culqi. It reports whether to email the registrant.
func settleOnlinePayment(
	ctx context.Context,
	q *database.Queries,
	logger *zerolog.Logger,
	orderID uuid.UUID,
	charge onlineCharge,
) (bool, error) {
	if err := q.ClearPaymentPending(ctx, orderID[:]); err != nil {
		return false, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	settled, err := refreshStatus(ctx, q, orderID[:])
	if err != nil {
		return false, err
	}

	if settled.Status == statusCancelled {
		logger.Error().
			Int64("amountCents", charge.amountCents).
			Msg("online payment received for a cancelled registration; refund it in Culqi")

		return false, nil
	}

	if settled.AmountPaidCents > settled.TotalAmountCents {
		logger.Error().
			Int64("amountPaidCents", settled.AmountPaidCents).
			Int64("totalAmountCents", settled.TotalAmountCents).
			Msg("online payment exceeds order total; refund the difference in Culqi")
	}

	return true, nil
}
