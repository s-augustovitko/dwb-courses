// Package culqi is a thin client for the parts of the Culqi API the app uses.
package culqi

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"regexp"
	"time"
)

const (
	providerName     = "culqi"
	requestTimeout   = 10 * time.Second
	maxResponseBytes = 1 << 20
)

var (
	tokenIDPattern  = regexp.MustCompile(`^tkn_live_[A-Za-z0-9]{16}$`)
	chargeIDPattern = regexp.MustCompile(`^chr_live_[A-Za-z0-9]{8,32}$`)
)

// Client talks to Culqi with a secret key.
type Client struct {
	baseURL    string
	secretKey  string
	httpClient *http.Client
}

// New builds a Client; redirects are never followed so the key isn't resent.
func New(baseURL, secretKey string) *Client {
	return &Client{
		baseURL:   baseURL,
		secretKey: secretKey,
		httpClient: &http.Client{
			Transport: nil,
			Jar:       nil,
			Timeout:   requestTimeout,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}

// ValidTokenID reports whether id looks like a Culqi card token (25 chars).
func (c *Client) ValidTokenID(id string) bool {
	return tokenIDPattern.MatchString(id)
}

// ValidChargeID reports whether id looks like a live Culqi charge id.
func (c *Client) ValidChargeID(id string) bool {
	return chargeIDPattern.MatchString(id)
}

// Provider returns the provider id exposed to the browser.
func (c *Client) Provider() string {
	return providerName
}

// doRequest sends one authenticated JSON request and returns status and capped
// body.
func (c *Client) doRequest(
	ctx context.Context,
	method, path string,
	body []byte,
) (int, []byte, error) {
	request, err := http.NewRequestWithContext(
		ctx,
		method,
		c.baseURL+path,
		bytes.NewReader(body),
	)
	if err != nil {
		return 0, nil, err
	}

	request.Header.Set("Authorization", "Bearer "+c.secretKey)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")

	response, err := c.httpClient.Do(request)
	if err != nil {
		return 0, nil, err
	}

	defer func() { _ = response.Body.Close() }()

	raw, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes))
	if err != nil {
		return 0, nil, err
	}

	return response.StatusCode, raw, nil
}
