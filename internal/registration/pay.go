package registration

import (
	"context"
	"errors"
	"time"
	"unicode/utf8"

	"github.com/gofiber/fiber/v3"
	"github.com/rs/zerolog"

	"dwb-courses/internal/api"
	"dwb-courses/internal/database"
	"dwb-courses/internal/payments"
)

const (
	minChargeCents    = 300
	maxChargeCents    = 999900
	minGatewayNameLen = 2
	descriptionPrefix = "Inscripción "
	chargeTimeout     = 12 * time.Second

	payStatusPaid       = "PAID"
	payStatusNeedsAuth  = "REQUIRES_AUTHENTICATION"
	payStatusFailed     = "FAILED"
	payStatusProcessing = "PROCESSING"

	messagePaid       = "Pago recibido."
	messageNeedsAuth  = "El banco necesita confirmar tu identidad."
	messageFailed     = "No se pudo procesar el pago. Intenta de nuevo o paga en persona."
	messageProcessing = "Estamos confirmando tu pago. Te enviaremos un correo."
)

type authentication3DSRequest struct {
	ECI             string `json:"eci"             validate:"required,len=2,number"`
	XID             string `json:"xid"             validate:"omitempty,max=128,base64|base64rawurl|hexadecimal"`
	CAVV            string `json:"cavv"            validate:"required,max=128,base64|base64rawurl|hexadecimal"`
	ProtocolVersion string `json:"protocolVersion" validate:"required,max=16,semver"`

	DirectoryServerTransactionID string `json:"directoryServerTransactionId" validate:"omitempty,uuid_rfc4122"`
}

type payRequest struct {
	TokenPath

	TokenID           string                    `json:"tokenId"        validate:"required"`
	DeviceID          string                    `json:"deviceId"       validate:"required,uuid4_rfc4122"`
	Authentication3DS *authentication3DSRequest `json:"authentication" validate:"omitempty"`
}

type payResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// payAttempt is the order state a charge is based on, read while holding the
// order's lock.
type payAttempt struct {
	order     database.GetOrderByIdRow
	sub       database.Submission
	orderText string
	title     string
	balance   int64
}

// payOutcome is the answer to a payment attempt; notify means this request
// stored the payment, so the registrant still has to be emailed.
type payOutcome struct {
	response payResponse
	notify   bool
}

func unconfirmed(status, message string) payOutcome {
	return payOutcome{
		response: payResponse{Status: status, Message: message},
		notify:   false,
	}
}

// Pay charges the full balance with a gateway card token and settles the
// registration.
func (s server) Pay(c fiber.Ctx) error {
	var body payRequest
	if err := c.Bind().All(&body); err != nil {
		return api.Error(api.ErrorTypeBadRequest, err)
	}

	if !s.gateway.ValidTokenID(body.TokenID) {
		return api.Error(api.ErrorTypeBadRequest, nil)
	}

	attempt, outcome, err := s.payLocked(c, body)
	if err != nil {
		return err
	}

	// Sent after the order lock is released so a slow mail server does not hold
	// the order.
	if outcome.notify {
		ctx, cancel := s.Cfg().MdCtx(c)
		defer cancel()

		logger := s.Logger(c).With().Str("order", attempt.orderText).Logger()

		s.emailConfirmation(
			ctx,
			&logger,
			attempt.sub,
			api.UUIDFromBytes(attempt.order.ID),
			body.Token,
			confirmationPaid,
		)
	}

	return api.Success(c, outcome.response)
}

// payLocked charges the order while holding its lock.
func (s server) payLocked(
	c fiber.Ctx, body payRequest,
) (payAttempt, payOutcome, error) {
	release, err := s.lockByToken(c, body.Token)
	if err != nil {
		return payAttempt{}, payOutcome{}, err
	}
	defer release()

	// Created after the lock wait, so queueing behind another payment does not
	// use up this request's budget.
	ctx, cancel := s.Cfg().LgCtx(c)
	defer cancel()

	attempt, err := loadPayAttempt(ctx, database.New(s.DB()), body.Token)
	if err != nil {
		return payAttempt{}, payOutcome{}, err
	}

	logger := s.Logger(c).With().Str("order", attempt.orderText).Logger()

	if attempt.order.PaymentPendingAt.Valid {
		if err := s.clearExpiredPending(ctx, &logger, attempt); err != nil {
			return payAttempt{}, payOutcome{}, err
		}
	}

	if !s.attempts.allowAttempt(attempt.orderText) {
		logger.Warn().Msg("too many online payment attempts for the order")

		return payAttempt{}, payOutcome{}, api.Error(
			api.ErrorTypeRateLimit,
			nil,
		)
	}

	return attempt, s.chargeOnline(ctx, &logger, attempt, body), nil
}

func loadPayAttempt(
	ctx context.Context,
	q *database.Queries,
	token string,
) (payAttempt, error) {
	order, err := orderByToken(ctx, q, token)
	if err != nil {
		return payAttempt{}, err
	}

	sub, form, err := loadSubmissionAndForm(ctx, q, order)
	if err != nil {
		return payAttempt{}, err
	}

	if order.Status == statusDraft && !form.IsEnabled {
		return payAttempt{}, api.Error(api.ErrorTypeNotFound, nil)
	}

	if err := requireSelection(ctx, q, form, sub.ID); err != nil {
		return payAttempt{}, err
	}

	if !onlinePayable(order, sub, form, true) {
		return payAttempt{}, api.Error(api.ErrorTypeConflict, nil)
	}

	// An order being paid is active: this keeps the idle-draft cleanup from
	// deleting it mid-payment.
	if err := q.TouchOrder(ctx, order.ID); err != nil {
		return payAttempt{}, api.Error(api.ErrorTypeFromSQL(err), err)
	}

	return payAttempt{
		order:     order,
		sub:       sub,
		orderText: api.UUIDString(order.ID),
		title:     form.Title,
		balance:   order.TotalAmountCents - order.AmountPaidCents,
	}, nil
}

func onlinePayable(
	order database.GetOrderByIdRow,
	sub database.Submission,
	form database.Form,
	hasItems bool,
) bool {
	balance := order.TotalAmountCents - order.AmountPaidCents

	return hasItems && payableStatus(order.Status, form.IsEnabled) &&
		!paymentPending(order.PaymentPendingAt) &&
		onlineCurrency(order.CurrencyCode) &&
		balance >= minChargeCents && balance <= maxChargeCents && gatewayAcceptsPayer(sub)
}

func payableStatus(status string, formEnabled bool) bool {
	switch status {
	case statusDraft:
		return formEnabled
	case statusPending, statusPartiallyPaid:
		return true
	default:
		return false
	}
}

func gatewayAcceptsPayer(sub database.Submission) bool {
	return utf8.RuneCountInString(sub.FirstName) >= minGatewayNameLen &&
		utf8.RuneCountInString(sub.LastName) >= minGatewayNameLen
}

// clearExpiredPending lifts a pending block whose window ran out without an
// outcome, logging it once.
func (s server) clearExpiredPending(
	ctx context.Context,
	logger *zerolog.Logger,
	attempt payAttempt,
) error {
	if err := database.New(s.DB()).
		ClearPaymentPending(ctx, attempt.order.ID); err != nil {
		return api.Error(api.ErrorTypeFromSQL(err), err)
	}

	logger.Error().
		Msg("a pending online payment expired without an outcome; check Culqi for a charge on this order")

	return nil
}

func (s server) chargeOnline(
	ctx context.Context,
	logger *zerolog.Logger,
	attempt payAttempt,
	body payRequest,
) payOutcome {
	// Detached from the request so a client disconnect cannot turn a charge
	// into an unknown outcome.
	chargeCtx, cancel := context.WithTimeout(
		context.WithoutCancel(ctx),
		chargeTimeout,
	)
	defer cancel()

	payerEmail, err := s.gateway.TokenEmail(chargeCtx, body.TokenID)
	if err != nil {
		logger.Error().
			Err(err).
			Msg("could not read the payer email from the card token")

		return unconfirmed(payStatusFailed, messageFailed)
	}

	result, err := s.gateway.Charge(
		chargeCtx,
		newChargeRequest(attempt, body, payerEmail),
	)

	switch {
	case errors.Is(err, payments.ErrOutcomeUnknown):
		logger.Error().Err(err).Msg("online payment outcome unknown")

		return s.awaitConfirmation(ctx, logger, attempt)
	case err != nil:
		logger.Error().Err(err).Msg("online payment rejected")

		return unconfirmed(payStatusFailed, messageFailed)
	}

	switch result.Status {
	case payments.ChargeRequiresAuthentication:
		return unconfirmed(payStatusNeedsAuth, messageNeedsAuth)
	case payments.ChargeDeclined:
		return unconfirmed(payStatusFailed, result.UserMessage)
	case payments.ChargeSucceeded:
		return s.finishPayment(ctx, logger, attempt, result)
	default:
		return unconfirmed(payStatusFailed, messageFailed)
	}
}

func newChargeRequest(
	attempt payAttempt,
	body payRequest,
	payerEmail string,
) payments.ChargeRequest {
	request := payments.ChargeRequest{
		AmountCents:  attempt.balance,
		CurrencyCode: attempt.order.CurrencyCode,
		Email:        payerEmail,
		TokenID:      body.TokenID,
		Description:  descriptionPrefix + attempt.title,
		OrderID:      attempt.orderText,
		Customer: payments.Customer{
			FirstName:   attempt.sub.FirstName,
			LastName:    attempt.sub.LastName,
			PhoneNumber: attempt.sub.PhoneNumber,
			DeviceID:    body.DeviceID,
		},
		Authentication: nil,
	}

	if body.Authentication3DS != nil {
		request.Authentication = &payments.Authentication3DS{
			ECI:                          body.Authentication3DS.ECI,
			XID:                          body.Authentication3DS.XID,
			CAVV:                         body.Authentication3DS.CAVV,
			ProtocolVersion:              body.Authentication3DS.ProtocolVersion,
			DirectoryServerTransactionID: body.Authentication3DS.DirectoryServerTransactionID,
		}
	}

	return request
}

// awaitConfirmation blocks new charges for the order while the outcome of this
// one is unknown. The answer is PROCESSING even if the block cannot be stored:
// telling the registrant to wait beats inviting a retry.
func (s server) awaitConfirmation(
	ctx context.Context,
	logger *zerolog.Logger,
	attempt payAttempt,
) payOutcome {
	pendingCtx, cancel := s.Cfg().LgCtx(context.WithoutCancel(ctx))
	defer cancel()

	if err := database.New(s.DB()).
		SetPaymentPending(pendingCtx, attempt.order.ID); err != nil {
		logger.Error().Err(err).
			Msg("could not mark the payment as pending; a retry could charge the card twice")
	}

	return unconfirmed(payStatusProcessing, messageProcessing)
}

func (s server) finishPayment(
	ctx context.Context,
	logger *zerolog.Logger,
	attempt payAttempt,
	result payments.ChargeResult,
) payOutcome {
	recordCtx, cancel := s.Cfg().LgCtx(context.WithoutCancel(ctx))
	defer cancel()

	chargeLogger := logger.With().Str("charge", result.ChargeID).Logger()

	record, err := s.recordOnlinePayment(
		recordCtx,
		&chargeLogger,
		api.UUIDFromBytes(attempt.order.ID),
		// Gateway.Charge succeeds only in the requested currency; the currency
		// check is for the webhook.
		onlineCharge{
			id: result.ChargeID, amountCents: result.AmountCents,
			currencyCode: attempt.order.CurrencyCode,
		},
	)
	if err != nil {
		chargeLogger.Error().
			Err(err).
			Msg("charge succeeded but recording failed")

		return s.awaitConfirmation(ctx, logger, attempt)
	}

	return payOutcome{
		response: payResponse{Status: payStatusPaid, Message: messagePaid},
		notify:   record.notify,
	}
}
