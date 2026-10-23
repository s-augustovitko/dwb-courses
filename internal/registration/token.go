package registration

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
)

const tokenBytes = 32

// NewToken returns a random bearer token and the hash stored in the database.
func NewToken() (string, string, error) {
	raw := make([]byte, tokenBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}

	token := base64.RawURLEncoding.EncodeToString(raw)

	return token, hashToken(token), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))

	return hex.EncodeToString(sum[:])
}
