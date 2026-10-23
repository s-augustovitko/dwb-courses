package registration

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/payments"
)

const (
	maxWebhookBodyBytes  = 64 * 1024
	eventChargeSucceeded = "charge.creation.succeeded"
)

type webhookEvent struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type webhookResource struct {
	ID string `json:"id"`
}

// CulqiWebhook confirms charges: the body is untrusted, so only the charge id
// is read and the charge is fetched.
func (s server) CulqiWebhook(c fiber.Ctx) error {
	logger := s.Logger(c)

	event, err := parseWebhook(c.Body())
	if err != nil {
		logger.Warn().Err(err).
			Int("bodyBytes", len(c.Body())).
			Msg("culqi webhook rejected: body is empty, too large or not valid JSON")

		return err
	}

	if event.Type != eventChargeSucceeded {
		logger.Info().
			Str("eventType", event.Type).
			Msg("culqi webhook ignored: event type is not handled")

		return api.Success(c, true)
	}

	chargeID, err := s.chargeIDFromEvent(event.Data)
	if err != nil {
		logger.Warn().Err(err).
			Str("eventType", event.Type).
			Msg("culqi webhook rejected: data has no valid charge id")

		return err
	}

	ctx, cancel := s.Cfg().LgCtx(c)
	defer cancel()

	chargeLogger := logger.With().Str("charge", chargeID).Logger()

	if err := s.confirmCharge(ctx, &chargeLogger, chargeID); err != nil {
		chargeLogger.Error().
			Err(err).
			Msg("culqi webhook failed; Culqi will retry")

		return err
	}

	return api.Success(c, true)
}

func parseWebhook(body []byte) (webhookEvent, error) {
	var event webhookEvent

	if len(body) == 0 || len(body) > maxWebhookBodyBytes {
		return event, api.Error(api.ErrorTypeBadRequest, nil)
	}

	if err := json.Unmarshal(body, &event); err != nil {
		return event, api.Error(api.ErrorTypeBadRequest, err)
	}

	return event, nil
}

// chargeIDFromEvent reads the charge id from Culqi's data field (a JSON
// string or an object) and validates it.
func (s server) chargeIDFromEvent(raw json.RawMessage) (string, error) {
	data := bytes.TrimSpace(raw)
	if len(data) == 0 {
		return "", api.Error(api.ErrorTypeBadRequest, nil)
	}

	if data[0] == '"' {
		var inner string
		if err := json.Unmarshal(data, &inner); err != nil {
			return "", api.Error(api.ErrorTypeBadRequest, err)
		}

		data = []byte(inner)
	}

	var resource webhookResource
	if err := json.Unmarshal(data, &resource); err != nil {
		return "", api.Error(api.ErrorTypeBadRequest, err)
	}

	if !s.gateway.ValidChargeID(resource.ID) {
		return "", api.Error(api.ErrorTypeBadRequest, nil)
	}

	return resource.ID, nil
}

// confirmCharge records a charge Culqi reports as paid; unusable charges
// are acknowledged so Culqi stops retrying. The logger carries the charge id.
func (s server) confirmCharge(
	ctx context.Context,
	logger *zerolog.Logger,
	chargeID string,
) error {
	_, err := database.New(s.DB()).GetOnlinePaymentByReference(
		ctx, sql.NullString{String: chargeID, Valid: true},
	)
	if err == nil {
		logger.Info().Msg("culqi webhook: charge already recorded")

		return nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		logger.Error().Err(err).
			Msg("culqi webhook: could not look up the payment by reference")

		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	details, err := s.gateway.GetCharge(ctx, chargeID)
	if errors.Is(err, payments.ErrNotFound) {
		logger.Warn().Msg("webhook charge does not exist at the provider")

		return nil
	}

	if err != nil {
		logger.Error().Err(err).
			Msg("culqi webhook: could not fetch the charge from the provider")

		return api.Error(api.ErrorTypeUnexpected, err)
	}

	orderID, usable := usableCharge(logger, details, chargeID)
	if !usable {
		return nil
	}

	return s.recordWebhookPayment(ctx, logger, orderID, details)
}

func usableCharge(
	logger *zerolog.Logger,
	details payments.ChargeDetails,
	chargeID string,
) (uuid.UUID, bool) {
	orderID, err := uuid.Parse(details.OrderID)
	if err == nil && details.ID == chargeID && details.Paid &&
		onlineCurrency(details.CurrencyCode) && details.AmountCents > 0 {
		return orderID, true
	}

	level := zerolog.WarnLevel
	if details.Paid {
		level = zerolog.ErrorLevel
	}

	logger.WithLevel(level).
		Str("order", details.OrderID).
		Bool("paid", details.Paid).
		Msg("webhook charge is not a usable payment; check it in Culqi")

	return uuid.UUID{}, false
}

// recordWebhookPayment records the charge under the order lock and emails the
// registrant once. Outcomes a retry cannot change (gone order, currency
// mismatch) are logged and acknowledged. The logger carries the charge id.
func (s server) recordWebhookPayment(
	ctx context.Context,
	logger *zerolog.Logger,
	orderID uuid.UUID,
	details payments.ChargeDetails,
) error {
	orderLogger := logger.With().Str("order", orderID.String()).Logger()

	record, err := s.recordLocked(ctx, &orderLogger, orderID, onlineCharge{
		id:           details.ID,
		amountCents:  details.AmountCents,
		currencyCode: details.CurrencyCode,
	})

	switch {
	case errors.Is(err, errCurrencyMismatch):
		return nil
	case errors.Is(err, errOrderGone):
		logOrphanCharge(logger, details)

		return nil
	case err != nil:
		orderLogger.Error().Err(err).
			Msg("culqi webhook: could not record the payment")

		return api.Error(api.ErrorTypeUnexpected, err)
	case !record.notify:
		orderLogger.Info().
			Msg("culqi webhook: payment recorded, no email needed")

		return nil
	}

	orderLogger.Info().
		Int64("amountCents", details.AmountCents).
		Str("currency", details.CurrencyCode).
		Msg("culqi webhook: payment recorded")

	sub, err := loadSubmission(ctx, database.New(s.DB()), record.order)
	if err != nil {
		orderLogger.Error().Err(err).
			Msg("could not load the registrant for the payment email")

		return nil
	}

	s.emailConfirmation(
		ctx, &orderLogger, sub, orderID, "", confirmationPaid,
	)

	return nil
}

// recordLocked records the payment under the order lock, released before the
// email is sent.
func (s server) recordLocked(
	ctx context.Context,
	logger *zerolog.Logger,
	orderID uuid.UUID,
	charge onlineCharge,
) (paymentRecord, error) {
	defer s.locks.lock(orderID.String())()

	return s.recordOnlinePayment(ctx, logger, orderID, charge)
}

// logOrphanCharge reports a paid charge with no registration so staff can
// refund it in the Culqi panel.
func logOrphanCharge(logger *zerolog.Logger, details payments.ChargeDetails) {
	logger.Error().
		Str("order", details.OrderID).
		Int64("amountCents", details.AmountCents).
		Str("currency", details.CurrencyCode).
		Msg("paid online charge has no registration; refund it in Culqi")
}
