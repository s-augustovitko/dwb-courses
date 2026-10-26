package culqi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"dwb-courses/internal/payments"
)

// TokenEmail returns the email the payer typed in the Culqi checkout.
func (c *Client) TokenEmail(
	ctx context.Context,
	tokenID string,
) (string, error) {
	if !c.ValidTokenID(tokenID) {
		return "", payments.ErrRejected
	}

	status, raw, err := c.doRequest(
		ctx,
		http.MethodGet,
		"/tokens/"+url.PathEscape(tokenID),
		nil,
	)
	if err != nil {
		return "", err
	}

	if status == http.StatusNotFound {
		return "", payments.ErrNotFound
	}

	if status != http.StatusOK {
		return "", fmt.Errorf("culqi get token: unexpected status %d", status)
	}

	var token tokenResponse
	if err := json.Unmarshal(raw, &token); err != nil {
		return "", err
	}

	if token.Email == "" {
		return "", fmt.Errorf(
			"culqi get token: %w: missing email",
			payments.ErrRejected,
		)
	}

	return token.Email, nil
}
