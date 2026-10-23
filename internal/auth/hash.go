package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"github.com/gofiber/utils/v2"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/argon2"
)

var errInvalidHash = errors.New("invalid hash")

const (
	dummyPasswordLength = 32

	argonMemoryKiB   = 64 * 1024
	argonIterations  = 1
	argonParallelism = 2
	argonSaltLength  = 16
	argonKeyLength   = 32
)

// hashSlot caps how many Argon2id hashes run at once
// Must be initialized with SetMaxConcurrentHashes on start up.
var hashSlot = make(chan struct{}, 1)

// SetMaxConcurrentHashes resizes hashSlot. Call it once at startup.
func SetMaxConcurrentHashes(n int) {
	hashSlot = make(chan struct{}, n)
}

// idKey is argon2.IDKey behind hashSlot.
func idKey(
	password, salt []byte,
	time, memory uint32,
	threads uint8,
	keyLen uint32,
) []byte {
	hashSlot <- struct{}{}
	defer func() { <-hashSlot }()

	return argon2.IDKey(password, salt, time, memory, threads, keyLen)
}

// dummyHash is a valid Argon2id hash with no known password. Login compares
// against it when the email lookup fails, so timing cannot reveal valid emails.
var dummyHash string

func init() {
	hash, err := defaultHash.HashPassword(
		utils.GenerateSecureToken(dummyPasswordLength),
	)
	if err != nil {
		log.Fatal().Err(err).Msg("could not create dummy hash")
	}

	dummyHash = hash
}

type hashParams struct {
	memory      uint32
	time        uint32
	parallelism uint8

	saltLength uint32
	keyLength  uint32
}

var defaultHash = hashParams{
	memory:      argonMemoryKiB,
	time:        argonIterations,
	parallelism: argonParallelism,
	saltLength:  argonSaltLength,
	keyLength:   argonKeyLength,
}

// HashPassword returns an Argon2id hash, following the C standards.
// Ex.
// $argon2id$v=19$m=65536,t=1,p=2$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG.
func (p hashParams) HashPassword(password string) (string, error) {
	salt, err := p.generateSalt()
	if err != nil {
		return "", err
	}

	key := idKey(
		[]byte(password),
		salt,
		p.time,
		p.memory,
		p.parallelism,
		p.keyLength,
	)

	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Key := base64.RawStdEncoding.EncodeToString(key)

	return fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		p.memory,
		p.time,
		p.parallelism,
		b64Salt,
		b64Key,
	), nil
}

func (p hashParams) generateSalt() ([]byte, error) {
	salt := make([]byte, p.saltLength)

	_, err := rand.Read(salt)
	if err != nil {
		return nil, err
	}

	return salt, nil
}

// compareHash compares a password with a hash. Returns true if both are valid,
// and an error if the hash is invalid.
func compareHash(hash, pass string) (bool, error) {
	parts := strings.Split(hash, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, errors.New("invalid hash format")
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return false, err
	}

	if version != argon2.Version {
		return false, errors.New("invalid version")
	}

	// Extract the Argon2 parameters used to create this hash
	//
	//exhaustruct:ignore
	var params hashParams

	_, err := fmt.Sscanf(
		parts[3],
		"m=%d,t=%d,p=%d",
		&params.memory, &params.time, &params.parallelism)
	if err != nil {
		return false, errInvalidHash
	}

	salt, err := base64.RawStdEncoding.Strict().DecodeString(parts[4])
	if err != nil {
		return false, errInvalidHash
	}

	storedKey, err := base64.RawStdEncoding.Strict().DecodeString(parts[5])
	if err != nil {
		return false, errInvalidHash
	}

	params.keyLength = uint32(len(storedKey)) // #nosec G115

	derivedKey := idKey(
		[]byte(pass),
		salt,
		params.time,
		params.memory,
		params.parallelism,
		params.keyLength,
	)

	// Constant-time comparison prevents timing attacks
	return subtle.ConstantTimeCompare(storedKey, derivedKey) == 1, nil
}
