// Package zoho is a thin client for the Zoho CPaaS (ZeptoMail) email API.
package zoho

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"dwb-courses/internal/mail"
)

const (
	requestTimeout   = 10 * time.Second
	maxResponseBytes = 1 << 20
	authScheme       = "Zoho-enczapikey "
)

// Client sends emails through Zoho CPaaS.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// New builds a Client that never follows redirects, so the key isn't resent.
func New(baseURL, apiKey string) *Client {
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
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

// Send posts one email.
func (c *Client) Send(ctx context.Context, message mail.Message) error {
	requestBody, err := json.Marshal(newEmailBody(message))
	if err != nil {
		return err
	}

	status, responseBody, err := c.postEmail(ctx, requestBody)
	if err != nil {
		return err
	}

	if status < http.StatusOK || status >= http.StatusMultipleChoices {
		return failureError(status, responseBody)
	}

	return nil
}

func failureError(status int, responseBody []byte) error {
	var failure errorResponse
	if err := json.Unmarshal(responseBody, &failure); err != nil ||
		failure.Data.ErrorCode == "" {
		return fmt.Errorf("zoho send email: unexpected status %d", status)
	}

	return fmt.Errorf(
		"zoho send email: status %d: %s: %s",
		status,
		failure.Data.ErrorCode,
		failure.Data.Message,
	)
}

func (c *Client) postEmail(
	ctx context.Context,
	requestBody []byte,
) (int, []byte, error) {
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.baseURL+"/email",
		bytes.NewReader(requestBody),
	)
	if err != nil {
		return 0, nil, err
	}

	request.Header.Set("Authorization", authScheme+c.apiKey)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")

	response, err := c.httpClient.Do(request)
	if err != nil {
		return 0, nil, err
	}

	defer func() { _ = response.Body.Close() }()

	responseBody, err := io.ReadAll(
		io.LimitReader(response.Body, maxResponseBytes),
	)
	if err != nil {
		return 0, nil, err
	}

	return response.StatusCode, responseBody, nil
}
