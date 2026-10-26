package culqi

type antifraudBody struct {
	FirstName         string `json:"first_name"`
	LastName          string `json:"last_name"`
	PhoneNumber       string `json:"phone_number"`
	DeviceFingerprint string `json:"device_finger_print_id"`
}

// authentication3DSBody is the 3DS result; xid and the DS transaction id are
// omitted when empty (3DS 2.x).
type authentication3DSBody struct {
	ECI                          string `json:"eci"`
	XID                          string `json:"xid,omitempty"`
	CAVV                         string `json:"cavv"`
	ProtocolVersion              string `json:"protocolVersion"`
	DirectoryServerTransactionID string `json:"directoryServerTransactionId,omitempty"`
}

type chargeBody struct {
	Amount            int64                  `json:"amount"`
	CurrencyCode      string                 `json:"currency_code"`
	Email             string                 `json:"email"`
	SourceID          string                 `json:"source_id"`
	Capture           bool                   `json:"capture"`
	Description       string                 `json:"description"`
	AntifraudDetails  antifraudBody          `json:"antifraud_details"`
	Authentication3DS *authentication3DSBody `json:"authentication_3DS,omitempty"`
	Metadata          map[string]string      `json:"metadata"`
}

type outcomeResponse struct {
	Type string `json:"type"`
}

type chargeResponse struct {
	ID           string          `json:"id"`
	Outcome      outcomeResponse `json:"outcome"`
	Capture      bool            `json:"capture"`
	Amount       int64           `json:"amount"`
	CurrencyCode string          `json:"currency_code"`
	Currency     string          `json:"currency"`
	Metadata     map[string]any  `json:"metadata"`
}

func (r chargeResponse) succeeded() bool {
	return r.Capture && r.Outcome.Type == successfulSaleType
}

// currency returns currency_code, falling back to currency when the body only
// carries that one.
func (r chargeResponse) currency() string {
	if r.CurrencyCode != "" {
		return r.CurrencyCode
	}

	return r.Currency
}

type reviewResponse struct {
	ActionCode string `json:"action_code"`
}

type errorResponse struct {
	Type        string `json:"type"`
	Code        string `json:"code"`
	UserMessage string `json:"user_message"`
}

type tokenResponse struct {
	Email string `json:"email"`
}
