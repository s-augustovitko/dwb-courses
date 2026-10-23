package payments

import "context"

// ChargeStatus is the provider-neutral outcome of a charge attempt.
type ChargeStatus string

// Known ChargeStatus values.
const (
	ChargeSucceeded              ChargeStatus = "SUCCEEDED"
	ChargeRequiresAuthentication ChargeStatus = "REQUIRES_AUTHENTICATION"
	ChargeDeclined               ChargeStatus = "DECLINED"
)

// Customer is the payer data used for fraud checks.
type Customer struct {
	FirstName   string
	LastName    string
	PhoneNumber string
	DeviceID    string
}

// Authentication3DS carries the result of the cardholder authentication.
type Authentication3DS struct {
	ECI                          string
	XID                          string
	CAVV                         string
	ProtocolVersion              string
	DirectoryServerTransactionID string
}

// ChargeRequest asks the provider to charge a one-time card token.
type ChargeRequest struct {
	AmountCents    int64
	CurrencyCode   string
	Email          string
	TokenID        string
	Description    string
	OrderID        string
	Customer       Customer
	Authentication *Authentication3DS
}

// ChargeResult is what the provider answered to a charge attempt.
type ChargeResult struct {
	Status      ChargeStatus
	ChargeID    string
	AmountCents int64
	UserMessage string
}

// ChargeDetails is a charge as the provider reports it when asked.
type ChargeDetails struct {
	ID           string
	Paid         bool
	AmountCents  int64
	CurrencyCode string
	OrderID      string
}

// Gateway is the payment provider behind online payments; handlers use only it.
type Gateway interface {
	Provider() string
	ValidTokenID(id string) bool
	ValidChargeID(id string) bool
	Charge(ctx context.Context, request ChargeRequest) (ChargeResult, error)
	GetCharge(ctx context.Context, chargeID string) (ChargeDetails, error)
}
