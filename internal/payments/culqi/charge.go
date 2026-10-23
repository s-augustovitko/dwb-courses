package culqi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"unicode"

	"dwb-courses/internal/payments"
)

const (
	// maxCustomerNameRunes is the antifraud name limit Culqi documents (2-50).
	maxCustomerNameRunes = 50
	reviewActionCode     = "REVIEW"
	cardErrorType        = "card_error"
	maxUserMessageRunes  = 200
	maxDescriptionRunes  = 80
	orderIDMetadataKey   = "order_id"
	genericDeclinedLabel = "No se pudo procesar el pago con esta tarjeta. " +
		"Intenta con otra o paga en persona."
)

// Charge creates a charge and classifies the answer from the response body,
// never from the status alone.
func (c *Client) Charge(
	ctx context.Context,
	request payments.ChargeRequest,
) (payments.ChargeResult, error) {
	body, err := json.Marshal(newChargeBody(request))
	if err != nil {
		return payments.ChargeResult{}, err
	}

	status, raw, err := c.doRequest(ctx, http.MethodPost, "/charges", body)
	if err != nil {
		return payments.ChargeResult{}, fmt.Errorf(
			"%w: %w",
			payments.ErrOutcomeUnknown,
			err,
		)
	}

	return c.classify(status, raw, request)
}

// classify maps a charge answer to a result: fail closed, so anything
// ambiguous is "outcome unknown".
func (c *Client) classify(
	status int,
	raw []byte,
	request payments.ChargeRequest,
) (payments.ChargeResult, error) {
	switch {
	case status == http.StatusCreated:
		return c.parseCreated(raw, request)
	case status == http.StatusOK:
		return parseReview(raw)
	case status == http.StatusRequestTimeout || status == http.StatusConflict:
		return payments.ChargeResult{}, fmt.Errorf(
			"%w: culqi status %d",
			payments.ErrOutcomeUnknown,
			status,
		)
	case status >= http.StatusBadRequest &&
		status < http.StatusInternalServerError:
		return parseFailure(status, raw)
	default:
		return payments.ChargeResult{}, fmt.Errorf(
			"%w: culqi status %d",
			payments.ErrOutcomeUnknown,
			status,
		)
	}
}

// GetCharge fetches a charge by id; the id is validated and escaped before it
// is placed in the URL.
func (c *Client) GetCharge(
	ctx context.Context,
	chargeID string,
) (payments.ChargeDetails, error) {
	if !c.ValidChargeID(chargeID) {
		return payments.ChargeDetails{}, payments.ErrRejected
	}

	status, raw, err := c.doRequest(
		ctx,
		http.MethodGet,
		"/charges/"+url.PathEscape(chargeID),
		nil,
	)
	if err != nil {
		return payments.ChargeDetails{}, err
	}

	if status == http.StatusNotFound {
		return payments.ChargeDetails{}, payments.ErrNotFound
	}

	if status != http.StatusOK {
		return payments.ChargeDetails{}, fmt.Errorf(
			"culqi get charge: unexpected status %d",
			status,
		)
	}

	var charge chargeResponse
	if err := json.Unmarshal(raw, &charge); err != nil {
		return payments.ChargeDetails{}, err
	}

	orderID, _ := charge.Metadata[orderIDMetadataKey].(string)

	return payments.ChargeDetails{
		ID:           charge.ID,
		Paid:         charge.Paid,
		AmountCents:  charge.Amount,
		CurrencyCode: charge.currency(),
		OrderID:      orderID,
	}, nil
}

func newChargeBody(request payments.ChargeRequest) chargeBody {
	body := chargeBody{
		Amount:       request.AmountCents,
		CurrencyCode: request.CurrencyCode,
		Email:        request.Email,
		SourceID:     request.TokenID,
		Capture:      true,
		Description:  truncateRunes(request.Description, maxDescriptionRunes),
		AntifraudDetails: antifraudBody{
			FirstName: truncateRunes(
				request.Customer.FirstName,
				maxCustomerNameRunes,
			),
			LastName: truncateRunes(
				request.Customer.LastName,
				maxCustomerNameRunes,
			),
			PhoneNumber:       request.Customer.PhoneNumber,
			DeviceFingerprint: request.Customer.DeviceID,
		},
		Authentication3DS: nil,
		Metadata: map[string]string{
			orderIDMetadataKey: request.OrderID,
		},
	}

	if request.Authentication != nil {
		auth := request.Authentication
		body.Authentication3DS = &authentication3DSBody{
			ECI:                          auth.ECI,
			XID:                          auth.XID,
			CAVV:                         auth.CAVV,
			ProtocolVersion:              auth.ProtocolVersion,
			DirectoryServerTransactionID: auth.DirectoryServerTransactionID,
		}
	}

	return body
}

// parseCreated reads a 201: it counts as paid only when the body says paid for
// exactly what was requested.
func (c *Client) parseCreated(
	raw []byte,
	request payments.ChargeRequest,
) (payments.ChargeResult, error) {
	var charge chargeResponse
	if err := json.Unmarshal(raw, &charge); err != nil {
		return payments.ChargeResult{}, payments.ErrOutcomeUnknown
	}

	confirmed := charge.Paid &&
		request.AmountCents > 0 &&
		c.ValidChargeID(charge.ID) &&
		charge.Amount == request.AmountCents &&
		charge.currency() == request.CurrencyCode

	if !confirmed {
		return payments.ChargeResult{}, payments.ErrOutcomeUnknown
	}

	return payments.ChargeResult{
		Status:      payments.ChargeSucceeded,
		ChargeID:    charge.ID,
		AmountCents: charge.Amount,
		UserMessage: "",
	}, nil
}

// parseReview reads a 200: Culqi asks for 3DS with action_code REVIEW.
func parseReview(raw []byte) (payments.ChargeResult, error) {
	var review reviewResponse
	if err := json.Unmarshal(
		raw,
		&review,
	); err != nil ||
		review.ActionCode != reviewActionCode {
		return payments.ChargeResult{}, payments.ErrOutcomeUnknown
	}

	return payments.ChargeResult{
		Status:      payments.ChargeRequiresAuthentication,
		ChargeID:    "",
		AmountCents: 0,
		UserMessage: "",
	}, nil
}

// parseFailure reads a 4xx: card errors are declines, the rest our fault.
func parseFailure(status int, raw []byte) (payments.ChargeResult, error) {
	var failure errorResponse
	if err := json.Unmarshal(raw, &failure); err != nil {
		return payments.ChargeResult{}, fmt.Errorf(
			"%w: status %d",
			payments.ErrRejected,
			status,
		)
	}

	if failure.Type != cardErrorType {
		return payments.ChargeResult{}, fmt.Errorf(
			"%w: status %d type=%s code=%s",
			payments.ErrRejected,
			status,
			failure.Type,
			failure.Code,
		)
	}

	return payments.ChargeResult{
		Status:      payments.ChargeDeclined,
		ChargeID:    "",
		AmountCents: 0,
		UserMessage: cleanMessage(failure.UserMessage),
	}, nil
}

// cleanMessage makes a provider message safe to show: no control chars, capped.
func cleanMessage(text string) string {
	cleaned := strings.TrimSpace(strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}

		return r
	}, text))

	cleaned = truncateRunes(cleaned, maxUserMessageRunes)
	if cleaned == "" {
		return genericDeclinedLabel
	}

	return cleaned
}

func truncateRunes(text string, limit int) string {
	runes := []rune(text)
	if len(runes) <= limit {
		return text
	}

	return string(runes[:limit])
}
